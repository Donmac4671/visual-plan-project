import { useState } from "react";
import { MessageCircle, ShoppingCart, Wallet, ChevronDown, ChevronUp, ExternalLink, AlertTriangle } from "lucide-react";

function CollapsibleSection({ title, icon: Icon, children, defaultOpen = false }: { title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary" />
          <span className="font-semibold text-foreground text-sm">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 text-sm text-muted-foreground space-y-2">{children}</div>}
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="border-t border-border bg-card mt-8">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="space-y-3">
          <CollapsibleSection title="How to Buy Data" icon={ShoppingCart}>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Select your <strong>network</strong> (MTN, Telecel, or AirtelTigo) from the dashboard.</li>
              <li>Choose a <strong>data bundle</strong> that suits you.</li>
              <li>Enter the <strong>recipient phone number</strong> (10 digits).</li>
              <li>Add to cart — you can add multiple bundles for different numbers.</li>
              <li>Go to <strong>Cart</strong> and choose to pay with your <strong>Wallet balance</strong> or <strong>Paystack</strong>.</li>
              <li>Confirm your order and the data will be delivered within <strong>3 minutes to 4 hours</strong> or more, depending on the network.</li>
            </ol>
          </CollapsibleSection>

          <CollapsibleSection title="How to Deposit (Mobile Money)" icon={Wallet}>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Go to <strong>Top Up Wallet</strong> and select <strong>Mobile Money</strong>.</li>
              <li>Send the desired amount to the <strong>MoMo number</strong> shown on screen.</li>
              <li>After sending, you'll receive an <strong>11-digit Transaction ID</strong> from your network provider via SMS.</li>
              <li>Enter the Transaction ID on the app and click <strong>"Claim Payment"</strong>.</li>
              <li>Your wallet will be credited instantly once verified.</li>
            </ol>
            <p className="text-xs mt-2 text-muted-foreground/80">
              💡 The admin pre-verifies Transaction IDs, so make sure you enter the correct one.
            </p>
          </CollapsibleSection>

          <CollapsibleSection title="How to Deposit (Paystack)" icon={Wallet}>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Go to <strong>Top Up Wallet</strong> and select <strong>Paystack</strong>.</li>
              <li>Enter the amount you want to deposit (a small 2% processing fee applies).</li>
              <li>Click <strong>"Pay with Paystack"</strong> — you'll be redirected to a secure payment page.</li>
              <li>Complete payment using your <strong>card, mobile money, or bank transfer</strong>.</li>
              <li>Your wallet is credited <strong>instantly</strong> after successful payment.</li>
            </ol>
          </CollapsibleSection>

          <CollapsibleSection title="How to File a Complaint" icon={AlertTriangle}>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Go to <strong>Complaints</strong> from the sidebar menu.</li>
              <li>Select the <strong>order</strong> you have an issue with (only orders from the last 48 hours are shown).</li>
              <li>Enter a <strong>subject</strong> and describe the problem in detail.</li>
              <li>Click <strong>"Submit Complaint"</strong> to send it for admin review.</li>
              <li>You'll be notified once the admin responds or resolves your complaint.</li>
            </ol>
            <p className="text-xs mt-2 text-muted-foreground/80">
              💡 Make sure to include the affected phone number and bundle details for faster resolution.
            </p>
          </CollapsibleSection>
        </div>

        <div className="flex flex-col items-center gap-3 pt-2">
          <a
            href="https://wa.me/233549358359"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-sm"
            style={{ backgroundColor: "#25D366" }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Contact Support
          </a>
          <a
            href="https://whatsapp.com/channel/0029VbBdxs77oQhkjJiqqO1y"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Join our WhatsApp Channel
          </a>
          <p className="text-center text-xs text-muted-foreground">© 2026 Donmac Data Hub. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
