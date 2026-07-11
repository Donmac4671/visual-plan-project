import { useEffect, useRef, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useCart } from "@/contexts/CartContext";
import { formatCurrency, calculateMashupFee, calculateTelecelVSFee, getBundlePrice } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Trash2, ShoppingCart, Wallet, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

import { useCustomBundles } from "@/hooks/useCustomBundles";
import { useActivePromo } from "@/hooks/useActivePromo";
import { useResellerPrices } from "@/hooks/useResellerPrices";
import mtnLogo from "@/assets/networks/mtn.png";
import telecelLogo from "@/assets/networks/telecel.png";
import airteltigoLogo from "@/assets/networks/airteltigo.png";
import { Smartphone, Phone as PhoneIcon, MessageSquare } from "lucide-react";

function getNetworkVisual(networkId: string) {
  const id = networkId?.toLowerCase() || "";
  if (id === "mtn" || id === "mashup" || id === "mashup-data" || id === "mashup-combo") return { logo: mtnLogo, bg: "bg-yellow-400" };
  if (id === "telecel" || id === "vs") return { logo: telecelLogo, bg: "bg-red-500" };
  if (id.startsWith("at-") || id === "airteltigo") return { logo: airteltigoLogo, bg: "bg-sky-600" };
  return { logo: null, bg: "bg-muted" };
}

