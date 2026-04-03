import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/data";
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { Users, ShoppingBag, Ban, DollarSign, Trash2, MessageSquare, Search, CalendarIcon, BarChart3, Crown, Wifi, Percent, Shield, Hash, Megaphone, Copy, RotateCcw } from "lucide-react";
import AdminAnalytics from "@/components/admin/AdminAnalytics";
import AdminAgentApplications from "@/components/admin/AdminAgentApplications";
import AdminBundleManager from "@/components/admin/AdminBundleManager";
import AdminPromoManager from "@/components/admin/AdminPromoManager";
import AdminVerifiedTopups from "@/components/admin/AdminVerifiedTopups";
import AdminSiteMessage from "@/components/admin/AdminSiteMessage";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export default function Admin() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [topups, setTopups] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [walletDialog, setWalletDialog] = useState<{ user: any; type: "credit" | "debit" } | null>(null);
  const [walletAmount, setWalletAmount] = useState("");
  const [walletDesc, setWalletDesc] = useState("");
  const [replyDialog, setReplyDialog] = useState<any | null>(null);
  const [replyText, setReplyText] = useState("");
  const [agentApplications, setAgentApplications] = useState<any[]>([]);
  const [adminUserIds, setAdminUserIds] = useState<Set<string>>(new Set());

  // Filters
  const [userSearch, setUserSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [orderPhoneSearch, setOrderPhoneSearch] = useState("");
  const today = new Date();
  const [orderDateFrom, setOrderDateFrom] = useState<Date | undefined>(today);
  const [orderDateTo, setOrderDateTo] = useState<Date | undefined>(today);
  const [complaintStatusFilter, setComplaintStatusFilter] = useState("all");
  const [complaintDateFrom, setComplaintDateFrom] = useState<Date | undefined>(today);
  const [complaintDateTo, setComplaintDateTo] = useState<Date | undefined>(today);

  const fetchData = async () => {
    const [{ data: u }, { data: o }, { data: t }, { data: c }, { data: aa }, { data: ur }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("wallet_topups").select("*").order("created_at", { ascending: false }),
      supabase.from("complaints").select("*").order("created_at", { ascending: false }),
      supabase.from("agent_applications").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
    ]);
    setUsers(u || []);
    setOrders(o || []);
    setTopups(t || []);
    setComplaints(c || []);
    setAgentApplications(aa || []);
    if (ur) {
      const admins = new Set<string>();
      (ur as any[]).forEach((r) => { if (r.role === "admin") admins.add(r.user_id); });
      setAdminUserIds(admins);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchData();

    const ordersChannel = supabase
      .channel('admin-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(ordersChannel); };
  }, [isAdmin]);

  // Filtered data
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const q = userSearch.toLowerCase();
    return users.filter(u =>
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      u.agent_code?.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const filterByDate = (items: any[], dateFrom?: Date, dateTo?: Date) => {
    return items.filter(item => {
      const d = parseISO(item.created_at);
      if (dateFrom && isBefore(d, startOfDay(dateFrom))) return false;
      if (dateTo && isAfter(d, endOfDay(dateTo))) return false;
      return true;
    });
  };

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (orderStatusFilter !== "all") result = result.filter(o => o.status === orderStatusFilter);
    if (orderPhoneSearch.trim()) result = result.filter(o => o.phone_number?.includes(orderPhoneSearch.trim()));
    return filterByDate(result, orderDateFrom, orderDateTo);
  }, [orders, orderStatusFilter, orderPhoneSearch, orderDateFrom, orderDateTo]);

  const filteredComplaints = useMemo(() => {
    let result = complaints;
    if (complaintStatusFilter !== "all") result = result.filter(c => c.status === complaintStatusFilter);
    return filterByDate(result, complaintDateFrom, complaintDateTo);
  }, [complaints, complaintStatusFilter, complaintDateFrom, complaintDateTo]);

  if (!isAdmin) {
    return (
      <DashboardLayout title="Admin">
        <div className="text-center py-20 text-muted-foreground">
          <Ban className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Access Denied</p>
        </div>
      </DashboardLayout>
    );
  }

  const handleToggleBlock = async (userId: string, block: boolean) => {
    const { error } = await supabase.rpc("admin_toggle_block", { target_user_id: userId, block_status: block });
    if (error) { toast({ title: "Action Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: block ? "User Blocked" : "User Unblocked" });
    fetchData();
  };

  const handleSetTier = async (userId: string, newTier: string) => {
    const { error } = await supabase.rpc("admin_set_user_tier", { target_user_id: userId, new_tier: newTier });
    if (error) { toast({ title: "Tier Update Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Tier Updated", description: `User set to ${newTier}` });
    fetchData();
  };

  const handleToggleAdmin = async (userId: string, makeAdmin: boolean) => {
    const { error } = await supabase.rpc("admin_toggle_admin_role", { target_user_id: userId, make_admin: makeAdmin });
    if (error) { toast({ title: "Role Update Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: makeAdmin ? "User is now Admin" : "Admin role removed" });
    fetchData();
  };

  const handleWalletOp = async () => {
    if (!walletDialog || !walletAmount) return;
    const { error } = await supabase.rpc("admin_wallet_operation", {
      target_user_id: walletDialog.user.user_id,
      operation_amount: parseFloat(walletAmount),
      operation_type: walletDialog.type,
      operation_description: walletDesc || `Admin ${walletDialog.type}`,
    });
    if (error) { toast({ title: "Wallet Action Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Wallet ${walletDialog.type}ed`, description: `${formatCurrency(parseFloat(walletAmount))} ${walletDialog.type}ed` });
    setWalletDialog(null); setWalletAmount(""); setWalletDesc("");
    fetchData();
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.rpc("admin_update_order_status", { order_id: orderId, new_status: status });
    if (error) { toast({ title: "Update Failed", description: error.message, variant: "destructive" }); return; }
    const displayLabel = status === "completed" ? "delivered" : status;
    toast({ title: "Order Updated", description: `Status changed to ${displayLabel}` });
    fetchData();
  };

  const handleDeleteOrder = async (orderId: string) => {
    const { error } = await supabase.from("orders").delete().eq("id", orderId);
    if (error) { toast({ title: "Delete Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Order Deleted" });
    fetchData();
  };

  const handleReplyComplaint = async () => {
    if (!replyDialog || !replyText.trim()) return;
    const { error } = await supabase.from("complaints").update({ admin_reply: replyText.trim(), status: "resolved" }).eq("id", replyDialog.id);
    if (error) { toast({ title: "Reply Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Complaint replied & resolved" });
    setReplyDialog(null); setReplyText("");
    fetchData();
  };

  const handleRetryOrder = async (order: any) => {
    const bundleSizeGB = parseFloat(order.bundle_size.replace(/[^\d.]/g, ""));
    if (!bundleSizeGB) {
      toast({ title: "Retry Failed", description: "Could not parse bundle size", variant: "destructive" });
      return;
    }
    // Set back to processing first
    await supabase.rpc("admin_update_order_status", { order_id: order.id, new_status: "processing" });
    fetchData();
    toast({ title: "Retrying order...", description: `${order.network} ${order.bundle_size} to ${order.phone_number}` });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        toast({ title: "Retry Failed", description: "No active session. Please sign in again.", variant: "destructive" });
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fulfill-order`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ order_id: order.id, network_id: order.network, phone: order.phone_number, bundle_size_gb: bundleSizeGB }),
        }
      );

      const result = await res.json();
      console.log("Retry fulfill-order response:", res.status, JSON.stringify(result));

      if (!res.ok || !result.success) {
        toast({ title: "Retry Failed", description: result.message || `Error ${res.status}`, variant: "destructive" });
      } else {
        toast({ title: "Order Retried", description: "Order sent to provider successfully" });
      }
      fetchData();
    } catch (err: any) {
      console.error("Retry catch error:", err);
      toast({ title: "Retry Failed", description: err.message || "Unknown error", variant: "destructive" });
      fetchData();
    }
  };

  const handleCloseComplaint = async (id: string) => {
    const { error } = await supabase.from("complaints").update({ status: "closed" }).eq("id", id);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Complaint closed" });
    fetchData();
  };

  return (
    <DashboardLayout title="Admin Panel">
      <Tabs defaultValue="analytics">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="analytics" className="gap-2"><BarChart3 className="w-4 h-4" /> Analytics</TabsTrigger>
          <TabsTrigger value="users" className="gap-2"><Users className="w-4 h-4" /> Users</TabsTrigger>
          <TabsTrigger value="orders" className="gap-2"><ShoppingBag className="w-4 h-4" /> Orders</TabsTrigger>
          <TabsTrigger value="verified-id" className="gap-2"><Hash className="w-4 h-4" /> Verified ID</TabsTrigger>
          <TabsTrigger value="complaints" className="gap-2"><MessageSquare className="w-4 h-4" /> Complaints</TabsTrigger>
          <TabsTrigger value="agent-apps" className="gap-2"><Crown className="w-4 h-4" /> Agent Apps</TabsTrigger>
          <TabsTrigger value="bundles" className="gap-2"><Wifi className="w-4 h-4" /> Bundles</TabsTrigger>
          <TabsTrigger value="promos" className="gap-2"><Percent className="w-4 h-4" /> Promos</TabsTrigger>
          <TabsTrigger value="site-message" className="gap-2"><Megaphone className="w-4 h-4" /> Message</TabsTrigger>
        </TabsList>

        {/* ANALYTICS TAB */}
        <TabsContent value="analytics">
          <AdminAnalytics users={users} orders={orders} topups={topups} complaints={complaints} />
        </TabsContent>

        {/* USERS TAB */}
        <TabsContent value="users">
          <div className="mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone, or agent code..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No users found</TableCell></TableRow>
                ) : filteredUsers.map((u) => {
                  const isUserAdmin = adminUserIds.has(u.user_id);
                  return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.agent_code || "—"}</TableCell>
                    <TableCell>{u.full_name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.phone}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(u.wallet_balance)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={u.tier === "agent" ? "bg-primary/10 text-primary cursor-pointer" : "bg-muted text-muted-foreground cursor-pointer"}
                        onClick={() => handleSetTier(u.user_id, u.tier === "agent" ? "general" : "agent")}
                      >
                        {u.tier === "agent" ? "Agent" : "General"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={isUserAdmin ? "bg-amber-500/10 text-amber-600 cursor-pointer" : "bg-muted text-muted-foreground cursor-pointer"}
                        onClick={() => handleToggleAdmin(u.user_id, !isUserAdmin)}
                      >
                        <Shield className="w-3 h-3 mr-1" />
                        {isUserAdmin ? "Admin" : "User"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={u.is_blocked ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}>
                        {u.is_blocked ? "Blocked" : "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setWalletDialog({ user: u, type: "credit" })}>Credit</Button>
                        <Button size="sm" variant="outline" onClick={() => setWalletDialog({ user: u, type: "debit" })}>Debit</Button>
                        <Button size="sm" variant={u.is_blocked ? "default" : "destructive"} onClick={() => handleToggleBlock(u.user_id, !u.is_blocked)}>
                          {u.is_blocked ? "Unblock" : "Block"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ORDERS TAB */}
        <TabsContent value="orders">
          <div className="mb-4 flex flex-wrap gap-3 items-end">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search phone number" value={orderPhoneSearch} onChange={e => setOrderPhoneSearch(e.target.value)} className="pl-8 w-[200px]" />
            </div>
            <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter by status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Delivered</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !orderDateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {orderDateFrom ? format(orderDateFrom, "MMM dd, yyyy") : "From date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={orderDateFrom} onSelect={setOrderDateFrom} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !orderDateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {orderDateTo ? format(orderDateTo, "MMM dd, yyyy") : "To date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={orderDateTo} onSelect={setOrderDateTo} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
            {(orderDateFrom || orderDateTo) && <Button variant="ghost" size="sm" onClick={() => { setOrderDateFrom(undefined); setOrderDateTo(undefined); }}>Clear dates</Button>}
          </div>
          <div className="bg-card rounded-xl border border-border shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref</TableHead>
                  <TableHead>Network</TableHead>
                  <TableHead>Bundle</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Update</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Delete</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No orders found</TableCell></TableRow>
                ) : filteredOrders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <div>
                          <span className="font-medium">{o.order_ref}</span>
                          {(() => {
                            const orderUser = users.find(u => u.user_id === o.user_id);
                            return orderUser ? <p className="text-xs text-muted-foreground">{orderUser.full_name}</p> : null;
                          })()}
                        </div>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => {
                          navigator.clipboard.writeText(o.phone_number);
                          toast({ title: "Copied!", description: `${o.phone_number} copied` });
                        }}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>{o.network}</TableCell>
                    <TableCell>{o.bundle_size}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span>{o.phone_number}</span>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => {
                          navigator.clipboard.writeText(o.phone_number);
                          toast({ title: "Copied!", description: `${o.phone_number} copied` });
                        }}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">{formatCurrency(o.amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        o.status === "completed" ? "bg-success/10 text-success" :
                        o.status === "pending" ? "bg-warning/10 text-warning" :
                        o.status === "processing" ? "bg-primary/10 text-primary" :
                        "bg-destructive/10 text-destructive"
                      }>{o.status === "completed" ? "delivered" : o.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Select value={o.status} onValueChange={(val) => handleUpdateOrderStatus(o.id, val)}>
                        <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="completed">Delivered</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm">{format(parseISO(o.created_at), "MMM dd, yyyy • HH:mm")}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {o.status === "failed" && (
                          <Button size="sm" variant="outline" className="text-primary" onClick={() => handleRetryOrder(o)}>
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteOrder(o.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* VERIFIED ID TAB */}
        <TabsContent value="verified-id">
          <AdminVerifiedTopups users={users} />
        </TabsContent>

        {/* COMPLAINTS TAB */}
        <TabsContent value="complaints">
          <div className="mb-4 flex flex-wrap gap-3 items-end">
            <Select value={complaintStatusFilter} onValueChange={setComplaintStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter by status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !complaintDateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {complaintDateFrom ? format(complaintDateFrom, "MMM dd, yyyy") : "From date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={complaintDateFrom} onSelect={setComplaintDateFrom} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !complaintDateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {complaintDateTo ? format(complaintDateTo, "MMM dd, yyyy") : "To date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={complaintDateTo} onSelect={setComplaintDateTo} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
            {(complaintDateFrom || complaintDateTo) && <Button variant="ghost" size="sm" onClick={() => { setComplaintDateFrom(undefined); setComplaintDateTo(undefined); }}>Clear dates</Button>}
          </div>
          <div className="bg-card rounded-xl border border-border shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComplaints.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No complaints found</TableCell></TableRow>
                ) : filteredComplaints.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{format(parseISO(c.created_at), "MMM dd, yyyy • HH:mm")}</TableCell>
                    <TableCell className="text-sm">{users.find(u => u.user_id === c.user_id)?.full_name || c.user_id.slice(0, 8) + "..."}</TableCell>
                    <TableCell>{c.order_ref || "—"}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{c.subject}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{c.message}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        c.status === "open" ? "bg-warning/10 text-warning" :
                        c.status === "resolved" ? "bg-success/10 text-success" :
                        "bg-muted text-muted-foreground"
                      }>{c.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {c.status === "open" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => { setReplyDialog(c); setReplyText(c.admin_reply || ""); }}>Reply</Button>
                            <Button size="sm" variant="secondary" onClick={() => handleCloseComplaint(c.id)}>Close</Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* AGENT APPLICATIONS TAB */}
        <TabsContent value="agent-apps">
          <AdminAgentApplications applications={agentApplications} onRefresh={fetchData} />
        </TabsContent>

        {/* BUNDLES TAB */}
        <TabsContent value="bundles">
          <AdminBundleManager />
        </TabsContent>

        {/* PROMOS TAB */}
        <TabsContent value="promos">
          <AdminPromoManager />
        </TabsContent>

        {/* SITE MESSAGE TAB */}
        <TabsContent value="site-message">
          <AdminSiteMessage />
        </TabsContent>
      </Tabs>

      {/* Wallet Dialog */}
      <Dialog open={!!walletDialog} onOpenChange={() => setWalletDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{walletDialog?.type === "credit" ? "Credit" : "Debit"} Wallet — {walletDialog?.user?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Input type="number" placeholder="Amount (₵)" value={walletAmount} onChange={(e) => setWalletAmount(e.target.value)} />
            <Input placeholder="Description (optional)" value={walletDesc} onChange={(e) => setWalletDesc(e.target.value)} />
            <Button className="w-full gradient-primary border-0" onClick={handleWalletOp}>
              {walletDialog?.type === "credit" ? "Credit" : "Debit"} {walletAmount ? formatCurrency(parseFloat(walletAmount)) : ""}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reply Dialog */}
      <Dialog open={!!replyDialog} onOpenChange={() => setReplyDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reply to Complaint</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            <div className="bg-muted p-3 rounded-lg text-sm">
              <p className="font-medium">{replyDialog?.subject}</p>
              <p className="text-muted-foreground mt-1">{replyDialog?.message}</p>
            </div>
            <Textarea placeholder="Type your reply..." value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3} />
            <Button className="w-full gradient-primary border-0" onClick={handleReplyComplaint}>Send Reply & Resolve</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
