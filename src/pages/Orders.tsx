import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { formatCurrency } from "@/lib/data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, CheckCircle, Clock, XCircle, List, Loader } from "lucide-react";
import { format, isSameDay, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type OrderStatus = "all" | "completed" | "pending" | "processing" | "failed";

const displayStatus = (status: string) => status === "completed" ? "delivered" : status;

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<OrderStatus>("all");

  useEffect(() => {
    if (!user) return;
    const fetchOrders = async () => {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setOrders(data || []);
    };
    fetchOrders();
  }, [user]);

  const statusCounts = useMemo(() => {
    const counts = { all: orders.length, completed: 0, pending: 0, processing: 0, failed: 0 };
    orders.forEach((o) => {
      if (o.status in counts) counts[o.status as keyof typeof counts]++;
    });
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (statusFilter !== "all") {
      result = result.filter((o) => o.status === statusFilter);
    }
    if (selectedDate) {
      result = result.filter((o) => isSameDay(parseISO(o.created_at), selectedDate));
    }
    return result;
  }, [orders, statusFilter, selectedDate]);

  const statusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-success/10 text-success border-success/20";
      case "pending": return "bg-warning/10 text-warning border-warning/20";
      case "processing": return "bg-primary/10 text-primary border-primary/20";
      case "failed": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "";
    }
  };

  const statusTabs: { key: OrderStatus; label: string; icon: any; color: string }[] = [
    { key: "all", label: "All", icon: List, color: "text-foreground" },
    { key: "pending", label: "Pending", icon: Clock, color: "text-warning" },
    { key: "processing", label: "Processing", icon: Loader, color: "text-primary" },
    { key: "completed", label: "Delivered", icon: CheckCircle, color: "text-success" },
    { key: "failed", label: "Failed", icon: XCircle, color: "text-destructive" },
  ];

  return (
    <DashboardLayout title="Orders">
      <div className="grid grid-cols-5 gap-3 mb-4">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`bg-card rounded-xl border p-3 text-center transition-all ${
              statusFilter === tab.key ? "border-primary shadow-md" : "border-border hover:border-primary/30"
            }`}
          >
            <tab.icon className={`w-5 h-5 mx-auto mb-1 ${tab.color}`} />
            <p className="text-lg font-bold text-foreground">{statusCounts[tab.key]}</p>
            <p className="text-xs text-muted-foreground">{tab.label}</p>
          </button>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Order History</h2>
          <div className="flex items-center gap-2">
            {selectedDate && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedDate(undefined)}>Clear</Button>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Filter by date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={selectedDate} onSelect={(date) => setSelectedDate(date)} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Network</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Bundle</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No orders found</TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.order_ref}</TableCell>
                  <TableCell>{format(parseISO(order.created_at), "MMM dd, yyyy")}</TableCell>
                  <TableCell>{order.network}</TableCell>
                  <TableCell>{order.phone_number}</TableCell>
                  <TableCell>{order.bundle_size}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(order.amount)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColor(order.status)}>{order.status}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </DashboardLayout>
  );
}
