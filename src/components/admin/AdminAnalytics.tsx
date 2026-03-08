import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/data";
import { format, parseISO, subDays, startOfDay, endOfDay, isBefore, isAfter } from "date-fns";
import { Users, ShoppingBag, DollarSign, TrendingUp, AlertCircle, CheckCircle2, CalendarIcon, X } from "lucide-react";
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

const PIE_COLORS = [
  "hsl(var(--warning))",
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--destructive))",
];

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
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

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
    };
  }, [users, filteredOrders, filteredTopups, filteredComplaints]);

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
