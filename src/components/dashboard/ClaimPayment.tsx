import { Link } from "react-router-dom";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ClaimPayment() {
  return (
    <div className="bg-card rounded-xl p-4 lg:p-5 border border-border shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-success" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Claim Payment</h3>
            <p className="text-xs text-muted-foreground">Claim with transaction ID</p>
          </div>
        </div>
        <Button asChild className="gradient-primary border-0">
          <Link to="/top-up-wallet">
            <CreditCard className="w-4 h-4 mr-1" /> Claim
          </Link>
        </Button>
      </div>
    </div>
  );
}
