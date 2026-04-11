import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useCart } from "@/contexts/CartContext";
import { formatCurrency, calculatePaystackFee } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Trash2, ShoppingCart, Wallet, CreditCard, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { initPaystack } from "@/lib/paystack";

const fulfillOrder = async (orderId: string, networkId: string, phone: string, bundleSizeGB: number) => {
  try {
    await supabase.functions.invoke("fulfill-order", {
      body: { order_id: orderId, network_id: networkId, phone, bundle_size_gb: bundleSizeGB },
    });
  } catch (err) {
    console.error("Auto-fulfillment error:", err);
  }
};

export default function Cart() {
  const { items, removeItem, clearCart, total } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "paystack">("wallet");
  const [processing, setProcessing] = useState(false);

  const paystackFee = calculatePaystackFee(total);
  const paystackTotal = total + paystackFee;

  const checkPendingOrders = async (phoneNumbers: string[]): Promise<string[]> => {
    const uniquePhones = [...new Set(phoneNumbers)];
    const { data } = await supabase
      .from("orders")
      .select("phone_number")
      .in("phone_number", uniquePhones)
      .in("status", ["pending", "processing"]);
    return data?.map((o) => o.phone_number) || [];
  };

  const handlePayWithWallet = async () => {
    if (!profile) return;
    if (profile.wallet_balance < total) {
      toast({ title: "Insufficient Balance", description: "Please top up your wallet first.", variant: "destructive" });
      return;
    }

    setProcessing(true);
    try {
      const pendingPhones = await checkPendingOrders(items.map((i) => i.phoneNumber));
      if (pendingPhones.length > 0) {
        toast({
          title: "Pending Order Exists",
          description: `Phone number(s) ${pendingPhones.join(", ")} already have a pending/processing order. Wait for delivery first.`,
          variant: "destructive",
        });
        setProcessing(false);
        return;
      }
      for (const item of items) {
        const { data: orderId, error } = await supabase.rpc("pay_with_wallet", {
          p_network: item.network,
          p_phone: item.phoneNumber,
          p_bundle: item.bundle.size,
          p_amount: item.effectivePrice,
        });

        if (error) throw error;

        // Auto-fulfill via GHDataConnect (fire and forget)
        if (orderId) {
          fulfillOrder(orderId, item.networkId, item.phoneNumber, item.bundle.sizeGB);
        }
      }

      await refreshProfile();
      toast({ title: "Order Placed!", description: `${items.length} bundle(s) ordered for ${formatCurrency(total)}` });
      clearCart();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Payment failed", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handlePayWithPaystack = async () => {
    if (!profile) return;

    setProcessing(true);

    // Check for pending orders before initiating payment
    const pendingPhones = await checkPendingOrders(items.map((i) => i.phoneNumber));
    if (pendingPhones.length > 0) {
      toast({
        title: "Pending Order Exists",
        description: `Phone number(s) ${pendingPhones.join(", ")} already have a pending/processing order. Wait for delivery first.`,
        variant: "destructive",
      });
      setProcessing(false);
      return;
    }

    await initPaystack({
      email: profile.email,
      amount: paystackTotal,
      onSuccess: async (reference) => {
        try {
          for (const item of items) {
            const { data: orderId, error } = await supabase.rpc("pay_order_with_paystack", {
              p_network: item.network,
              p_phone: item.phoneNumber,
              p_bundle: item.bundle.size,
              p_amount: item.effectivePrice,
              p_reference: reference,
            });

            if (error) throw error;

            // Auto-fulfill via GHDataConnect (fire and forget)
            if (orderId) {
              fulfillOrder(orderId, item.networkId, item.phoneNumber, item.bundle.sizeGB);
            }
          }

          await refreshProfile();
          toast({ title: "Order Placed!", description: `${items.length} bundle(s) ordered via Paystack` });
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
              <Button variant="ghost" size="sm" className="text-destructive" onClick={clearCart}>Clear All</Button>
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
                      <p className="font-semibold text-foreground">{item.network} — {item.bundle.size}</p>
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
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Total</span>
                <span className="text-xl font-bold text-foreground">{formatCurrency(total)}</span>
              </div>

              <div>
                <p className="font-semibold text-foreground mb-2">Payment method</p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("wallet")}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-colors ${paymentMethod === "wallet" ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === "wallet" ? "border-primary" : "border-muted-foreground"}`}>
                      {paymentMethod === "wallet" && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
                    </span>
                    <Wallet className="w-5 h-5 text-primary" />
                    <div className="text-left">
                      <p className="font-semibold text-foreground">Pay with Wallet</p>
                      <p className="text-xs text-muted-foreground">Balance: {formatCurrency(profile?.wallet_balance ?? 0)}</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("paystack")}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-colors ${paymentMethod === "paystack" ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === "paystack" ? "border-primary" : "border-muted-foreground"}`}>
                      {paymentMethod === "paystack" && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
                    </span>
                    <CreditCard className="w-5 h-5 text-green-600" />
                    <div className="text-left">
                      <p className="font-semibold text-foreground">Pay with Paystack</p>
                      {paymentMethod === "paystack" && (
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(total)} + {formatCurrency(paystackFee)} fee = {formatCurrency(paystackTotal)}
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
                {processing ? "Processing…" : `Proceed to Pay — ${formatCurrency(paymentMethod === "paystack" ? paystackTotal : total)}`}
              </Button>
            </div>
          </>
        )}
      </div>

    </DashboardLayout>
  );
}
