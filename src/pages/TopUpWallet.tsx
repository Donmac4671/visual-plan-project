import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, CreditCard, Smartphone, Upload, Copy, CheckCircle } from "lucide-react";
import { formatCurrency, calculatePaystackFee } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { initPaystack } from "@/lib/paystack";

export default function TopUpWallet() {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"momo" | "paystack">("momo");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showMomoDetails, setShowMomoDetails] = useState(false);
  const { toast } = useToast();
  const { user, profile, refreshProfile } = useAuth();

  const quickAmounts = [20, 50, 100, 200, 500];
  const amt = parseFloat(amount) || 0;
  const paystackFee = calculatePaystackFee(amt);
  const paystackTotal = amt + paystackFee;

  const handleMomoTopUp = () => {
    if (!amt || amt < 20) {
      toast({ title: "Error", description: "Minimum top-up amount is ₵20", variant: "destructive" });
      return;
    }
    setShowMomoDetails(true);
  };

  const handleScreenshotUpload = async () => {
    if (!screenshotFile || !user) return;
    setUploading(true);

    const filePath = `${user.id}/${Date.now()}_${screenshotFile.name}`;
    const { error: uploadError } = await supabase.storage
      .from("payment-screenshots")
      .upload(filePath, screenshotFile);

    if (uploadError) {
      toast({ title: "Upload Failed", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("payment-screenshots").getPublicUrl(filePath);

    await supabase.from("wallet_topups").insert({
      user_id: user.id,
      amount: amt,
      method: "momo",
      status: "pending",
      screenshot_url: urlData.publicUrl,
    });

    toast({ title: "Top-up Submitted", description: "Your MoMo payment is pending verification by admin." });
    setAmount("");
    setScreenshotFile(null);
    setShowMomoDetails(false);
    setUploading(false);
  };

  const handlePaystackTopUp = async () => {
    if (!amt || amt < 20) {
      toast({ title: "Error", description: "Minimum top-up amount is ₵20", variant: "destructive" });
      return;
    }
    if (!profile) return;

    // Charge amount + 2% fee via Paystack, but credit only the base amount
    await initPaystack({
      email: profile.email,
      amount: paystackTotal,
      onSuccess: async (reference) => {
        await supabase.rpc("complete_paystack_topup", {
          p_amount: amt,
          p_reference: reference,
        });
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

        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h3 className="font-semibold text-foreground mb-4">Amount (₵) — Min ₵20</h3>
          <Input
            type="number"
            placeholder="Enter amount (min ₵20)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-lg mb-3"
            min={20}
          />
          <div className="flex flex-wrap gap-2">
            {quickAmounts.map((qa) => (
              <Button
                key={qa}
                variant="outline"
                size="sm"
                onClick={() => setAmount(qa.toString())}
                className={amount === qa.toString() ? "border-primary bg-primary/5" : ""}
              >
                ₵{qa}
              </Button>
            ))}
          </div>
          {method === "paystack" && amt >= 20 && (
            <div className="mt-3 p-3 bg-accent rounded-lg text-sm text-muted-foreground">
              Amount: {formatCurrency(amt)} + 2% fee ({formatCurrency(paystackFee)}) = <span className="font-bold text-foreground">{formatCurrency(paystackTotal)}</span>
            </div>
          )}
        </div>

        {showMomoDetails && method === "momo" && (
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
              <div>
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="font-bold text-foreground text-lg">{formatCurrency(amt)}</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block flex items-center gap-2">
                <Upload className="w-4 h-4" /> Upload Payment Screenshot
              </label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setScreenshotFile(e.target.files?.[0] || null)}
                className="cursor-pointer"
              />
            </div>

            <Button
              className="w-full gradient-primary border-0"
              size="lg"
              onClick={handleScreenshotUpload}
              disabled={!screenshotFile || uploading}
            >
              {uploading ? "Uploading..." : "Submit Payment Proof"}
            </Button>
          </div>
        )}

        {!showMomoDetails && (
          <Button
            className="w-full gradient-primary border-0"
            size="lg"
            onClick={method === "momo" ? handleMomoTopUp : handlePaystackTopUp}
          >
            {method === "momo" ? "Proceed to Pay" : `Pay ${amt >= 20 ? formatCurrency(paystackTotal) : ""} with Paystack`}
          </Button>
        )}
      </div>
    </DashboardLayout>
  );
}
