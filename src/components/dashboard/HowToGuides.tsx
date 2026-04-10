import { useState } from "react";
import { BookOpen, ShoppingCart, Wallet, CreditCard, ChevronDown, ChevronUp } from "lucide-react";

const guides = [
  {
    id: "buy",
    icon: ShoppingCart,
    title: "How to Buy Data",
    steps: [
      "Select your network (MTN, Telecel, AirtelTigo).",
      "Choose your preferred data bundle.",
      "Enter the phone number to receive the data.",
      "Select payment method — Wallet or Paystack.",
      "Confirm your order and wait for delivery.",
    ],
  },
  {
    id: "momo",
    icon: Wallet,
    title: "How to Deposit via MoMo",
    steps: [
      "Go to your MoMo app and send money to the number shown on the top-up page.",
      "After sending, copy the 11-digit Transaction ID from your MoMo confirmation SMS.",
      "Go to \"Claim Payment\" on the dashboard and paste the Transaction ID.",
      "Your wallet will be credited instantly once the ID is verified.",
      "If the ID is not found yet, wait a moment and try again — it takes a few seconds to sync.",
    ],
  },
  {
    id: "paystack",
    icon: CreditCard,
    title: "How to Deposit via Paystack",
    steps: [
      "Go to \"Top Up Wallet\" and enter the amount you want to deposit.",
      "Select Paystack as your payment method and proceed.",
      "Complete the payment on the Paystack checkout page.",
      "⚠️ IMPORTANT: After paying, wait 5 seconds for the Paystack window to detect the transaction and show \"Payment Successful\".",
      "If you don't see \"Payment Successful\" after 5 seconds, click the \"I've already paid\" button and wait for it to confirm.",
      "Do NOT close the window until you see the success confirmation — otherwise your payment may not be recorded even though the money was deducted.",
      "Once confirmed, your wallet is credited instantly.",
    ],
  },
];

export default function HowToGuides() {
  const [openGuide, setOpenGuide] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <BookOpen className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">Quick Guides</h3>
      </div>
      {guides.map((guide) => {
        const isOpen = openGuide === guide.id;
        const Icon = guide.icon;
        return (
          <div key={guide.id} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <button
              onClick={() => setOpenGuide(isOpen ? null : guide.id)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <span className="font-medium text-sm text-foreground">{guide.title}</span>
              </div>
              {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            {isOpen && (
              <div className="px-4 pb-4">
                <ol className="space-y-2 ml-1">
                  {guide.steps.map((step, i) => (
                    <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="font-semibold text-primary min-w-[20px]">{i + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
