import { useMemo, useState } from "react";
import { Crown, Medal, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/data";

type AdminMonthlyRankingsProps = {
  users: any[];
  orders: any[];
};

type RankedUser = {
  userId: string;
  name: string;
  phone: string;
  tier: string;
  amount: number;
  capacityGb: number;
};

const parseCapacityGb = (bundleSize: string) => {
  const match = String(bundleSize || "").match(/([\d.]+)\s*(GB|MB)/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  if (!Number.isFinite(value)) return 0;
  return match[2].toUpperCase() === "MB" ? value / 1000 : value;
};

const formatCapacity = (gb: number) => {
  if (gb >= 1) return `${gb.toFixed(gb % 1 === 0 ? 0 : 2)}GB`;
  return `${Math.round(gb * 1000)}MB`;
};

const getMonthOrders = (orders: any[], year: number, month: number) => {
  const monthStart = new Date(year, month, 1).getTime();
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
  return orders.filter((order) => {
    const orderTime = new Date(order.created_at).getTime();
    return order.status !== "failed" && orderTime >= monthStart && orderTime <= monthEnd;
  });
};

const buildRankings = (users: any[], monthOrders: any[], tier: "agent" | "general") => {
  const userMap = new Map(users.map((user) => [user.user_id, user]));
  const grouped = new Map<string, RankedUser>();

  monthOrders.forEach((order) => {
    const user = userMap.get(order.user_id);
    if (!user || user.tier !== tier) return;

    const current = grouped.get(order.user_id) || {
      userId: order.user_id,
      name: user.full_name || "Unnamed user",
      phone: user.phone || "—",
      tier,
      amount: 0,
      capacityGb: 0,
    };

    current.amount += Number(order.amount || 0);
    current.capacityGb += parseCapacityGb(order.bundle_size);
    grouped.set(order.user_id, current);
  });

  return Array.from(grouped.values())
    .sort((a, b) => b.capacityGb - a.capacityGb || b.amount - a.amount)
    .slice(0, 3);
};

function RankingTable({ title, icon, rows }: { title: string; icon: React.ReactNode; rows: RankedUser[] }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-foreground">{title}</h3>
        </div>
        <Badge variant="secondary">Monthly Top 3</Badge>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rank</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Number</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Data Capacity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                No purchases this month
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, index) => (
              <TableRow key={row.userId}>
                <TableCell>
                  <Badge className="bg-primary text-primary-foreground">#{index + 1}</Badge>
                </TableCell>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>{row.phone}</TableCell>
                <TableCell className="font-semibold">{formatCurrency(row.amount)}</TableCell>
                <TableCell className="font-semibold text-primary">{formatCapacity(row.capacityGb)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default function AdminMonthlyRankings({ users, orders }: AdminMonthlyRankingsProps) {
  const agentRankings = buildRankings(users, orders, "agent");
  const generalRankings = buildRankings(users, orders, "general");
  const monthName = new Date().toLocaleString("en", { month: "long", year: "numeric" });

  return (
    <section className="mb-5 space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-bold text-foreground">Monthly Data Rankings</h2>
          <p className="text-sm text-muted-foreground">Top buyers for {monthName}, ranked by total data capacity purchased.</p>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <RankingTable title="Agent Ranking" icon={<Crown className="h-4 w-4 text-primary" />} rows={agentRankings} />
        <RankingTable title="General User Ranking" icon={<Medal className="h-4 w-4 text-primary" />} rows={generalRankings} />
      </div>
    </section>
  );
}