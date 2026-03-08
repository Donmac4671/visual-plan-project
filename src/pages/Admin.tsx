import { useState, useEffect } from "react";
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
import { format, parseISO } from "date-fns";
import { Users, ShoppingBag, Ban, DollarSign, Trash2, MessageSquare } from "lucide-react";

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

  const fetchData = async () => {
    const [{ data: u }, { data: o }, { data: t }, { data: c }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("wallet_topups").select("*").order("created_at", { ascending: false }),
      supabase.from("complaints").select("*").order("created_at", { ascending: false }),
    ]);
    setUsers(u || []);
    setOrders(o || []);
    setTopups(t || []);
    setComplaints(c || []);
  };

  useEffect(() => { if (isAdmin) fetchData(); }, [isAdmin]);

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
    if (error) {
      toast({ title: "Action Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: block ? "User Blocked" : "User Unblocked" });
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
    if (error) {
      toast({ title: "Wallet Action Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Wallet ${walletDialog.type}ed`, description: `${formatCurrency(parseFloat(walletAmount))} ${walletDialog.type}ed` });
    setWalletDialog(null);
    setWalletAmount("");
    setWalletDesc("");
    fetchData();
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.rpc("admin_update_order_status", { order_id: orderId, new_status: status });
    if (error) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
      return;
    }
    const displayLabel = status === "completed" ? "delivered" : status;
    toast({ title: "Order Updated", description: `Status changed to ${displayLabel}` });
    fetchData();
  };

  const handleDeleteOrder = async (orderId: string) => {
    const { error } = await supabase.from("orders").delete().eq("id", orderId);
    if (error) {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Order Deleted" });
    fetchData();
  };

  const handleApproveTopup = async (topup: any) => {
    const { error: walletError } = await supabase.rpc("admin_wallet_operation", {
      target_user_id: topup.user_id,
      operation_amount: topup.amount,
      operation_type: "credit",
      operation_description: "MoMo top-up approved",
    });
    if (walletError) {
      toast({ title: "Approval Failed", description: walletError.message, variant: "destructive" });
      return;
    }

    const { error: topupError } = await supabase.from("wallet_topups").update({ status: "completed" }).eq("id", topup.id);
    if (topupError) {
      toast({ title: "Approval Failed", description: topupError.message, variant: "destructive" });
      return;
    }

    toast({ title: "Top-up Approved" });
    fetchData();
  };

  const handleDeclineTopup = async (topupId: string) => {
    const { error } = await supabase.from("wallet_topups").update({ status: "failed" }).eq("id", topupId);
    if (error) {
      toast({ title: "Decline Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Top-up Declined" });
    fetchData();
  };

  const handleDeleteTopup = async (topupId: string) => {
    const { error } = await supabase.from("wallet_topups").delete().eq("id", topupId);
    if (error) {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Top-up Deleted" });
    fetchData();
  };

  const handleReplyComplaint = async () => {
    if (!replyDialog || !replyText.trim()) return;
    const newStatus = "resolved";
    const { error } = await supabase.from("complaints").update({ admin_reply: replyText.trim(), status: newStatus }).eq("id", replyDialog.id);
    if (error) {
      toast({ title: "Reply Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Complaint replied & resolved" });
    setReplyDialog(null);
    setReplyText("");
    fetchData();
  };

  const handleCloseComplaint = async (id: string) => {
    const { error } = await supabase.from("complaints").update({ status: "closed" }).eq("id", id);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Complaint closed" });
    fetchData();
  };

  return (
    <DashboardLayout title="Admin Panel">
      <Tabs defaultValue="users">
        <TabsList className="mb-4">
          <TabsTrigger value="users" className="gap-2"><Users className="w-4 h-4" /> Users</TabsTrigger>
          <TabsTrigger value="orders" className="gap-2"><ShoppingBag className="w-4 h-4" /> Orders</TabsTrigger>
          <TabsTrigger value="topups" className="gap-2"><DollarSign className="w-4 h-4" /> Top-ups</TabsTrigger>
          <TabsTrigger value="complaints" className="gap-2"><MessageSquare className="w-4 h-4" /> Complaints</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <div className="bg-card rounded-xl border border-border shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.agent_code}</TableCell>
                    <TableCell>{u.full_name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.phone}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(u.wallet_balance)}</TableCell>
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
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="orders">
          <div className="bg-card rounded-xl border border-border shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Network</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Bundle</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Update</TableHead>
                  <TableHead>Delete</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.order_ref}</TableCell>
                    <TableCell className="text-sm">{format(parseISO(o.created_at), "MMM dd, yyyy • HH:mm")}</TableCell>
                    <TableCell>{o.network}</TableCell>
                    <TableCell>{o.phone_number}</TableCell>
                    <TableCell>{o.bundle_size}</TableCell>
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
                    <TableCell>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteOrder(o.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="topups">
          <div className="bg-card rounded-xl border border-border shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Screenshot</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topups.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.user_id.slice(0, 8)}...</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(t.amount)}</TableCell>
                    <TableCell className="capitalize">{t.method}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        t.status === "completed" ? "bg-success/10 text-success" :
                        t.status === "pending" ? "bg-warning/10 text-warning" :
                        "bg-destructive/10 text-destructive"
                      }>{t.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {t.screenshot_url ? (
                        <a href={t.screenshot_url} target="_blank" rel="noreferrer" className="text-primary underline text-sm">View</a>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {t.status === "pending" && (
                          <>
                            <Button size="sm" onClick={() => handleApproveTopup(t)}>Approve</Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDeclineTopup(t.id)}>Decline</Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteTopup(t.id)}>
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

        <TabsContent value="complaints">
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
                {complaints.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No complaints</TableCell>
                  </TableRow>
                ) : (
                  complaints.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm">{format(parseISO(c.created_at), "MMM dd, yyyy • HH:mm")}</TableCell>
                      <TableCell className="text-sm">{c.user_id.slice(0, 8)}...</TableCell>
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

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
