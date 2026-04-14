import VideoGuide from "./VideoGuide";

import buyData1 from "@/assets/guides/buy-data-1.jpg";
import buyData2 from "@/assets/guides/buy-data-2.jpg";
import buyData3 from "@/assets/guides/buy-data-3.jpg";
import buyData4 from "@/assets/guides/buy-data-4.jpg";
import buyData5 from "@/assets/guides/buy-data-5.jpg";
import momoDeposit1 from "@/assets/guides/deposit-momo-1.jpg";
import momoDeposit2 from "@/assets/guides/deposit-momo-2.jpg";
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
          { image: buyData1, caption: "Choose the network you want to buy from." },
          { image: buyData2, caption: "Select the package you want to buy." },
          { image: buyData3, caption: "Enter the number to receive the data, then tap Add to Cart." },
          { image: buyData4, caption: "Open the cart to review your selected bundle." },
          { image: buyData5, caption: "Choose Wallet or Paystack, then tap Proceed to Pay to place the order." },
        ]}
      />

      <VideoGuide
        title="How to Deposit (Mobile Money)"
        emoji="💰"
        accentColor="#22c55e"
        steps={[
          { image: momoDeposit1, caption: "Go to Top Up Wallet, copy the MoMo number, send the money, then tap I've Sent the Money." },
          { image: momoDeposit2, caption: "Enter the 11-digit Transaction ID from your SMS and tap Claim Payment." },
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
          { image: complaint1, caption: "Open Complaints and tap New Complaint." },
          { image: complaint2, caption: "Fill in the required details and submit your complaint." },
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
