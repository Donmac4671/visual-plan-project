import { useState } from "react";
import { Play, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoGuideProps {
  title: string;
  emoji: string;
  videoUrl: string;
  accentColor: string;
}

export default function VideoGuide({ title, emoji, videoUrl, accentColor }: VideoGuideProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors text-left"
      >
        <span className="text-2xl">{emoji}</span>
        <span className="font-semibold text-foreground text-sm flex-1">{title}</span>
        <Play className="w-4 h-4 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(false)}
        className="w-full flex items-center gap-3 p-3.5 hover:bg-accent/50 transition-colors text-left border-b border-border"
      >
        <span className="text-2xl">{emoji}</span>
        <span className="font-semibold text-foreground text-sm flex-1">{title}</span>
        <ChevronUp className="w-4 h-4 text-muted-foreground" />
      </button>

      <div className="relative bg-black flex items-center justify-center">
        <video
          src={videoUrl}
          controls
          autoPlay
          playsInline
          className="w-full max-h-[400px] object-contain"
          style={{ background: "#000" }}
        />
      </div>
    </div>
  );
}
