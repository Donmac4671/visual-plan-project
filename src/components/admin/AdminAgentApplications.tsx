import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Eye, CheckCircle, XCircle, Trash2 } from "lucide-react";

interface Props {
  applications: any[];
  onRefresh: () => void;
}

export default function AdminAgentApplications({ applications, onRefresh }: Props) {
  const { toast } = useToast();
  const [viewApp, setViewApp] = useState<any>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejectDialog, setRejectDialog] = useState<any>(null);

  const handleApprove = async (app: any) => {
    // Update application status
    const { error: appError } = await supabase
      .from("agent_applications")
      .update({ status: "approved", admin_notes: "Approved" })
      .eq("id", app.id);

    if (appError) {
      toast({ title: "Failed", description: appError.message, variant: "destructive" });
      return;
    }

    // Upgrade user to agent tier
    const { error: tierError } = await supabase.rpc("admin_set_user_tier", {
      target_user_id: app.user_id,
      new_tier: "agent",
    });

    if (tierError) {
      toast({ title: "Tier upgrade failed", description: tierError.message, variant: "destructive" });
      return;
    }

    toast({ title: "Application Approved", description: `${app.full_name} is now an agent!` });
    onRefresh();
  };

  const handleReject = async () => {
    if (!rejectDialog) return;
    const { error } = await supabase
      .from("agent_applications")
      .update({ status: "rejected", admin_notes: rejectNotes.trim() || "Rejected" })
      .eq("id", rejectDialog.id);

    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Application Rejected" });
    setRejectDialog(null);
    setRejectNotes("");
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("agent_applications").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Application Deleted" });
    onRefresh();
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-500/10 text-yellow-600",
      approved: "bg-success/10 text-success",
      rejected: "bg-destructive/10 text-destructive",
    };
    return <Badge variant="outline" className={styles[status] || ""}>{status}</Badge>;
  };

  return (
    <>
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No agent applications yet
                </TableCell>
              </TableRow>
            ) : (
              applications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell className="text-sm">{format(parseISO(app.created_at), "MMM dd, yyyy")}</TableCell>
                  <TableCell className="font-medium">{app.full_name}</TableCell>
                  <TableCell>{app.email}</TableCell>
                  <TableCell>{app.phone}</TableCell>
                  <TableCell>{app.location || "—"}</TableCell>
                  <TableCell>{statusBadge(app.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setViewApp(app)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      {app.status === "pending" && (
                        <>
                          <Button size="sm" variant="default" onClick={() => handleApprove(app)}>
                            <CheckCircle className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setRejectDialog(app)}>
                            <XCircle className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(app.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* View Dialog */}
      <Dialog open={!!viewApp} onOpenChange={() => setViewApp(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agent Application</DialogTitle>
          </DialogHeader>
          {viewApp && (
            <div className="space-y-3 text-sm">
              <div><span className="font-medium text-muted-foreground">Name:</span> {viewApp.full_name}</div>
              <div><span className="font-medium text-muted-foreground">Email:</span> {viewApp.email}</div>
              <div><span className="font-medium text-muted-foreground">Phone:</span> {viewApp.phone}</div>
              <div><span className="font-medium text-muted-foreground">Location:</span> {viewApp.location || "—"}</div>
              <div><span className="font-medium text-muted-foreground">Reason:</span> {viewApp.reason || "—"}</div>
              <div><span className="font-medium text-muted-foreground">Status:</span> {statusBadge(viewApp.status)}</div>
              {viewApp.screenshot_url && (
                <div>
                  <span className="font-medium text-muted-foreground">Transaction ID:</span> {viewApp.screenshot_url}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => { setRejectDialog(null); setRejectNotes(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Rejecting application from <strong>{rejectDialog?.full_name}</strong></p>
            <Textarea
              placeholder="Reason for rejection (optional)..."
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              rows={3}
            />
            <Button variant="destructive" className="w-full" onClick={handleReject}>Reject Application</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
