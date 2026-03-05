import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, CreditCard, Smartphone } from "lucide-react";
import { formatCurrency } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";

export default function TopUpWallet() {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"momo" | "card">("momo");
  const [momoNumber, setMomoNumber] = useState("");
  const { toast } = useToast();

  const quickAmounts = [10, 20, 50, 100, 200, 500];

  const handleTopUp = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: "Error", description: "Please enter a valid amount", variant: "destructive" });
      return;
    }
    toast({ title: "Top-up Initiated", description: `${formatCurrency(parseFloat(amount))} via ${method === "momo" ? "Mobile Money" : "Card"}` });
    setAmount("");
    setMomoNumber("");
  };

  return (
    <DashboardLayout title="Top Up Wallet">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Current balance */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-6 text-center">
          <Wallet className="w-10 h-10 mx-auto text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Current Balance</p>
          <p className="text-3xl font-bold text-foreground">{formatCurrency(94.10)}</p>
        </div>

        {/* Payment method */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h3 className="font-semibold text-foreground mb-4">Payment Method</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMethod("momo")}
              className={`p-4 rounded-xl border-2 text-center transition-all ${
                method === "momo" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
              }`}
            >
              <Smartphone className="w-6 h-6 mx-auto mb-1 text-primary" />
              <p className="text-sm font-medium">Mobile Money</p>
            </button>
            <button
              onClick={() => setMethod("card")}
              className={`p-4 rounded-xl border-2 text-center transition-all ${
                method === "card" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
              }`}
            >
              <CreditCard className="w-6 h-6 mx-auto mb-1 text-primary" />
              <p className="text-sm font-medium">Bank Card</p>
            </button>
          </div>
        </div>

        {/* Amount */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h3 className="font-semibold text-foreground mb-4">Amount (₵)</h3>
          <Input
            type="number"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-lg mb-3"
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

          {method === "momo" && (
            <div className="mt-4">
              <label className="text-sm font-medium text-foreground mb-1 block">MoMo Number</label>
              <Input placeholder="e.g., 0241234567" value={momoNumber} onChange={(e) => setMomoNumber(e.target.value)} />
            </div>
          )}
        </div>

        <Button className="w-full gradient-primary border-0" size="lg" onClick={handleTopUp}>
          Top Up {amount ? formatCurrency(parseFloat(amount)) : "Wallet"}
        </Button>
      </div>
    </DashboardLayout>
  );
}
