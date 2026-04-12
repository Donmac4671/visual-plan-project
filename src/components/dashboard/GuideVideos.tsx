import VideoGuide from "./VideoGuide";

const buyDataSteps = [
  { icon: "📱", title: "Select Your Network", description: "Choose MTN, Telecel, or AirtelTigo from the dashboard.", highlight: "Step 1" },
  { icon: "📦", title: "Choose a Data Bundle", description: "Pick the bundle size that suits your needs and budget." },
  { icon: "🔢", title: "Enter Phone Number", description: "Type the 10-digit recipient phone number carefully." },
  { icon: "🛒", title: "Add to Cart", description: "Add multiple bundles for different numbers if you want." },
  { icon: "💳", title: "Pay & Checkout", description: "Choose Wallet or Paystack, then confirm your order." },
  { icon: "✅", title: "Data Delivered!", description: "Data arrives within 3 minutes to 4 hours depending on the network.", highlight: "Done!" },
];

const momoDepositSteps = [
  { icon: "💰", title: "Go to Top Up Wallet", description: "Open the Top Up Wallet page and select Mobile Money." },
  { icon: "📲", title: "Send Money via MoMo", description: "Send the desired amount to the MoMo number shown on screen." },
  { icon: "🔑", title: "Get Transaction ID", description: "You'll receive an 11-digit Transaction ID from your provider via SMS." },
  { icon: "📝", title: "Enter Transaction ID", description: "Type the exact Transaction ID on the app and click 'Claim Payment'." },
  { icon: "✅", title: "Wallet Credited!", description: "Your wallet is credited instantly once the admin-verified ID matches.", highlight: "Instant!" },
];

const paystackDepositSteps = [
  { icon: "💳", title: "Select Paystack", description: "Go to Top Up Wallet and choose the Paystack option." },
  { icon: "🔢", title: "Enter Amount", description: "Type the amount you want to deposit. A small 2% processing fee applies." },
  { icon: "🏦", title: "Complete Payment", description: "Pay via card, mobile money, or bank transfer on the secure Paystack page." },
  { icon: "⏳", title: "Wait 5 Seconds", description: "After paying, wait 5 seconds for Paystack to detect the transaction and show 'Payment Successful'.", highlight: "Important!" },
  { icon: "👆", title: "Click 'I've Paid' if Needed", description: "If you don't see success after 5 seconds, click 'I've already paid' and wait for confirmation." },
  { icon: "⚠️", title: "Don't Close the Window!", description: "Do NOT close until you see the success message — or your payment may not be recorded.", highlight: "Warning" },
  { icon: "✅", title: "Wallet Credited!", description: "Once confirmed, your wallet balance updates instantly.", highlight: "Done!" },
];

const complaintSteps = [
  { icon: "📋", title: "Open Complaints", description: "Go to Complaints from the sidebar menu." },
  { icon: "🔍", title: "Select Your Order", description: "Pick the order you have an issue with (last 48 hours only)." },
  { icon: "✏️", title: "Describe the Problem", description: "Enter a subject and explain the issue in detail. Include phone number and bundle info." },
  { icon: "📤", title: "Submit Complaint", description: "Click 'Submit Complaint' to send it for admin review." },
  { icon: "🔔", title: "Get Notified", description: "You'll be notified once the admin responds or resolves your complaint.", highlight: "We'll reply!" },
];

const becomeAgentSteps = [
  { icon: "📝", title: "Apply from Dashboard", description: "Go to 'Become an Agent' from the sidebar menu." },
  { icon: "📄", title: "Fill Application Form", description: "Enter your full name, phone, email, location, and why you want to be an agent." },
  { icon: "📸", title: "Upload Screenshot (Optional)", description: "Attach a screenshot of your ID or proof if requested." },
  { icon: "⏳", title: "Wait for Approval", description: "Admin reviews your application and approves or requests more info." },
  { icon: "🎉", title: "Start Selling!", description: "Once approved, you get agent pricing — buy data cheaper and resell for profit!", highlight: "Earn Money!" },
];

export default function GuideVideos() {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">📹 Quick Video Guides</h3>
      <VideoGuide title="How to Buy Data" emoji="🛒" steps={buyDataSteps} accentColor="#3b82f6" />
      <VideoGuide title="How to Deposit (Mobile Money)" emoji="💰" steps={momoDepositSteps} accentColor="#22c55e" />
      <VideoGuide title="How to Deposit (Paystack)" emoji="💳" steps={paystackDepositSteps} accentColor="#6366f1" />
      <VideoGuide title="How to File a Complaint" emoji="⚠️" steps={complaintSteps} accentColor="#f59e0b" />
      <VideoGuide title="How to Become an Agent" emoji="🤝" steps={becomeAgentSteps} accentColor="#ec4899" />
    </div>
  );
}
