import { useState, useEffect, useCallback } from "react";
import { Play, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface SlideStep {
  image: string;
  caption: string;
}

interface VideoGuideProps {
  title: string;
  emoji: string;
  steps: SlideStep[];
  accentColor: string;
}

export default function VideoGuide({ title, emoji, steps, accentColor }: VideoGuideProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const next = useCallback(() => {
    setCurrentStep((s) => {
      if (s >= steps.length - 1) {
        setIsPlaying(false);
        return s;
      }
      return s + 1;
    });
  }, [steps.length]);

  const prev = () => setCurrentStep((s) => Math.max(0, s - 1));

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(next, 3500);
    return () => clearInterval(timer);
  }, [isPlaying, next]);

  const handleExpand = () => {
    setIsExpanded(true);
    setCurrentStep(0);
    setIsPlaying(true);
  };

  const restart = () => {
    setCurrentStep(0);
    setIsPlaying(true);
  };

  if (!isExpanded) {
    return (
      <button
        onClick={handleExpand}
        className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors text-left"
      >
        <span className="text-2xl">{emoji}</span>
        <span className="font-semibold text-foreground text-sm flex-1">{title}</span>
        <Play className="w-4 h-4 text-muted-foreground" />
      </button>
    );
  }

  const step = steps[currentStep];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => { setIsExpanded(false); setIsPlaying(false); }}
        className="w-full flex items-center gap-3 p-3.5 hover:bg-accent/50 transition-colors text-left border-b border-border"
      >
        <span className="text-2xl">{emoji}</span>
        <span className="font-semibold text-foreground text-sm flex-1">{title}</span>
        <ChevronUp className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Image slideshow */}
      <div className="relative bg-muted">
        <div className="relative overflow-hidden" style={{ minHeight: 280 }}>
          <img
            src={step.image}
            alt={step.caption}
            className="w-full h-auto max-h-[400px] object-contain transition-opacity duration-500"
            loading="lazy"
          />
        </div>

        {/* Navigation arrows */}
        <button
          onClick={(e) => { e.stopPropagation(); prev(); }}
          disabled={currentStep === 0}
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1.5 disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          disabled={currentStep === steps.length - 1}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1.5 disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Step counter */}
        <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
          {currentStep + 1} / {steps.length}
        </div>
      </div>

      {/* Caption + progress */}
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: accentColor }}
          >
            {currentStep + 1}
          </div>
          <p className="text-sm font-medium text-foreground">{step.caption}</p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  i === currentStep ? "w-5" : "bg-muted-foreground/30"
                )}
                style={i === currentStep ? { backgroundColor: accentColor } : undefined}
              />
            ))}
          </div>
          <button onClick={restart} className="text-muted-foreground hover:text-foreground">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
