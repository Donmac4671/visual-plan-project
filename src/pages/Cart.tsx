import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useCart } from "@/contexts/CartContext";
import { formatCurrency, calculatePaystackFee, calculateMashupFee } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Trash2, ShoppingCart, Wallet, CreditCard, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { initPaystack } from "@/lib/paystack";

export default function Cart() {
  const { items, removeItem, clearCart, total } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "paystack">("wallet");
  const [processing, setProcessing] = useState(false);

  const mashupSubtotal = items.filter((i) => i.networkId === "mashup").reduce((sum, i) => sum + i.effectivePrice, 0);
  const mashupFee = calculateMashupFee(mashupSubtotal);
  const grandTotal = total + mashupFee;
  const paystackFee = calculatePaystackFee(grandTotal);
  const paystackTotal = grandTotal + paystackFee;

  const checkPendingOrders = async (phoneNumbers: string[]): Promise<string[]> => {
    const uniquePhones = [...new Set(phoneNumbers)];
    const { data } = await supabase
      .from("orders")
      .select("phone_number")
      .in("phone_number", uniquePhones)
      .in("status", ["pending", "processing"]);
    return data?.map((o) => o.phone_number) || [];
  };

  // Helper function to extract bundle size in GB
  const extractBundleSizeGB = (bundleSize: string, sizeGB: number): number => {
    if (sizeGB && sizeGB > 0) {
      return sizeGB;
    }
    const match = bundleSize.match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i);
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2].toUpperCase();
      return unit === "MB" ? value / 1000 : value;
    }
    return 1;
  };

  const handlePayWithWallet = async () => {
    if (!profile) return;

    console.log("=== CART DEBUG ===");
    console.log(
      "All cart items:",
      items.map((i) => ({
        id: i.id,
        networkId: i.networkId,
        network: i.network,
        bundle: i.bundle.size,
        sizeGB: i.bundle.sizeGB,
        phone: i.phoneNumber,
        price: i.effectivePrice,
      })),
    );

    if (profile.wallet_balance < grandTotal) {
      toast({
        title: "Insufficient Balance",
        description: "Please top up your wallet first.",
        variant: "destructive",
      });
      return;
    }

    // Filter items by type
    const airtimeMashupItems = items.filter((i) => i.networkId === "airtime" || i.networkId === "mashup");
    const dataItems = items.filter((i) => i.networkId !== "airtime" && i.networkId !== "mashup");

    console.log("Airtime/Mashup items:", airtimeMashupItems.length);
    console.log("Data items:", dataItems.length);
    console.log(
      "Data items details:",
      dataItems.map((i) => ({ networkId: i.networkId, bundle: i.bundle.size, sizeGB: i.bundle.sizeGB })),
    );

    setProcessing(true);

    try {
      // ============================================================
      // Handle Airtime & Mashup - Set status to "processing" (manual delivery)
      // ============================================================
      for (const item of airtimeMashupItems) {
        console.log(`Processing ${item.networkId} for ${item.phoneNumber}...`);

        const amount =
          item.networkId === "mashup" ? Math.round(item.effectivePrice * (1 + 0.05) * 100) / 100 : item.effectivePrice;

        const { data: orderId, error: orderError } = await supabase.rpc("pay_with_wallet", {
          p_network: item.network,
          p_phone: item.phoneNumber,
          p_bundle: item.bundle.size,
          p_amount: amount,
        });

        if (orderError) {
          throw new Error(`${item.networkId} order failed: ${orderError.message}`);
        }

        const { error: updateError } = await supabase
          .from("orders")
          .update({
            status: "processing",
            gh_reference: `${item.networkId}-manual-${Date.now()}`,
          })
          .eq("id", orderId);

        if (updateError) {
          console.error("Failed to update order status:", updateError);
        }

        console.log(`✅ ${item.networkId} order ${orderId} is processing (manual delivery required)`);
        toast({
          title: `${item.networkId.toUpperCase()} Order Created!`,
          description: `Order for ${item.phoneNumber} is processing.`,
        });
      }

      // ============================================================
      // Handle Data orders - Call place-wallet-order
      // ============================================================
      if (dataItems.length > 0) {
        console.log(`📡 WILL CALL place-wallet-order for ${dataItems.length} data items`);

        const dataPhones = dataItems.map((i) => i.phoneNumber);
        const pendingPhones = dataPhones.length ? await checkPendingOrders(dataPhones) : [];

        if (pendingPhones.length > 0) {
          toast({
            title: "Pending Order Exists",
            description: `Phone number(s) ${pendingPhones.join(", ")} already have a pending/processing order. Wait for delivery first.`,
            variant: "destructive",
          });
          setProcessing(false);
          return;
        }

        // Build data items for backend with proper bundle_size_gb
        const dataItemsForBackend = dataItems.map((item) => {
          const bundleSizeGb = extractBundleSizeGB(item.bundle.size, item.bundle.sizeGB);
          return {
            network: item.network,
            network_id: item.networkId,
            phone: item.phoneNumber,
            bundle: item.bundle.size,
            bundle_size_gb: bundleSizeGb,
            amount: item.effectivePrice,
          };
        });

        console.log("📦 Sending to place-wallet-order:", JSON.stringify(dataItemsForBackend, null, 2));

        const { data, error } = await supabase.functions.invoke("place-wallet-order", {
          body: { items: dataItemsForBackend },
        });

        console.log("📡 Response from place-wallet-order:", { data, error });

        if (error || (data && (data as any).error)) {
          const msg = (data as any)?.error || error?.message || "Order failed";
          throw new Error(msg);
        }

        toast({
          title: "Data Orders Placed!",
          description: `${dataItems.length} data order(s) are processing.`,
        });
      } else {
        console.log("⚠️ No data items to send to place-wallet-order");
      }

      await refreshProfile();
      toast({
        title: "Success!",
        description: `${airtimeMashupItems.length + dataItems.length} order(s) placed.`,
      });
      clearCart();
    } catch (err: any) {
      console.error("Payment error:", err);
      toast({
        title: "Error",
        description: err.message || "Payment failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handlePayWithPaystack = async () => {
    if (!profile) return;

    setProcessing(true);

    const airtimeMashupItems = items.filter((i) => i.networkId === "airtime" || i.networkId === "mashup");
    const dataItems = items.filter((i) => i.networkId !== "airtime" && i.networkId !== "mashup");

    const dataPhones = dataItems.map((i) => i.phoneNumber);
    const pendingPhones = dataPhones.length ? await checkPendingOrders(dataPhones) : [];

    if (pendingPhones.length > 0) {
      toast({
        title: "Pending Order Exists",
        description: `Phone number(s) ${pendingPhones.join(", ")} already have a pending/processing order. Wait for delivery first.`,
        variant: "destructive",
      });
      setProcessing(false);
      return;
    }

    const phones = items.map((i) => i.phoneNumber.replace(/\D/g, "")).filter(Boolean);
    const phoneKey = `${phones[0] || "guest"}-${Date.now()}`;
    const syntheticEmail = `${phoneKey}@donmacdatahub.com`;

    const allItemsForBackend = [
      ...dataItems.map((item) => ({
        network: item.network,
        network_id: item.networkId,
        phone: item.phoneNumber,
        bundle: item.bundle.size,
        bundle_size_gb: extractBundleSizeGB(item.bundle.size, item.bundle.sizeGB),
        amount: item.effectivePrice,
        is_non_gh: false,
      })),
      ...airtimeMashupItems.map((item) => ({
        network: item.network,
        network_id: item.networkId,
        phone: item.phoneNumber,
        bundle: item.bundle.size,
        bundle_size_gb: 0,
        amount:
          item.networkId === "mashup" ? Math.round(item.effectivePrice * (1 + 0.05) * 100) / 100 : item.effectivePrice,
        is_non_gh: true,
      })),
    ];

    await initPaystack({
      email: syntheticEmail,
      amount: paystackTotal,
      onSuccess: async (reference) => {
        try {
          const payload = { reference, items: allItemsForBackend };

          const { data, error } = await supabase.functions.invoke("paystack-verify-order", { body: payload });
          if (error || (data && (data as any).error)) {
            const msg = (data as any)?.error || error?.message || "Payment verification failed";
            throw new Error(msg);
          }

          await refreshProfile();
          toast({ title: "Order Placed!", description: `${items.length} item(s) ordered via Paystack` });
          clearCart();
        } catch (err: any) {
          toast({ title: "Error", description: err.message || "Payment failed", variant: "destructive" });
        } finally {
          setProcessing(false);
        }
      },
      onClose: () => {
        setProcessing(false);
        toast({ title: "Payment Cancelled" });
      },
    });
  };

  return (
    <DashboardLayout title="Cart">
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" /> Shopping Cart ({items.length})
          </h2>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={clearCart}>
                Clear All
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} title="Close cart">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Your cart is empty</p>
            <p className="text-sm">Select data bundles from the dashboard to add them here</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border">
              {items.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center">
                      <span className="text-xs font-bold">{item.network.slice(0, 3)}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {item.network} — {item.bundle.size}
                      </p>
                      <p className="text-sm text-muted-foreground">📞 {item.phoneNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-foreground">{formatCurrency(item.effectivePrice)}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-border space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                {mashupFee > 0 && (
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>MashUp Fee (5%)</span>
                    <span>{formatCurrency(mashupFee)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="text-xl font-bold text-foreground">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              <div>
                <p className="font-semibold text-foreground mb-2">Payment method</p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("wallet")}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-colors ${paymentMethod === "wallet" ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === "wallet" ? "border-primary" : "border-muted-foreground"}`}
                    >
                      {paymentMethod === "wallet" && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
                    </span>
                    <Wallet className="w-5 h-5 text-primary" />
                    <div className="text-left">
                      <p className="font-semibold text-foreground">Pay with Wallet</p>
                      <p className="text-xs text-muted-foreground">
                        Balance: {formatCurrency(profile?.wallet_balance ?? 0)}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("paystack")}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-colors ${paymentMethod === "paystack" ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === "paystack" ? "border-primary" : "border-muted-foreground"}`}
                    >
                      {paymentMethod === "paystack" && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
                    </span>
                    <CreditCard className="w-5 h-5 text-green-600" />
                    <div className="text-left">
                      <p className="font-semibold text-foreground">Pay with Paystack</p>
                      {paymentMethod === "paystack" && (
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(grandTotal)} + {formatCurrency(paystackFee)} fee ={" "}
                          {formatCurrency(paystackTotal)}
                        </p>
                      )}
                    </div>
                  </button>
                </div>
              </div>

              <Button
                className="w-full gradient-primary border-0"
                size="lg"
                disabled={processing}
                onClick={paymentMethod === "wallet" ? handlePayWithWallet : handlePayWithPaystack}
              >
                {processing
                  ? "Processing…"
                  : `Proceed to Pay — ${formatCurrency(paymentMethod === "paystack" ? paystackTotal : grandTotal)}`}
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