export default function Cart() {
  const { items, removeItem, clearCart, total, updateItemPrice } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "paystack">("wallet");
  const [processing, setProcessing] = useState(false);

  // Re-price cart items against live prices so admin price changes always take effect at checkout
  const { networks: mergedNetworks } = useCustomBundles();
  const userTier = profile?.tier || "general";
  const { applyDiscount } = useActivePromo(userTier);
  const { getPrice: getResellerPrice } = useResellerPrices();
  const repricedRef = useRef<string>("");

  useEffect(() => {
    if (!mergedNetworks || mergedNetworks.length === 0 || items.length === 0) return;
    const sig = items.map((i) => i.id).join("|") + ":" + mergedNetworks.length;
    if (repricedRef.current === sig) return;
    repricedRef.current = sig;

    let changedCount = 0;
    for (const item of items) {
      // Skip non-data manual products (airtime/mashup/vs) — their pricing isn't from custom_bundles
      if (["airtime", "mashup", "vs"].includes(item.networkId)) continue;
      const net = mergedNetworks.find((n) => n.id === item.networkId);
      const liveBundle = net?.bundles.find((b) => b.size === item.bundle.size);
      if (!liveBundle) continue;
      const reseller = getResellerPrice(item.networkId, item.bundle.size);
      const base = reseller ?? getBundlePrice(liveBundle, userTier);
      const live = applyDiscount ? applyDiscount(base) : base;
      if (Math.abs(live - item.effectivePrice) > 0.001) {
        updateItemPrice(item.id, live);
        changedCount++;
      }
    }
    if (changedCount > 0) {
      toast({
        title: "Cart prices updated",
        description: `${changedCount} item(s) updated to current prices.`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergedNetworks, items.length, userTier]);


  const mashupSubtotal = items.filter((i) => i.networkId === "mashup").reduce((sum, i) => sum + i.effectivePrice, 0);
  const mashupFee = calculateMashupFee(mashupSubtotal);
  const vsSubtotal = items.filter((i) => i.networkId === "vs").reduce((sum, i) => sum + i.effectivePrice, 0);
  const vsFee = calculateTelecelVSFee(vsSubtotal);
  const grandTotal = total + mashupFee + vsFee;
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

    const manualNetworkIds = ["airtime", "mashup", "vs", "mashup-data", "mashup-combo"];
    const manualItems = items.filter((i) => manualNetworkIds.includes(i.networkId));
    const dataItems = items.filter((i) => !manualNetworkIds.includes(i.networkId));

    setProcessing(true);

    try {
      // Handle MTN, Airtime, Mashup & Telecel V&S (manual delivery)
      for (const item of manualItems) {
        let amount = item.effectivePrice;
        if (item.networkId === "mashup") amount = item.effectivePrice + calculateMashupFee(item.effectivePrice);
        else if (item.networkId === "vs") amount = item.effectivePrice + calculateTelecelVSFee(item.effectivePrice);

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

      // Handle Data orders - FIXED: Call fulfill-order directly
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

        for (const item of dataItems) {
          // Step 1: Create order and deduct wallet
          const { data: orderId, error: orderError } = await supabase.rpc("pay_with_wallet", {
            p_network: item.network,
            p_phone: item.phoneNumber,
            p_bundle: item.bundle.size,
            p_amount: item.effectivePrice,
          });

          if (orderError) throw new Error(`Order failed: ${orderError.message}`);

          // Step 2: Call fulfill-order directly (same as resend button)
          await supabase.functions.invoke("fulfill-order", {
            body: {
              order_id: orderId,
              network_id: item.networkId,
              phone: item.phoneNumber,
              bundle_size_gb: getBundleSizeGB(item.bundle.size),
            },
          });
        }

        toast({ title: "Data Orders Placed!", description: `${dataItems.length} data order(s) are processing.` });
      }

      await refreshProfile();
      toast({ title: "Success!", description: `${manualItems.length + dataItems.length} order(s) placed.` });
      clearCart();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handlePayWithPaystack = async () => {
    if (!profile) return;
    setProcessing(true);

    const manualNetworkIds = ["airtime", "mashup", "vs", "mashup-data", "mashup-combo"];
    const manualItems = items.filter((i) => manualNetworkIds.includes(i.networkId));
    const dataItems = items.filter((i) => !manualNetworkIds.includes(i.networkId));

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

    const userPhone = (profile?.phone || "").replace(/\D/g, "");
    const firstItemPhone = (items[0]?.phoneNumber || "").replace(/\D/g, "");
    const phoneForEmail = userPhone || firstItemPhone || "guest";
    const syntheticEmail = `${phoneForEmail}+${Date.now()}@donmacdatahub.com`;

    const itemsForBackend = [
      ...dataItems.map((item) => ({
        network: item.network,
        network_id: item.networkId,
        phone: item.phoneNumber,
        bundle: item.bundle.size,
        bundle_size_gb: getBundleSizeGB(item.bundle.size),
        amount: item.effectivePrice,
      })),
      ...manualItems.map((item) => {
        let amount = item.effectivePrice;
        if (item.networkId === "mashup") amount = item.effectivePrice + calculateMashupFee(item.effectivePrice);
        else if (item.networkId === "vs") amount = item.effectivePrice + calculateTelecelVSFee(item.effectivePrice);
        return {
          network: item.network,
          network_id: item.networkId,
          phone: item.phoneNumber,
          bundle: item.bundle.size,
          bundle_size_gb: 0,
          amount,
        };
      }),
    ];

    await initPaystack({
      email: syntheticEmail,
      amount: paystackTotal,
      onSuccess: async (reference) => {
        try {
          const { data, error } = await supabase.functions.invoke("paystack-verify-order", {
            body: { reference, items: itemsForBackend },
          });
          const backendError = (data && (data as any).error) || error?.message;
          if (backendError) {
            // Payment succeeded but order creation failed — credit the wallet so funds aren't lost
            try {
              await supabase.functions.invoke("paystack-verify-topup", {
                body: { reference, amount: paystackTotal, fallback: true },
              });
              await refreshProfile();
              toast({
                title: "Order failed — wallet credited",
                description: `We couldn't place your order (${backendError}). Your payment of ${formatCurrency(paystackTotal)} was credited to your wallet. Please retry from wallet or contact support with reference ${reference}.`,
                variant: "destructive",
              });
            } catch {
              toast({
                title: "Order failed",
                description: `Payment received but order failed: ${backendError}. Contact support with reference ${reference}.`,
                variant: "destructive",
              });
            }
            return;
          }
          await refreshProfile();
          toast({ title: "Order Placed!", description: `${items.length} item(s) ordered via Paystack` });
          clearCart();
        } catch (err: any) {
          toast({
            title: "Error",
            description: `${err.message}. If you were charged, contact support with reference ${reference}.`,
            variant: "destructive",
          });
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
              {items.map((item) => {
                const visual = getNetworkVisual(item.networkId);
                const isMashup = item.networkId === "mashup";
                const isAirtime = item.networkId === "airtime";
                const isVs = item.networkId === "vs";
                return (
                <div key={item.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isMashup ? (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-white" />
                      </div>
                    ) : isVs ? (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-white" />
                      </div>
                    ) : isAirtime ? (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                        <PhoneIcon className="w-5 h-5 text-white" />
                      </div>
                    ) : visual.logo ? (
                      <div className={`w-10 h-10 rounded-full ${visual.bg} flex items-center justify-center overflow-hidden`}>
                        <img src={visual.logo} alt={item.network} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-xs font-bold">{item.network.slice(0, 3)}</span>
                      </div>
                    )}
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
                );
              })}
            </div>

            <div className="p-4 border-t border-border space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                {(mashupFee + vsFee) > 0 && (
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Fee </span>
                    <span>{formatCurrency(mashupFee + vsFee)}</span>
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
