import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/data";
import { format, parseISO, subDays, startOfDay, endOfDay, isBefore, isAfter } from "date-fns";
import { Users, ShoppingBag, DollarSign, TrendingUp, AlertCircle, CheckCircle2, CalendarIcon, X, RefreshCw, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

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

const profitChartConfig: ChartConfig = {
  profit: { label: "Profit", color: "hsl(var(--primary))" },
};

const PIE_COLORS = [
  "hsl(var(--warning))",
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--destructive))",
];

// Original cost prices per network/bundle
const ORIGINAL_PRICES: Record<string, Record<string, number>> = {
  "MTN": {
    '1GB': 3.94, '2GB': 7.98, '3GB': 12.00, '4GB': 16.06, '5GB': 20.10,
    '6GB': 23.94, '8GB': 32.12, '10GB': 39.30, '15GB': 57.77, '20GB': 76.96,
    '25GB': 97.16, '30GB': 117.67, '40GB': 154.53, '50GB': 194.93,
  },
  "TELECEL": {
    '2GB': 9.09, '3GB': 13.54, '5GB': 19.09, '10GB': 36.26, '15GB': 53.43,
    '20GB': 70.70, '30GB': 104.03, '40GB': 138.37, '50GB': 172.71,
  },
  "AT BIG TIME": {
    '15GB': 47.47, '20GB': 55.55, '30GB': 65.65, '40GB': 78.78, '50GB': 86.86,
    '60GB': 98.98, '70GB': 121.20, '80GB': 141.40, '90GB': 151.50,
    '100GB': 161.60, '130GB': 202.00, '140GB': 225.23, '150GB': 250.48, '200GB': 321.18,
  },
  "AT PREMIUM": {
    '1GB': 3.73, '2GB': 7.46, '3GB': 11.21, '4GB': 14.95, '5GB': 18.69,
    '6GB': 22.42, '7GB': 26.16, '8GB': 29.90, '10GB': 37.27, '12GB': 44.84,
    '15GB': 56.05, '20GB': 74.74, '25GB': 93.43, '30GB': 112.11,
  },
};

function getOrderCost(network: string, bundleSize: string): number {
  return ORIGINAL_PRICES[network]?.[bundleSize] ?? 0;
}

