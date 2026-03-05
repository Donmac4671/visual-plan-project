import { useState, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { sampleOrders, formatCurrency } from "@/lib/data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format, isSameDay, parseISO } from "date-fns";

export default function Orders() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const filteredOrders = useMemo(() => {
    if (!selectedDate) return sampleOrders;
    return sampleOrders.filter((order) => isSameDay(parseISO(order.date), selectedDate));
  }, [selectedDate]);

  const statusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-success/10 text-success border-success/20";
      case "pending": return "bg-warning/10 text-warning border-warning/20";
      case "failed": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "";
    }
  };

  return (
    <DashboardLayout title="Orders">
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Order History</h2>
          <div className="flex items-center gap-2">
            {selectedDate && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedDate(undefined)}>
                Clear
              </Button>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Filter by date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => setSelectedDate(date)}
                  initialFocus
                />
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
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No orders found for the selected date
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.id}</TableCell>
                  <TableCell>{format(parseISO(order.date), "MMM dd, yyyy")}</TableCell>
                  <TableCell>{order.network}</TableCell>
                  <TableCell>{order.phoneNumber}</TableCell>
                  <TableCell>{order.bundle}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(order.amount)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColor(order.status)}>
                      {order.status}
                    </Badge>
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
