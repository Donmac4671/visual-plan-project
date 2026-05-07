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

  // Helper to get bundle size in GB
  const getBundleSizeGB = (bundleSize: string): number => {
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

    if (profile.wallet_balance < grandTotal) {
      toast({ title: "Insufficient Balance", description: "Please top up your wallet first.", variant: "destructive" });
      return;
    }

    const airtimeMashupItems = items.filter((i) => i.networkId === "airtime" || i.networkId === "mashup");
    const dataItems = items.filter((i) => i.networkId !== "airtime" && i.networkId !== "mashup");

    setProcessing(true);

    try {
      // Handle Airtime & Mashup - direct RPC
      for (const item of airtimeMashupItems) {
        const amount =
          item.networkId === "mashup" ? Math.round(item.effectivePrice * (1 + 0.05) * 100) / 100 : item.effectivePrice;

        const { data: orderId, error: orderError } = await supabase.rpc("pay_with_wallet", {
          p_network: item.network,
          p_phone: item.phoneNumber,
          p_bundle: item.bundle.size,
          p_amount: amount,
        });

        if (orderError) throw new Error(`${item.networkId} order failed: ${orderError.message}`);

        await supabase
          .from("orders")
          .update({ status: "processing", gh_reference: `${item.networkId}-manual-${Date.now()}` })
          .eq("id", orderId);

        toast({
          title: `${item.networkId.toUpperCase()} Order Created!`,
          description: `Order for ${item.phoneNumber} is processing.`,
        });
      }

      // Handle Data orders - DIRECT call to fulfill-order (bypass place-wallet-order)
      if (dataItems.length > 0) {
        const dataPhones = dataItems.map((i) => i.phoneNumber);
        const pendingPhones = await checkPendingOrders(dataPhones);

        if (pendingPhones.length > 0) {
          toast({
            title: "Pending Order Exists",
            description: `Phone number(s) ${pendingPhones.join(", ")} already have a pending order.`,
            variant: "destructive",
          });
          setProcessing(false);
          return;
        }

        // Create each order and call fulfill-order directly
        for (const item of dataItems) {
          // Step 1: Create order and deduct wallet
          const { data: orderId, error: orderError } = await supabase.rpc("pay_with_wallet", {
            p_network: item.network,
            p_phone: item.phoneNumber,
            p_bundle: item.bundle.size,
            p_amount: item.effectivePrice,
          });

          if (orderError) throw new Error(`Order failed: ${orderError.message}`);

          // Step 2: Call fulfill-order directly
          const { error: fulfillError } = await supabase.functions.invoke("fulfill-order", {
            body: {
              order_id: orderId,
              network_id: item.networkId,
              phone: item.phoneNumber,
              bundle_size_gb: getBundleSizeGB(item.bundle.size),
            },
          });

          if (fulfillError) {
            console.error("Fulfill order error:", fulfillError);
            toast({
              title: "Warning",
              description: `Order created but processing may be delayed.`,
              variant: "default",
            });
          } else {
            console.log(`✅ Order ${orderId} sent to GHData`);
          }
        }

        toast({ title: "Data Orders Placed!", description: `${dataItems.length} data order(s) are processing.` });
      }

      await refreshProfile();
      toast({ title: "Success!", description: "Orders placed successfully" });
      clearCart();
    } catch (err: any) {
      console.error("Payment error:", err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handlePayWithPaystack = async () => {
    if (!profile) return;
    setProcessing(true);

    const dataItems = items.filter((i) => i.networkId !== "airtime" && i.networkId !== "mashup");
    const dataPhones = dataItems.map((i) => i.phoneNumber);
    const pendingPhones = await checkPendingOrders(dataPhones);

    if (pendingPhones.length > 0) {
      toast({
        title: "Pending Order Exists",
        description: `Phone number(s) ${pendingPhones.join(", ")} already have a pending order.`,
        variant: "destructive",
      });
      setProcessing(false);
      return;
    }

    const phones = items.map((i) => i.phoneNumber.replace(/\D/g, "")).filter(Boolean);
    const syntheticEmail = `${phones[0] || "guest"}-${Date.now()}@donmacdatahub.com`;

    await initPaystack({
      email: syntheticEmail,
      amount: paystackTotal,
      onSuccess: async (reference) => {
        try {
          const { error } = await supabase.functions.invoke("paystack-verify-order", {
            body: {
              reference,
              items: items.map((item) => ({ ...item, bundle_size_gb: getBundleSizeGB(item.bundle.size) })),
            },
          });
          if (error) throw new Error(error.message);
          await refreshProfile();
          toast({ title: "Order Placed!", description: `${items.length} item(s) ordered` });
          clearCart();
        } catch (err: any) {
          toast({ title: "Error", description: err.message, variant: "destructive" });
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
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Your cart is empty</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border">
              {items.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">
                      {item.network} — {item.bundle.size}
                    </p>
                    <p className="text-sm text-muted-foreground">📞 {item.phoneNumber}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold">{formatCurrency(item.effectivePrice)}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-border space-y-4">
              <div className="flex justify-between">
                <span>Total</span>
                <span className="text-xl font-bold">{formatCurrency(grandTotal)}</span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setPaymentMethod("wallet")}
                  className={`flex-1 p-3 rounded-xl border-2 ${paymentMethod === "wallet" ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <Wallet className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <span className="text-sm">Wallet</span>
                </button>
                <button
                  onClick={() => setPaymentMethod("paystack")}
                  className={`flex-1 p-3 rounded-xl border-2 ${paymentMethod === "paystack" ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <CreditCard className="w-5 h-5 mx-auto mb-1 text-green-600" />
                  <span className="text-sm">Paystack</span>
                </button>
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={processing}
                onClick={paymentMethod === "wallet" ? handlePayWithWallet : handlePayWithPaystack}
              >
                {processing
                  ? "Processing…"
                  : `Pay ${formatCurrency(paymentMethod === "paystack" ? paystackTotal : grandTotal)}`}
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
