import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Plus, Trash2, Save } from "lucide-react";

interface SiteMessage {
  id: string;
  message: string;
  is_active: boolean;
  show_as_banner: boolean;
  updated_at: string;
}

interface DraftMessage {
  draftId: string;
  message: string;
  is_active: boolean;
  show_as_banner: boolean;
}

export default function AdminSiteMessage() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<SiteMessage[]>([]);
  const [drafts, setDrafts] = useState<DraftMessage[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from("site_messages")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load messages", description: error.message, variant: "destructive" });
      return;
    }
    setMessages(
      (data ?? []).map((m: any) => ({
        id: m.id,
        message: m.message,
        is_active: m.is_active,
        show_as_banner: m.show_as_banner ?? false,
        updated_at: m.updated_at,
      })),
    );
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const updateExisting = (id: string, patch: Partial<SiteMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const toggleField = async (m: SiteMessage, field: "is_active" | "show_as_banner", value: boolean) => {
    updateExisting(m.id, { [field]: value });
    const { error } = await supabase
      .from("site_messages")
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq("id", m.id);
    if (error) {
      updateExisting(m.id, { [field]: !value });
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    }
  };

  const updateDraft = (draftId: string, patch: Partial<DraftMessage>) => {
    setDrafts((prev) => prev.map((d) => (d.draftId === draftId ? { ...d, ...patch } : d)));
  };

  const addDraft = () => {
    setDrafts((prev) => [
      ...prev,
      { draftId: crypto.randomUUID(), message: "", is_active: false, show_as_banner: false },
    ]);
  };

  const removeDraft = (draftId: string) => {
    setDrafts((prev) => prev.filter((d) => d.draftId !== draftId));
  };

  const saveExisting = async (m: SiteMessage) => {
    setSavingId(m.id);
    try {
      const { error } = await supabase
        .from("site_messages")
        .update({
          message: m.message,
          is_active: m.is_active,
          show_as_banner: m.show_as_banner,
          updated_at: new Date().toISOString(),
        })
        .eq("id", m.id);
      if (error) throw error;
      toast({ title: "Message saved!" });
      fetchMessages();
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const saveDraft = async (d: DraftMessage) => {
    if (!d.message.trim()) {
      toast({ title: "Message cannot be empty", variant: "destructive" });
      return;
    }
    setSavingId(d.draftId);
    try {
      const { error } = await supabase.from("site_messages").insert({
        message: d.message,
        is_active: d.is_active,
        show_as_banner: d.show_as_banner,
      });
      if (error) throw error;
      toast({ title: "Message created!" });
      removeDraft(d.draftId);
      fetchMessages();
    } catch (e: any) {
      toast({ title: "Failed to create", description: e.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const deleteMessage = async (id: string) => {
    if (!confirm("Delete this message permanently?")) return;
    const { error } = await supabase.from("site_messages").delete().eq("id", id);
    if (error) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Message deleted" });
    fetchMessages();
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Site Messages</h3>
        </div>
        <Button onClick={addDraft} size="sm" variant="outline" className="gap-1">
          <Plus className="w-4 h-4" /> New Message
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Create multiple messages and toggle each individually. "Active" shows it as a popup.
        Enable "Show as top banner" to also show a dismissible banner at the top of every page.
      </p>

      {drafts.map((d) => (
        <div key={d.draftId} className="border border-dashed border-primary/40 rounded-lg p-3 space-y-3 bg-primary/5">
          <Textarea
            placeholder="Enter a new message..."
            value={d.message}
            onChange={(e) => updateDraft(d.draftId, { message: e.target.value })}
            rows={3}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={d.is_active}
                  onCheckedChange={(v) => updateDraft(d.draftId, { is_active: v })}
                  id={`active-${d.draftId}`}
                />
                <Label htmlFor={`active-${d.draftId}`}>Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={d.show_as_banner}
                  onCheckedChange={(v) => updateDraft(d.draftId, { show_as_banner: v })}
                  id={`banner-${d.draftId}`}
                />
                <Label htmlFor={`banner-${d.draftId}`}>Show as top banner</Label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => removeDraft(d.draftId)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => saveDraft(d)} disabled={savingId === d.draftId} className="gap-1">
                <Save className="w-4 h-4" /> {savingId === d.draftId ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </div>
      ))}

      {messages.length === 0 && drafts.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-6">
          No messages yet. Click "New Message" to create one.
        </div>
      )}

      {messages.map((m) => (
        <div key={m.id} className="border border-border rounded-lg p-3 space-y-3">
          <Textarea
            value={m.message}
            onChange={(e) => updateExisting(m.id, { message: e.target.value })}
            rows={3}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={m.is_active}
                  onCheckedChange={(v) => updateExisting(m.id, { is_active: v })}
                  id={`active-${m.id}`}
                />
                <Label htmlFor={`active-${m.id}`}>Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={m.show_as_banner}
                  onCheckedChange={(v) => updateExisting(m.id, { show_as_banner: v })}
                  id={`banner-${m.id}`}
                />
                <Label htmlFor={`banner-${m.id}`}>Show as top banner</Label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteMessage(m.id)}
                className="text-destructive hover:text-destructive gap-1"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </Button>
              <Button size="sm" onClick={() => saveExisting(m)} disabled={savingId === m.id} className="gap-1">
                <Save className="w-4 h-4" /> {savingId === m.id ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
