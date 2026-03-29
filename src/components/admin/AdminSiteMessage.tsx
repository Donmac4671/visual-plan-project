import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Megaphone } from "lucide-react";

export default function AdminSiteMessage() {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("site_messages")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setMessage(data[0].message);
        setIsActive(data[0].is_active);
        setExistingId(data[0].id);
      }
    };
    fetch();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (existingId) {
        const { error } = await supabase
          .from("site_messages")
          .update({ message, is_active: isActive, updated_at: new Date().toISOString() })
          .eq("id", existingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("site_messages")
          .insert({ message, is_active: isActive })
          .select()
          .single();
        if (error) throw error;
        setExistingId(data.id);
      }
      toast({ title: "Site message saved!" });
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Megaphone className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Site Pop-up Message</h3>
      </div>
      <Textarea
        placeholder="Enter a message to display to all users when they open the app..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} id="msg-active" />
          <Label htmlFor="msg-active">Active</Label>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Message"}
        </Button>
      </div>
    </div>
  );
}