function DateFilter({ dateFrom, dateTo, onDateFromChange, onDateToChange, onClear }: {
  dateFrom?: Date;
  dateTo?: Date;
  onDateFromChange: (d?: Date) => void;
  onDateToChange: (d?: Date) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("text-xs gap-1", !dateFrom && "text-muted-foreground")}>
            <CalendarIcon className="w-3 h-3" />
            {dateFrom ? format(dateFrom, "MMM dd, yyyy") : "From date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={dateFrom} onSelect={onDateFromChange} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("text-xs gap-1", !dateTo && "text-muted-foreground")}>
            <CalendarIcon className="w-3 h-3" />
            {dateTo ? format(dateTo, "MMM dd, yyyy") : "To date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={dateTo} onSelect={onDateToChange} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
      {(dateFrom || dateTo) && (
        <Button variant="ghost" size="sm" className="text-xs gap-1 text-destructive" onClick={onClear}>
          <X className="w-3 h-3" /> Clear
        </Button>
      )}
    </div>
  );
}

export default function AdminAnalytics({ users, orders, topups, complaints }: AdminAnalyticsProps) {
  const today = new Date();
  const [dateFrom, setDateFrom] = useState<Date | undefined>(today);
  const [dateTo, setDateTo] = useState<Date | undefined>(today);
  const [ghBalance, setGhBalance] = useState<number | null>(null);
  const [ghBalanceLoading, setGhBalanceLoading] = useState(false);

  const fetchGhBalance = async () => {
    setGhBalanceLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ghconnect-balance");
      if (error) throw error;
      if (data?.success && data?.data) {
        const bal = data.data.balance ?? data.data.wallet_balance ?? data.data.data?.balance;
        setGhBalance(typeof bal === "number" ? bal : parseFloat(bal));
      }
    } catch (err) {
      console.error("Failed to fetch GH balance:", err);
    } finally {
      setGhBalanceLoading(false);
    }
  };

  useEffect(() => { fetchGhBalance(); }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const d = parseISO(o.created_at);
      if (dateFrom && isBefore(d, startOfDay(dateFrom))) return false;
      if (dateTo && isAfter(d, endOfDay(dateTo))) return false;
      return true;
    });
  }, [orders, dateFrom, dateTo]);

  const filteredTopups = useMemo(() => {
    return topups.filter(t => {
      const d = parseISO(t.created_at);
      if (dateFrom && isBefore(d, startOfDay(dateFrom))) return false;
      if (dateTo && isAfter(d, endOfDay(dateTo))) return false;
      return true;
    });
  }, [topups, dateFrom, dateTo]);

  const filteredComplaints = useMemo(() => {
    return complaints.filter(c => {
      const d = parseISO(c.created_at);
      if (dateFrom && isBefore(d, startOfDay(dateFrom))) return false;
      if (dateTo && isAfter(d, endOfDay(dateTo))) return false;
      return true;
    });
  }, [complaints, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + Number(o.amount), 0);
    const totalTopups = filteredTopups.filter(t => t.status === "completed").reduce((sum, t) => sum + Number(t.amount), 0);
    const pendingOrders = filteredOrders.filter(o => o.status === "pending" || o.status === "processing").length;
    const completedOrders = filteredOrders.filter(o => o.status === "completed").length;
    const failedOrders = filteredOrders.filter(o => o.status === "failed").length;
    const openComplaints = filteredComplaints.filter(c => c.status === "open").length;
    const totalWalletBalance = users.reduce((sum, u) => sum + Number(u.wallet_balance), 0);
    const blockedUsers = users.filter(u => u.is_blocked).length;
    const pendingTopups = filteredTopups.filter(t => t.status === "pending").length;

    const totalCost = filteredOrders.reduce((sum, o) => sum + getOrderCost(o.network, o.bundle_size), 0);
    const totalProfit = totalRevenue - totalCost;

    return {
      totalUsers: users.length,
      totalRevenue,
      totalTopups,
      totalOrders: filteredOrders.length,
      pendingOrders,
      completedOrders,
      failedOrders,
      openComplaints,
      totalComplaints: filteredComplaints.length,
      totalWalletBalance,
      blockedUsers,
      pendingTopups,
      totalCost,
      totalProfit,
    };
  }, [users, filteredOrders, filteredTopups, filteredComplaints]);

  // Profit per day (last 7 days)
  const profitPerDay = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(dateTo || new Date(), 6 - i);
      return { date: startOfDay(date), label: format(date, "EEE dd") };
    });

    return days.map(({ date, label }) => {
      const dayOrders = filteredOrders.filter(o => startOfDay(parseISO(o.created_at)).getTime() === date.getTime());
      const revenue = dayOrders.reduce((sum, o) => sum + Number(o.amount), 0);
      const cost = dayOrders.reduce((sum, o) => sum + getOrderCost(o.network, o.bundle_size), 0);
      return { day: label, profit: Math.round((revenue - cost) * 100) / 100 };
    });
  }, [filteredOrders, dateTo]);

  // Orders per day (last 7 days or within date range)
  const ordersPerDay = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(dateTo || new Date(), 6 - i);
      return { date: startOfDay(date), label: format(date, "EEE dd") };
    });

    return days.map(({ date, label }) => {
      const count = filteredOrders.filter(o => {
        const d = startOfDay(parseISO(o.created_at));
        return d.getTime() === date.getTime();
      }).length;
      return { day: label, orders: count };
    });
  }, [filteredOrders, dateTo]);

  // Revenue per day (last 7 days or within date range)
  const revenuePerDay = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(dateTo || new Date(), 6 - i);
      return { date: startOfDay(date), label: format(date, "EEE dd") };
    });

    return days.map(({ date, label }) => {
      const total = filteredOrders
        .filter(o => startOfDay(parseISO(o.created_at)).getTime() === date.getTime())
        .reduce((sum, o) => sum + Number(o.amount), 0);
      return { day: label, revenue: total };
    });
  }, [filteredOrders, dateTo]);

  // Order status distribution
  const orderStatusData = useMemo(() => {
    const statuses = ["pending", "processing", "completed", "failed"];
    return statuses.map(s => ({
      name: s === "completed" ? "Delivered" : s.charAt(0).toUpperCase() + s.slice(1),
      value: filteredOrders.filter(o => o.status === s).length,
    })).filter(d => d.value > 0);
  }, [filteredOrders]);

  // Network distribution
  const networkData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredOrders.forEach(o => {
      map[o.network] = (map[o.network] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredOrders]);

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
      {/* Date Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Filter by date:</span>
        <DateFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onClear={() => { setDateFrom(undefined); setDateTo(undefined); }}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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

        <Card className="border-success/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <DollarSign className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Profit</p>
                <p className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(stats.totalProfit)}</p>
                <p className="text-xs text-muted-foreground">Cost: {formatCurrency(stats.totalCost)}</p>
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

      {/* GHDataConnect Balance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">GHDataConnect Balance</p>
                  <p className="text-2xl font-bold">
                    {ghBalance !== null ? formatCurrency(ghBalance) : "—"}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={fetchGhBalance} disabled={ghBalanceLoading}>
                <RefreshCw className={`w-4 h-4 ${ghBalanceLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
