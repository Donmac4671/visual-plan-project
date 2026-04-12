import VideoGuide from "./VideoGuide";
import buyDataVideo from "../../../public/videos/how-to-buy-data.mp4.asset.json";
import momoVideo from "../../../public/videos/how-to-deposit-momo.mp4.asset.json";
import paystackVideo from "../../../public/videos/how-to-deposit-paystack.mp4.asset.json";
import complaintVideo from "../../../public/videos/how-to-file-complaint.mp4.asset.json";
import agentVideo from "../../../public/videos/how-to-become-agent.mp4.asset.json";

export default function GuideVideos() {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">📹 Video Guides</h3>
      <VideoGuide title="How to Buy Data" emoji="🛒" videoUrl={buyDataVideo.url} accentColor="#3b82f6" />
      <VideoGuide title="How to Deposit (Mobile Money)" emoji="💰" videoUrl={momoVideo.url} accentColor="#22c55e" />
      <VideoGuide title="How to Deposit (Paystack)" emoji="💳" videoUrl={paystackVideo.url} accentColor="#6366f1" />
      <VideoGuide title="How to File a Complaint" emoji="⚠️" videoUrl={complaintVideo.url} accentColor="#f59e0b" />
      <VideoGuide title="How to Become an Agent" emoji="🤝" videoUrl={agentVideo.url} accentColor="#ec4899" />
    </div>
  );
}
