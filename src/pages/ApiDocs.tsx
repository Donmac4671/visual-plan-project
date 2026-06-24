import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Copy, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = "https://nkzakwfdaiexpwogezgq.supabase.co/functions/v1/public-api";

function Code({ children, lang = "bash" }: { children: string; lang?: string }) {
  const { toast } = useToast();
  return (
    <div className="relative group">
      <pre className="bg-muted text-foreground rounded-lg p-3 overflow-x-auto text-xs font-mono border border-border">
        <code>{children}</code>
      </pre>
      <button
        onClick={() => { navigator.clipboard.writeText(children); toast({ title: "Copied" }); }}
        className="absolute top-2 right-2 p-1.5 rounded bg-background/80 border border-border opacity-0 group-hover:opacity-100 transition"
        aria-label="Copy code"
      >
        <Copy className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function ApiDocs() {
  const [section, setSection] = useState("intro");

  return (
    <DashboardLayout title="API Documentation">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link to="/profile" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to Profile
        </Link>

        <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Donmac Data Hub API</h1>
          <p className="text-sm text-muted-foreground">
            REST API to place data/airtime orders, check wallet balance, and listen to order status updates.
            All requests require an API token from your <Link to="/profile" className="text-primary underline">Profile page</Link>.
          </p>
        </div>

        {/* Authentication */}
        <section className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Authentication</h2>
          <p className="text-sm text-muted-foreground">
            Send your token in the <code className="px-1 bg-muted rounded">Authorization</code> header on every request.
          </p>
          <Code>{`Authorization: Bearer dmh_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}</Code>
          <p className="text-xs text-muted-foreground">Base URL:</p>
          <Code>{BASE_URL}</Code>
        </section>

        {/* GET balance */}
        <section className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-bold rounded bg-green-500/15 text-green-600">GET</span>
            <code className="text-sm">/balance</code>
          </div>
          <p className="text-sm text-muted-foreground">Returns your wallet balance and account info.</p>
          <Code>{`curl ${BASE_URL}/balance \\
  -H "Authorization: Bearer dmh_live_YOUR_TOKEN"`}</Code>
          <p className="text-xs font-medium text-foreground">Response</p>
          <Code lang="json">{`{
  "balance": 152.50,
  "tier": "agent",
  "name": "John Doe"
}`}</Code>
        </section>

        {/* POST orders */}
        <section className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-bold rounded bg-blue-500/15 text-blue-600">POST</span>
            <code className="text-sm">/orders</code>
          </div>
          <p className="text-sm text-muted-foreground">
            Places a new data bundle order. Debits your wallet immediately. Returns the created order with its reference.
          </p>
          <p className="text-xs font-medium text-foreground">Body parameters</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
            <li><code>network</code> — <code>mtn</code>, <code>telecel</code>, or <code>airteltigo</code></li>
            <li><code>phone</code> — 10-digit Ghana number starting with <code>0</code> (e.g. <code>0549358359</code>)</li>
            <li><code>bundle</code> — bundle label (e.g. <code>1GB</code>, <code>2GB</code>, <code>5GB</code>)</li>
            <li><code>amount</code> — price in GHS (must match your tier's price)</li>
          </ul>
          <Code>{`curl -X POST ${BASE_URL}/orders \\
  -H "Authorization: Bearer dmh_live_YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "network": "mtn",
    "phone": "0549358359",
    "bundle": "1GB",
    "amount": 5.00
  }'`}</Code>
          <p className="text-xs font-medium text-foreground">Response (201)</p>
          <Code lang="json">{`{
  "success": true,
  "order": {
    "id": "uuid",
    "order_ref": "DMH123456",
    "status": "processing"
  }
}`}</Code>
        </section>

        {/* GET orders */}
        <section className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-bold rounded bg-green-500/15 text-green-600">GET</span>
            <code className="text-sm">/orders?limit=20</code>
          </div>
          <p className="text-sm text-muted-foreground">List your most recent orders.</p>
          <Code>{`curl "${BASE_URL}/orders?limit=10" \\
  -H "Authorization: Bearer dmh_live_YOUR_TOKEN"`}</Code>
        </section>

        {/* GET single order */}
        <section className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-bold rounded bg-green-500/15 text-green-600">GET</span>
            <code className="text-sm">/orders/{`{order_ref}`}</code>
          </div>
          <p className="text-sm text-muted-foreground">Fetch the latest status of a single order.</p>
          <Code>{`curl ${BASE_URL}/orders/DMH123456 \\
  -H "Authorization: Bearer dmh_live_YOUR_TOKEN"`}</Code>
          <p className="text-xs font-medium text-foreground">Status values</p>
          <p className="text-xs text-muted-foreground">
            <code>pending</code> · <code>processing</code> · <code>waiting</code> · <code>completed</code> · <code>failed</code>
            <br />Failed orders refund the wallet automatically.
          </p>
        </section>

        {/* Webhooks */}
        <section className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Webhooks (Order Status Sync)</h2>
          <p className="text-sm text-muted-foreground">
            Add a webhook URL on your Profile page. We POST a JSON payload every time an order
            of yours changes status — including orders placed on the website, not just API orders.
          </p>
          <p className="text-xs font-medium text-foreground">Headers we send</p>
          <Code>{`Content-Type: application/json
X-Donmac-Event: order.completed
X-Donmac-Signature: <hex HMAC-SHA256 of raw body using your signing secret>`}</Code>
          <p className="text-xs font-medium text-foreground">Payload</p>
          <Code lang="json">{`{
  "event": "order.completed",
  "order": {
    "id": "uuid",
    "order_ref": "DMH123456",
    "network": "mtn",
    "phone_number": "0549358359",
    "bundle_size": "1GB",
    "amount": 5.00,
    "status": "completed",
    "created_at": "2026-06-24T05:00:00Z"
  },
  "timestamp": 1750000000
}`}</Code>
          <p className="text-xs font-medium text-foreground">Verify the signature (Node.js)</p>
          <Code lang="javascript">{`import crypto from "crypto";

app.post("/webhooks/donmac", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.header("X-Donmac-Signature");
  const expected = crypto
    .createHmac("sha256", process.env.DONMAC_WEBHOOK_SECRET)
    .update(req.body)
    .digest("hex");
  if (sig !== expected) return res.status(401).send("Invalid signature");

  const event = JSON.parse(req.body.toString());
  console.log(event.event, event.order.order_ref, "→", event.order.status);
  res.sendStatus(200);
});`}</Code>
        </section>

        {/* Errors */}
        <section className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Errors</h2>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
            <li><strong>401</strong> — missing or invalid token</li>
            <li><strong>400</strong> — invalid input (bad phone, missing field, insufficient balance)</li>
            <li><strong>404</strong> — order or endpoint not found</li>
            <li><strong>500</strong> — server error (please report)</li>
          </ul>
        </section>

        <div className="text-center text-xs text-muted-foreground py-6">
          Need help? WhatsApp support from the live chat widget.
        </div>
      </div>
    </DashboardLayout>
  );
}
