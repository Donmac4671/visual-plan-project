import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Copy, KeyRound, RefreshCw, Trash2, Webhook, ExternalLink, Eye, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";

interface ApiToken {
  id: string;
  name: string;
  token_prefix: string;
  last_used_at: string | null;
  created_at: string;
}

interface Webhook {
  url: string;
  secret: string;
  updated_at: string;
}

export default function ApiTokensSection() {
  const { toast } = useToast();
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTokenName, setNewTokenName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<{ id: string; token: string } | null>(null);
  const [webhook, setWebhook] = useState<Webhook | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [savingHook, setSavingHook] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: tk }, { data: wh }] = await Promise.all([
      supabase.from("api_tokens").select("id,name,token_prefix,last_used_at,created_at").is("revoked_at", null).order("created_at", { ascending: false }),
      supabase.from("api_webhooks").select("url,secret,updated_at").maybeSingle(),
    ]);
    setTokens((tk as ApiToken[]) || []);
    setWebhook((wh as Webhook) || null);
    setWebhookUrl(wh?.url || "");
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const copy = async (text: string, label = "Copied") => {
    await navigator.clipboard.writeText(text);
    toast({ title: label, description: "Copied to clipboard." });
  };

  const create = async () => {
    setCreating(true);
    const { data, error } = await supabase.rpc("create_api_token", { p_name: newTokenName || "API Token" });
    setCreating(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    const result = data as { id: string; token: string };
    setRevealed(result);
    setNewTokenName("");
    load();
  };

  const regenerate = async (id: string) => {
    if (!confirm("Regenerate token? The old token will stop working immediately.")) return;
    const { data, error } = await supabase.rpc("regenerate_api_token", { p_id: id });
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    const result = data as { id: string; token: string };
    setRevealed(result);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this token? Any integrations using it will stop working.")) return;
    const { error } = await supabase.rpc("delete_api_token", { p_id: id });
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Deleted" });
    load();
  };

  const saveWebhook = async () => {
    if (!webhookUrl.match(/^https?:\/\//)) {
      return toast({ title: "Invalid URL", description: "Must start with http:// or https://", variant: "destructive" });
    }
    setSavingHook(true);
    const { data, error } = await supabase.rpc("set_api_webhook", { p_url: webhookUrl });
    setSavingHook(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    const result = data as { url: string; secret: string };
    setWebhook({ url: result.url, secret: result.secret, updated_at: new Date().toISOString() });
    setShowSecret(true);
    toast({ title: "Webhook saved", description: "Save the signing secret now — it won't be shown again." });
  };

  const removeWebhook = async () => {
    if (!confirm("Delete webhook? You will stop receiving order status updates.")) return;
    const { error } = await supabase.rpc("delete_api_webhook");
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setWebhook(null);
    setWebhookUrl("");
    toast({ title: "Webhook removed" });
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Developer API</h3>
        </div>
        <Link to="/api-docs" className="text-sm text-primary flex items-center gap-1 hover:underline">
          API Documentation <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
      <p className="text-xs text-muted-foreground -mt-3">
        Place orders, check balance, and receive webhooks from external websites or apps.
      </p>

      {/* Reveal modal-like inline */}
      {revealed && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium text-foreground">
            ⚠️ Copy your token now — it won't be shown again.
          </p>
          <div className="flex gap-2">
            <Input value={revealed.token} readOnly className="font-mono text-xs" />
            <Button size="sm" onClick={() => copy(revealed.token, "Token copied")}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setRevealed(null)}>I've saved it</Button>
        </div>
      )}

      {/* Create */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Create new token</label>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. My website"
            value={newTokenName}
            onChange={(e) => setNewTokenName(e.target.value)}
            style={{ fontSize: 16 }}
          />
          <Button onClick={create} disabled={creating} className="gradient-primary border-0">
            {creating ? "Creating…" : "Create"}
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-foreground">Your tokens</h4>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tokens yet.</p>
        ) : (
          <div className="space-y-2">
            {tokens.map((t) => (
              <div key={t.id} className="border border-border rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{t.token_prefix}…</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t.last_used_at ? `Last used ${new Date(t.last_used_at).toLocaleString()}` : "Never used"}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => regenerate(t.id)}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => remove(t.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Webhook */}
      <div className="border-t border-border pt-5 space-y-3">
        <div className="flex items-center gap-2">
          <Webhook className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-medium text-foreground">Order Status Webhook</h4>
        </div>
        <p className="text-xs text-muted-foreground">
          We'll POST to this URL whenever any of your orders changes status. Verify the
          <code className="mx-1 px-1 rounded bg-muted">X-Donmac-Signature</code> header
          (HMAC-SHA256 of the raw body using your signing secret).
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="https://your-site.com/webhooks/donmac"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            style={{ fontSize: 16 }}
          />
          <Button onClick={saveWebhook} disabled={savingHook} className="gradient-primary border-0">
            {savingHook ? "Saving…" : "Save"}
          </Button>
        </div>
        {webhook && (
          <div className="space-y-2 bg-muted/40 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Signing secret</span>
              <button onClick={() => setShowSecret(!showSecret)} className="text-xs flex items-center gap-1 text-primary">
                {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showSecret ? "Hide" : "Show"}
              </button>
            </div>
            <div className="flex gap-2">
              <Input value={showSecret ? webhook.secret : "•".repeat(24)} readOnly className="font-mono text-xs" />
              <Button size="sm" variant="outline" onClick={() => copy(webhook.secret, "Secret copied")}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <Button size="sm" variant="ghost" onClick={removeWebhook} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-1" /> Remove webhook
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
