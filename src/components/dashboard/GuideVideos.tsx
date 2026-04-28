import VideoGuide from "./VideoGuide";
import buyStep1 from "@/assets/guides/buy-1-choose-network.jpg";
import buyStep2 from "@/assets/guides/buy-2-select-package.jpg";
import buyStep3 from "@/assets/guides/buy-3-enter-number.jpg";
import buyStep4 from "@/assets/guides/buy-4-open-cart.jpg";
import buyStep5 from "@/assets/guides/buy-5-proceed-pay.jpg";
import momoStep1 from "@/assets/guides/momo-1-open-wallet.jpg";
import momoStep2 from "@/assets/guides/momo-2-send-money.jpg";
import momoStep3 from "@/assets/guides/momo-3-claim.jpg";
import complaintStep1 from "@/assets/guides/complaint-1-new.jpg";
import complaintStep2 from "@/assets/guides/complaint-2-submit.jpg";
import agentStep1 from "@/assets/guides/agent-1-apply.jpg";

export default function GuideVideos() {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">📖 Quick Guides</h3>

      <VideoGuide
        title="How to Buy Data"
        emoji="🛒"
        accentColor="#3b82f6"
        steps={[
          { image: buyStep1, caption: "Choose the network you want to buy from." },
          { image: buyStep2, caption: "Select the package you want to buy." },
          { image: buyStep3, caption: "Enter the number to receive the data, then tap Add to Cart." },
          { image: buyStep4, caption: "Click the cart icon at the top to open your cart." },
          { image: buyStep5, caption: "Tap Proceed to Pay to complete placing your order — make sure your wallet has enough balance." },
        ]}
      />

      <VideoGuide
        title="How to Deposit (Mobile Money)"
        emoji="💰"
        accentColor="#22c55e"
        steps={[
          { image: momoStep1, caption: "On the Dashboard, tap the Wallet button to open Wallet Top-up." },
          { image: momoStep2, caption: "Copy the MoMo number, send the money, then tap I've Sent the Money." },
          { image: momoStep3, caption: "Enter the 11-digit Transaction ID from your SMS and tap Claim Payment — your wallet is credited immediately." },
        ]}
      />

      <VideoGuide
        title="How to Deposit (Paystack)"
        emoji="💳"
        accentColor="#6366f1"
        steps={[
          { caption: "Open Top Up Wallet, choose Paystack, enter the amount you want to deposit, then tap Proceed to Pay to open Paystack." },
          { caption: "Enter your Mobile Money number — the amount will be deducted from your MoMo wallet." },
          { caption: "First-time only: enter the 6-digit OTP sent to you for verification." },
          { caption: "When the prompt appears, enter your MoMo PIN to authorize the payment (the prompt will definitely show on your first time)." },
          { caption: "Wait for Successful Payment, or tap I've Paid once you've completed it. If no prompt came, go to your MoMo Approvals and approve the transaction." },
        ]}
      />

      <VideoGuide
        title="How to File a Complaint"
        emoji="⚠️"
        accentColor="#f59e0b"
        steps={[
          { image: complaintStep1, caption: "Open Complaints and tap New Complaint." },
          { image: complaintStep2, caption: "Fill in the required details and tap Submit Complaint." },
        ]}
      />

      <VideoGuide
        title="How to Become an Agent"
        emoji="🤝"
        accentColor="#ec4899"
        steps={[
          { image: agentStep1, caption: "Open Become an Agent and fill in your full name, email, phone, location and reason." },
          { image: agentStep1, caption: "Send the ₵40 registration fee via MTN MoMo to 0549358359 (Osei Michael), then enter the Transaction ID and tap Submit Application." },
        ]}
      />
    </div>
  );
}
