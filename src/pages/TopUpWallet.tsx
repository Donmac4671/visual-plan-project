import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, CreditCard, Smartphone, Copy, CheckCircle, Hash } from "lucide-react";
import { formatCurrency, calculatePaystackFee, getMinTopUp } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { initPaystack } from "@/lib/paystack";

export default function TopUpWallet() {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"momo" | "paystack">("momo");
  const [showMomoDetails, setShowMomoDetails] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [claiming, setClaiming] = useState(false);
  const { toast } = useToast();
  const { user, profile, refreshProfile } = useAuth();

  const tier = profile?.tier ?? "general";
  const minTopUp = getMinTopUp(tier);
  const quickAmounts = tier === "agent" ? [20, 50, 100, 200, 500] : [5, 10, 20, 50, 100];
  const amt = parseFloat(amount) || 0;
  const paystackFee = calculatePaystackFee(amt);
  const paystackTotal = amt + paystackFee;

  const handleMomoTopUp = () => {
    if (!amt || amt < minTopUp) {
      toast({ title: "Error", description: `Minimum top-up amount is ₵${minTopUp}`, variant: "destructive" });
      return;
    }
    setShowMomoDetails(true);
  };

  const handleClaimPayment = async () => {
    if (!transactionId || transactionId.length !== 11) {
      toast({ title: "Error", description: "Please enter a valid 11-digit transaction ID", variant: "destructive" });
      return;
    }

    setClaiming(true);
    try {
      const { error } = await supabase.rpc("claim_verified_topup", {
        p_transaction_id: transactionId,
      });

      if (error) {
        toast({ title: "Claim Failed", description: error.message, variant: "destructive" });
        return;
      }

      await refreshProfile();
      toast({ title: "Payment Claimed!", description: "Your wallet has been credited successfully." });
      setTransactionId("");
      setShowMomoDetails(false);
      setAmount("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setClaiming(false);
    }
  };

  const handlePaystackTopUp = async () => {
    if (!amt || amt < minTopUp) {
      toast({ title: "Error", description: `Minimum top-up amount is ₵${minTopUp}`, variant: "destructive" });
      return;
    }
    const payerEmail = profile?.email || user?.email;
    if (!payerEmail) {
      toast({ title: "Payment Error", description: "Your account email is missing.", variant: "destructive" });
      return;
    }

    await initPaystack({
      email: payerEmail,
      amount: paystackTotal,
      onSuccess: async (reference) => {
        const { data, error } = await supabase.functions.invoke("paystack-verify-topup", {
          body: { reference, amount: amt },
        });

        if (error || (data && (data as any).error)) {
          const msg = (data as any)?.error || error?.message || "Top-up verification failed";
          toast({ title: "Top-up Failed", description: msg, variant: "destructive" });
          return;
        }

        await refreshProfile();
        toast({ title: "Top-up Successful!", description: `${formatCurrency(amt)} has been added to your wallet.` });
        setAmount("");
      },
      onClose: () => {
        toast({ title: "Payment Cancelled", description: "You closed the payment window." });
      },
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: text });
  };

  return (
    <DashboardLayout title="Top Up Wallet">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="bg-card rounded-xl border border-border shadow-sm p-6 text-center">
          <Wallet className="w-10 h-10 mx-auto text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Current Balance</p>
          <p className="text-3xl font-bold text-foreground">{formatCurrency(profile?.wallet_balance ?? 0)}</p>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h3 className="font-semibold text-foreground mb-4">Payment Method</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setMethod("momo"); setShowMomoDetails(false); }}
              className={`p-4 rounded-xl border-2 text-center transition-all ${method === "momo" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
            >
              <Smartphone className="w-6 h-6 mx-auto mb-1 text-primary" />
              <p className="text-sm font-medium">Mobile Money</p>
            </button>
            <button
              onClick={() => { setMethod("paystack"); setShowMomoDetails(false); }}
              className={`p-4 rounded-xl border-2 text-center transition-all ${method === "paystack" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
            >
              <CreditCard className="w-6 h-6 mx-auto mb-1 text-primary" />
              <p className="text-sm font-medium">Paystack</p>
            </button>
          </div>
        </div>

        {method === "paystack" && (
          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <h3 className="font-semibold text-foreground mb-4">Amount (₵) — Min ₵{minTopUp}</h3>
            <Input
              type="number"
              placeholder={`Enter amount (min ₵${minTopUp})`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-lg mb-3"
              min={minTopUp}
            />
            <div className="flex flex-wrap gap-2">
              {quickAmounts.map((qa) => (
                <Button key={qa} variant="outline" size="sm" onClick={() => setAmount(qa.toString())} className={amount === qa.toString() ? "border-primary bg-primary/5" : ""}>
                  ₵{qa}
                </Button>
              ))}
            </div>
            {amt >= minTopUp && (
              <div className="mt-3 p-3 bg-accent rounded-lg text-sm text-muted-foreground">
                Amount: {formatCurrency(amt)} + 2% fee ({formatCurrency(paystackFee)}) = <span className="font-bold text-foreground">{formatCurrency(paystackTotal)}</span>
              </div>
            )}
          </div>
        )}

        {method === "momo" && !showMomoDetails && (
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" /> Send Payment To
            </h3>
            <div className="bg-accent rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">MoMo Number</p>
                  <p className="font-bold text-foreground text-lg">0549358359</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard("0549358359")}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Account Name</p>
                <p className="font-bold text-foreground">Michael Osei</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              After sending the payment, click below to claim with your Transaction ID
            </p>
            <Button className="w-full gradient-primary border-0" size="lg" onClick={() => setShowMomoDetails(true)}>
              I've Sent the Money
            </Button>
          </div>
        )}

        {method === "momo" && showMomoDetails && (
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Hash className="w-5 h-5 text-primary" /> Claim Your Payment
            </h3>
            <p className="text-sm text-muted-foreground">
              Enter the 11-digit Transaction ID you received from your network provider after sending the payment.
            </p>
            <Input
              placeholder="Enter 11-digit Transaction ID"
              value={transactionId}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 11);
                setTransactionId(val);
              }}
              maxLength={11}
              inputMode="numeric"
              className="text-lg text-center tracking-widest"
            />
            {transactionId.length > 0 && transactionId.length < 11 && (
              <p className="text-xs text-destructive">{11 - transactionId.length} more digit(s) needed</p>
            )}
            <Button
              className="w-full gradient-primary border-0"
              size="lg"
              onClick={handleClaimPayment}
              disabled={transactionId.length !== 11 || claiming}
            >
              {claiming ? "Claiming..." : "Claim Payment"}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setShowMomoDetails(false)}>
              ← Back to payment details
            </Button>
          </div>
        )}

        {method === "paystack" && (
          <Button
            className="w-full gradient-primary border-0"
            size="lg"
            onClick={handlePaystackTopUp}
          >
            Pay {amt >= minTopUp ? formatCurrency(paystackTotal) : ""} with Paystack
          </Button>
        )}
      </div>
    </DashboardLayout>
  );
}
