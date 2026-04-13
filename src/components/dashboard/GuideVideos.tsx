import VideoGuide from "./VideoGuide";

import buyData1 from "@/assets/guides/buy-data-1.jpg";
import buyData2 from "@/assets/guides/buy-data-2.jpg";
import momoDeposit1 from "@/assets/guides/deposit-momo-1.jpg";
import momoDeposit2 from "@/assets/guides/deposit-momo-2.jpg";
import paystackDeposit1 from "@/assets/guides/deposit-paystack-1.jpg";
import complaint1 from "@/assets/guides/complaint-1.jpg";
import complaint2 from "@/assets/guides/complaint-2.jpg";
import agent1 from "@/assets/guides/agent-1.jpg";
import agent2 from "@/assets/guides/agent-2.jpg";

export default function GuideVideos() {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">📹 Video Guides</h3>

      <VideoGuide
        title="How to Buy Data"
        emoji="🛒"
        accentColor="#3b82f6"
        steps={[
          { image: buyData1, caption: "Select your network (MTN, Telecel, or AirtelTigo) and choose a data bundle" },
          { image: buyData2, caption: "Enter the phone number, pick Wallet or Paystack, then tap Proceed to Pay" },
        ]}
      />

      <VideoGuide
        title="How to Deposit (Mobile Money)"
        emoji="💰"
        accentColor="#22c55e"
        steps={[
          { image: momoDeposit1, caption: "Go to Top Up Wallet and select Mobile Money (MoMo)" },
          { image: momoDeposit2, caption: "Send money to the MoMo number shown, then enter your Transaction ID to claim" },
        ]}
      />

      <VideoGuide
        title="How to Deposit (Paystack)"
        emoji="💳"
        accentColor="#6366f1"
        steps={[
          { image: paystackDeposit1, caption: "Select Paystack, enter amount, and tap Pay — wait 5 seconds for your wallet to update" },
        ]}
      />

      <VideoGuide
        title="How to File a Complaint"
        emoji="⚠️"
        accentColor="#f59e0b"
        steps={[
          { image: complaint1, caption: "Open Complaints from the menu, fill in the subject, order reference, and message" },
          { image: complaint2, caption: "Submit and track your complaint status — admin will reply here" },
        ]}
      />

      <VideoGuide
        title="How to Become an Agent"
        emoji="🤝"
        accentColor="#ec4899"
        steps={[
          { image: agent1, caption: "Open Become an Agent, fill in your details and reason for applying" },
          { image: agent2, caption: "Submit your application — we'll review and get back to you soon!" },
        ]}
      />
    </div>
  );
}
