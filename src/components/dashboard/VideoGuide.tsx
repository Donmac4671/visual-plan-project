import { useState, useEffect, useCallback } from "react";
import { Play, Pause, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface GuideStep {
  title: string;
  description: string;
  icon: string;
  highlight?: string;
}

interface VideoGuideProps {
  title: string;
  emoji: string;
  steps: GuideStep[];
  accentColor: string;
}

function StepAnimation({ step, isActive, accentColor }: { step: GuideStep; isActive: boolean; accentColor: string }) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center gap-3 transition-all duration-700 px-4",
      isActive ? "opacity-100 scale-100" : "opacity-0 scale-95"
    )}>
      <div
        className="text-5xl animate-bounce-slow"
        style={{ animationDuration: "2s" }}
      >
        {step.icon}
      </div>
      <h4 className="text-base font-bold text-foreground text-center">{step.title}</h4>
      <p className="text-sm text-muted-foreground text-center max-w-[280px] leading-relaxed">
        {step.description}
      </p>
      {step.highlight && (
        <span
          className="inline-block text-xs font-semibold px-3 py-1 rounded-full text-white mt-1"
          style={{ backgroundColor: accentColor }}
        >
          {step.highlight}
        </span>
      )}
    </div>
  );
}

export default function VideoGuide({ title, emoji, steps, accentColor }: VideoGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev >= steps.length - 1) {
        setIsPlaying(false);
        return prev;
      }
      return prev + 1;
    });
  }, [steps.length]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(nextStep, 3000);
    return () => clearInterval(timer);
  }, [isPlaying, nextStep]);

  const handlePlayPause = () => {
    if (currentStep >= steps.length - 1) {
      setCurrentStep(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handlePrev = () => {
    setIsPlaying(false);
    setCurrentStep((p) => Math.max(0, p - 1));
  };

  const handleNext = () => {
    setIsPlaying(false);
    setCurrentStep((p) => Math.min(steps.length - 1, p + 1));
  };

  const handleRestart = () => {
    setCurrentStep(0);
    setIsPlaying(true);
  };

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
      {/* Header */}
      <button
        onClick={() => { setIsExpanded(false); setIsPlaying(false); }}
        className="w-full flex items-center gap-3 p-3.5 hover:bg-accent/50 transition-colors text-left border-b border-border"
      >
        <span className="text-2xl">{emoji}</span>
        <span className="font-semibold text-foreground text-sm flex-1">{title}</span>
        <ChevronLeft className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Video area */}
      <div
        className="relative h-[220px] flex items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${accentColor}10, ${accentColor}05)` }}
      >
        {steps.map((step, i) => (
          <div
            key={i}
            className={cn("absolute inset-0 flex items-center justify-center", i === currentStep ? "block" : "hidden")}
          >
            <StepAnimation step={step} isActive={i === currentStep} accentColor={accentColor} />
          </div>
        ))}

        {/* Step counter */}
        <div className="absolute top-2 right-3 text-xs font-mono text-muted-foreground bg-background/80 px-2 py-0.5 rounded-full">
          {currentStep + 1}/{steps.length}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className="h-full transition-all duration-500 ease-out rounded-r-full"
          style={{
            width: `${((currentStep + 1) / steps.length) * 100}%`,
            backgroundColor: accentColor,
          }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <button onClick={handleRestart} className="p-1.5 rounded-full hover:bg-accent transition-colors">
          <RotateCcw className="w-4 h-4 text-muted-foreground" />
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="p-1.5 rounded-full hover:bg-accent transition-colors disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4 text-foreground" />
          </button>

          <button
            onClick={handlePlayPause}
            className="p-2 rounded-full text-white transition-colors"
            style={{ backgroundColor: accentColor }}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <button
            onClick={handleNext}
            disabled={currentStep >= steps.length - 1}
            className="p-1.5 rounded-full hover:bg-accent transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4 text-foreground" />
          </button>
        </div>

        {/* Step dots */}
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => { setCurrentStep(i); setIsPlaying(false); }}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all",
                i === currentStep ? "scale-125" : "bg-muted-foreground/30"
              )}
              style={i === currentStep ? { backgroundColor: accentColor } : {}}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
