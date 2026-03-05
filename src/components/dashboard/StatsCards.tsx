import { Wallet, ShoppingCart, CreditCard, Database } from "lucide-react";
import { formatCurrency } from "@/lib/data";

const stats = [
  { label: "Wallet Balance", value: formatCurrency(94.10), icon: Wallet, sublabel: "Current Balance", color: "text-primary" },
  { label: "Orders Placed", value: "36", icon: ShoppingCart, sublabel: "Today's Orders", color: "text-destructive" },
  { label: "Total Payments", value: formatCurrency(284.70), icon: CreditCard, sublabel: "Amount Spent", color: "text-success" },
  { label: "Total Capacity", value: "73GB", icon: Database, sublabel: "Data Purchased", color: "text-primary" },
];

export default function StatsCards() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <stat.icon className={`w-5 h-5 ${stat.color}`} />
            <span className="text-xs text-muted-foreground">{stat.sublabel}</span>
          </div>
          <p className="text-xl lg:text-2xl font-bold text-foreground">{stat.value}</p>
          <p className={`text-xs font-medium mt-1 ${stat.color}`}>{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
