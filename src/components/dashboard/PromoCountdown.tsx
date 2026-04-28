import { useState, useEffect } from "react";
import { useActivePromo } from "@/hooks/useActivePromo";
import { useAuth } from "@/contexts/AuthContext";
import { Clock, Sparkles, CalendarClock } from "lucide-react";
import { format } from "date-fns";

function getTimeLeft(target: string) {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return { days, hours, minutes, seconds };
}

export default function PromoCountdown() {
  const { profile } = useAuth();
  const { promo, upcomingPromo } = useActivePromo(profile?.tier);

  // Prefer the live promo; otherwise show the upcoming one as a heads-up
  const isLive = Boolean(promo);
  const active = promo || upcomingPromo;
  const targetDate = active
    ? isLive
      ? active.expires_at
      : active.starts_at
    : null;

  const [timeLeft, setTimeLeft] = useState<ReturnType<typeof getTimeLeft>>(null);

  useEffect(() => {
    if (!targetDate) return;
    setTimeLeft(getTimeLeft(targetDate));
    const interval = setInterval(() => {
      const tl = getTimeLeft(targetDate);
      setTimeLeft(tl);
      if (!tl) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!active || !timeLeft) return null;

  const audience =
    active.target_audience === "agent" ? "Agents" :
    active.target_audience === "general" ? "General Users" : "Everyone";

  const headlineIcon = isLive ? Sparkles : CalendarClock;
  const HeadlineIcon = headlineIcon;
  const headline = isLive
    ? `🎉 ${active.discount_percent}% OFF for ${audience}!`
    : `📅 Upcoming: ${active.discount_percent}% OFF for ${audience}`;
  const countdownLabel = isLive ? "Ends in:" : "Starts in:";

  return (
    <div className="rounded-xl gradient-primary p-4 text-primary-foreground">
      <div className="flex items-center gap-2 mb-2">
        <HeadlineIcon className="w-5 h-5" />
        <span className="font-bold text-sm">{headline}</span>
      </div>
      {active.description && (
        <p className="text-xs opacity-90 mb-2">{active.description}</p>
      )}
      {!isLive && (
        <p className="text-xs opacity-90 mb-3">
          Goes live on{" "}
          <span className="font-semibold">
            {format(new Date(active.starts_at), "MMM dd, yyyy • HH:mm")}
          </span>
        </p>
      )}
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 opacity-80" />
        <span className="text-xs opacity-80">{countdownLabel}</span>
      </div>
      <div className="flex gap-2 mt-2">
        {[
          { val: timeLeft.days, label: "Days" },
          { val: timeLeft.hours, label: "Hrs" },
          { val: timeLeft.minutes, label: "Min" },
          { val: timeLeft.seconds, label: "Sec" },
        ].map((unit) => (
          <div key={unit.label} className="bg-background/20 rounded-lg px-3 py-2 text-center min-w-[52px]">
            <p className="text-xl font-bold tabular-nums">{String(unit.val).padStart(2, "0")}</p>
            <p className="text-[10px] opacity-80">{unit.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
