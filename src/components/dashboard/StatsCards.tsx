import { useState, useEffect } from "react";
import { Wallet, ShoppingCart, CreditCard, Database } from "lucide-react";
import { formatCurrency } from "@/lib/data";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function StatsCards() {
  const { user, profile } = useAuth();
  const [todayOrders, setTodayOrders] = useState(0);
  const [todaySpent, setTodaySpent] = useState(0);
  const [todayData, setTodayData] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: orders } = await supabase
        .from("orders")
        .select("amount, bundle_size, created_at")
        .eq("user_id", user.id);

      if (orders) {
        const todayItems = orders.filter(
          (o) => new Date(o.created_at) >= today
        );
        setTodayOrders(todayItems.length);

        const spent = todayItems.reduce((sum, o) => sum + Number(o.amount), 0);
        setTodaySpent(spent);

        const dataGB = todayItems.reduce((sum, o) => {
          const match = o.bundle_size.match(/(\d+)/);
          return sum + (match ? parseInt(match[1]) : 0);
        }, 0);
        setTodayData(dataGB);
      }
    };
    fetchStats();
  }, [user]);

  const stats = [
    { label: "Wallet Balance", value: formatCurrency(profile?.wallet_balance ?? 0), icon: Wallet, sublabel: "Current Balance", color: "text-primary" },
    { label: "Orders Placed", value: todayOrders.toString(), icon: ShoppingCart, sublabel: "Today's Orders", color: "text-destructive" },
    { label: "Total Payments", value: formatCurrency(todaySpent), icon: CreditCard, sublabel: "Today's Spending", color: "text-success" },
    { label: "Total Capacity", value: `${todayData}GB`, icon: Database, sublabel: "Today's Data", color: "text-primary" },
  ];

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
