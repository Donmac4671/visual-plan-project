import VideoGuide from "./VideoGuide";

export default function GuideVideos() {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">📖 Quick Guides</h3>

      <VideoGuide
        title="How to Buy Data"
        emoji="🛒"
        accentColor="#3b82f6"
        steps={[
          { caption: "Choose the network and the package you want to buy." },
          { caption: "Enter the recipient phone number, then tap Add to Cart." },
          { caption: "Tap the cart icon at the top to open your cart." },
          { caption: "Choose Wallet or Paystack, then tap Proceed to Pay to place the order." },
        ]}
      />

      <VideoGuide
        title="How to Deposit (Mobile Money)"
        emoji="💰"
        accentColor="#22c55e"
        steps={[
          { caption: "Go to Top Up Wallet, copy the MoMo number, send the money, then tap I've Sent the Money." },
          { caption: "Enter the 11-digit Transaction ID from your SMS and tap Claim Payment." },
        ]}
      />

      <VideoGuide
        title="How to Deposit (Paystack)"
        emoji="💳"
        accentColor="#6366f1"
        steps={[
          { caption: "Open Top Up Wallet and choose Paystack as your payment method." },
          { caption: "Enter the amount you want to add and tap Pay with Paystack." },
          { caption: "Complete the payment and wait about 5 seconds for your wallet balance to update." },
        ]}
      />

      <VideoGuide
        title="How to File a Complaint"
        emoji="⚠️"
        accentColor="#f59e0b"
        steps={[
          { caption: "Open Complaints and tap New Complaint." },
          { caption: "Fill in the required details and submit your complaint." },
        ]}
      />

      <VideoGuide
        title="How to Become an Agent"
        emoji="🤝"
        accentColor="#ec4899"
        steps={[
          { caption: "Open Become an Agent, fill in your details and reason for applying." },
          { caption: "Submit your application — we'll review and get back to you soon!" },
        ]}
      />
    </div>
  );
}
