import { Link } from "react-router-dom";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WalletTopUp() {
  return (
    <div className="bg-card rounded-xl p-4 lg:p-5 border border-border shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Wallet Top-up</h3>
            <p className="text-xs text-muted-foreground">Add funds to your wallet</p>
          </div>
        </div>
        <Button asChild className="gradient-primary border-0">
          <Link to="/top-up-wallet">
            <Wallet className="w-4 h-4 mr-1" /> Wallet
          </Link>
        </Button>
      </div>
    </div>
  );
}
