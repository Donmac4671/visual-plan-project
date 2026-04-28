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
  const [showAsBanner, setShowAsBanner] = useState(false);
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
        setShowAsBanner((data[0] as any).show_as_banner ?? false);
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
          .update({ message, is_active: isActive, show_as_banner: showAsBanner, updated_at: new Date().toISOString() })
          .eq("id", existingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("site_messages")
          .insert({ message, is_active: isActive, show_as_banner: showAsBanner })
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="msg-active" />
            <Label htmlFor="msg-active">Active</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={showAsBanner} onCheckedChange={setShowAsBanner} id="msg-banner" />
            <Label htmlFor="msg-banner">Show as top banner</Label>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Message"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        When "Active" is on: shows as a popup. Enable "Show as top banner" to also display a dismissible banner at the top of every page.
      </p>
    </div>
  );
}
