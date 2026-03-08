import { MessageCircle } from "lucide-react";

export default function FloatingWhatsAppButton() {
  return (
    <a
      href="https://whatsapp.com/channel/0029VbBdxs77oQhkjJiqqO1y"
      target="_blank"
      rel="noreferrer"
      aria-label="Open WhatsApp channel"
      className="fixed bottom-4 left-4 z-50 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg px-4 py-3 hover:opacity-90 transition-opacity"
    >
      <MessageCircle className="w-5 h-5" />
      <span className="text-sm font-semibold">WhatsApp</span>
    </a>
  );
}
