import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Send, Bell, Trash2, RotateCw } from "lucide-react";
import { format, parseISO } from "date-fns";

type Broadcast = {
  id: string;
  title: string;
  message: string;
  url: string;
  audience: "all" | "general" | "agent";
  recipients_count: number;
  created_at: string;
};

export default function AdminBroadcast() {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("/dashboard");
  const [audience, setAudience] = useState<"all" | "general" | "agent">("all");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<Broadcast[]>([]);

  const loadHistory = async () => {
    const { data } = await supabase
      .from("broadcasts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setHistory((data ?? []) as Broadcast[]);
  };

  useEffect(() => { loadHistory(); }, []);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Title and message are required", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("broadcast-push", {
        body: { title: title.trim(), message: message.trim(), url: url.trim() || "/dashboard", audience },
      });
      if (error) throw error;
      toast({
        title: "Broadcast sent",
        description: `Delivered to ${data?.sent ?? 0} device(s) across ${data?.recipients ?? 0} user(s).`,
      });
      setTitle(""); setMessage(""); setUrl("/dashboard");
      loadHistory();
    } catch (e: any) {
      toast({ title: "Broadcast failed", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("broadcasts").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Deleted" });
    loadHistory();
  };

  const [resendingId, setResendingId] = useState<string | null>(null);
  const handleResend = async (b: Broadcast) => {
    setResendingId(b.id);
    try {
      const { data, error } = await supabase.functions.invoke("broadcast-push", {
        body: { title: b.title, message: b.message, url: b.url || "/dashboard", audience: b.audience },
      });
      if (error) throw error;
      toast({
        title: "Broadcast resent",
        description: `Delivered to ${data?.sent ?? 0} device(s) across ${data?.recipients ?? 0} user(s).`,
      });
      loadHistory();
    } catch (e: any) {
      toast({ title: "Resend failed", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Push Broadcast to Users</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Sends a native browser/mobile push notification to every selected user who has notifications enabled.
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="bc-title">Title</Label>
            <Input id="bc-title" placeholder="e.g. New AirtelTigo bundles available" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
          </div>
          <div>
            <Label htmlFor="bc-audience">Audience</Label>
            <Select value={audience} onValueChange={(v) => setAudience(v as any)}>
              <SelectTrigger id="bc-audience"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                <SelectItem value="general">General users only</SelectItem>
                <SelectItem value="agent">Agents only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="bc-message">Message</Label>
          <Textarea id="bc-message" rows={4} placeholder="Write the announcement…" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} />
          <p className="text-xs text-muted-foreground mt-1">{message.length}/300</p>
        </div>

        <div>
          <Label htmlFor="bc-url">Link (when tapped)</Label>
          <Input id="bc-url" placeholder="/dashboard" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>

        <Button onClick={handleSend} disabled={sending} className="w-full sm:w-auto gap-2">
          <Send className="w-4 h-4" />
          {sending ? "Sending…" : "Send Broadcast"}
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-3">
        <h3 className="font-semibold">Recent Broadcasts</h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No broadcasts yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((b) => (
              <div key={b.id} className="border border-border rounded-lg p-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-medium truncate">{b.title}</span>
                    <Badge variant="outline" className="text-xs capitalize">{b.audience}</Badge>
                    <Badge variant="secondary" className="text-xs">{b.recipients_count} sent</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{b.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(parseISO(b.created_at), "dd MMM yyyy, HH:mm")}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(b.id)} className="text-destructive shrink-0">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
