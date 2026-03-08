import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/data";
import { format, parseISO, subDays, startOfDay } from "date-fns";
import { Users, ShoppingBag, DollarSign, TrendingUp, AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer } from "recharts";

interface AdminAnalyticsProps {
  users: any[];
  orders: any[];
  topups: any[];
  complaints: any[];
}

const orderChartConfig: ChartConfig = {
  orders: { label: "Orders", color: "hsl(var(--primary))" },
};

const revenueChartConfig: ChartConfig = {
  revenue: { label: "Revenue", color: "hsl(var(--success))" },
};

const PIE_COLORS = [
  "hsl(var(--warning))",
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--destructive))",
];

export default function AdminAnalytics({ users, orders, topups, complaints }: AdminAnalyticsProps) {
  const stats = useMemo(() => {
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.amount), 0);
    const totalTopups = topups.filter(t => t.status === "completed").reduce((sum, t) => sum + Number(t.amount), 0);
    const pendingOrders = orders.filter(o => o.status === "pending" || o.status === "processing").length;
    const completedOrders = orders.filter(o => o.status === "completed").length;
    const failedOrders = orders.filter(o => o.status === "failed").length;
    const openComplaints = complaints.filter(c => c.status === "open").length;
    const totalWalletBalance = users.reduce((sum, u) => sum + Number(u.wallet_balance), 0);
    const blockedUsers = users.filter(u => u.is_blocked).length;
    const pendingTopups = topups.filter(t => t.status === "pending").length;

    return {
      totalUsers: users.length,
      totalRevenue,
      totalTopups,
      totalOrders: orders.length,
      pendingOrders,
      completedOrders,
      failedOrders,
      openComplaints,
      totalComplaints: complaints.length,
      totalWalletBalance,
      blockedUsers,
      pendingTopups,
    };
  }, [users, orders, topups, complaints]);

  // Orders per day (last 7 days)
  const ordersPerDay = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      return { date: startOfDay(date), label: format(date, "EEE") };
    });

    return days.map(({ date, label }) => {
      const count = orders.filter(o => {
        const d = startOfDay(parseISO(o.created_at));
        return d.getTime() === date.getTime();
      }).length;
      return { day: label, orders: count };
    });
  }, [orders]);

  // Revenue per day (last 7 days)
  const revenuePerDay = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      return { date: startOfDay(date), label: format(date, "EEE") };
    });

    return days.map(({ date, label }) => {
      const total = orders
        .filter(o => startOfDay(parseISO(o.created_at)).getTime() === date.getTime())
        .reduce((sum, o) => sum + Number(o.amount), 0);
      return { day: label, revenue: total };
    });
  }, [orders]);

  // Order status distribution
  const orderStatusData = useMemo(() => {
    const statuses = ["pending", "processing", "completed", "failed"];
    return statuses.map(s => ({
      name: s === "completed" ? "Delivered" : s.charAt(0).toUpperCase() + s.slice(1),
      value: orders.filter(o => o.status === s).length,
    })).filter(d => d.value > 0);
  }, [orders]);

  // Network distribution
  const networkData = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach(o => {
      map[o.network] = (map[o.network] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [orders]);

  const networkChartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    networkData.forEach((item, i) => {
      config[item.name] = { label: item.name, color: PIE_COLORS[i % PIE_COLORS.length] };
    });
    return config;
  }, [networkData]);

  const statusChartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    orderStatusData.forEach((item, i) => {
      config[item.name] = { label: item.name, color: PIE_COLORS[i % PIE_COLORS.length] };
    });
    return config;
  }, [orderStatusData]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
                {stats.blockedUsers > 0 && (
                  <p className="text-xs text-destructive">{stats.blockedUsers} blocked</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <ShoppingBag className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold">{stats.totalOrders}</p>
                <p className="text-xs text-muted-foreground">{stats.pendingOrders} pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertCircle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Open Complaints</p>
                <p className="text-2xl font-bold">{stats.openComplaints}</p>
                <p className="text-xs text-muted-foreground">{stats.totalComplaints} total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <DollarSign className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Top-ups</p>
                <p className="text-xl font-bold">{formatCurrency(stats.totalTopups)}</p>
                {stats.pendingTopups > 0 && (
                  <p className="text-xs text-warning">{stats.pendingTopups} pending approval</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Wallet Balance</p>
                <p className="text-xl font-bold">{formatCurrency(stats.totalWalletBalance)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Delivered Orders</p>
                <p className="text-xl font-bold">{stats.completedOrders}</p>
                {stats.failedOrders > 0 && (
                  <p className="text-xs text-destructive">{stats.failedOrders} failed</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Orders per day */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orders (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={orderChartConfig} className="h-[250px] w-full">
              <BarChart data={ordersPerDay}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis allowDecimals={false} className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Revenue per day */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={revenueChartConfig} className="h-[250px] w-full">
              <LineChart data={revenuePerDay}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--success))" strokeWidth={2} dot={{ fill: "hsl(var(--success))" }} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Order Status Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={statusChartConfig} className="h-[250px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie data={orderStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                  {orderStatusData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Network Distribution Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orders by Network</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={networkChartConfig} className="h-[250px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie data={networkData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                  {networkData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
