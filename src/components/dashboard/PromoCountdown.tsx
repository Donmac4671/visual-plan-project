import { useState, useEffect } from "react";
import { useActivePromo } from "@/hooks/useActivePromo";
import { useAuth } from "@/contexts/AuthContext";
import { Clock, Sparkles } from "lucide-react";

function getTimeLeft(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return { days, hours, minutes, seconds };
}

export default function PromoCountdown() {
  const { profile } = useAuth();
  const { promo } = useActivePromo(profile?.tier);
  const [timeLeft, setTimeLeft] = useState<ReturnType<typeof getTimeLeft>>(null);

  useEffect(() => {
    if (!promo) return;
    setTimeLeft(getTimeLeft(promo.expires_at));
    const interval = setInterval(() => {
      const tl = getTimeLeft(promo.expires_at);
      setTimeLeft(tl);
      if (!tl) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [promo]);

  if (!promo || !timeLeft) return null;

  const audience =
    promo.target_audience === "agent" ? "Agents" :
    promo.target_audience === "general" ? "General Users" : "Everyone";

  return (
    <div className="rounded-xl gradient-primary p-4 text-primary-foreground">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-5 h-5" />
        <span className="font-bold text-sm">
          🎉 {promo.discount_percent}% OFF for {audience}!
        </span>
      </div>
      {promo.description && (
        <p className="text-xs opacity-90 mb-3">{promo.description}</p>
      )}
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 opacity-80" />
        <span className="text-xs opacity-80">Ends in:</span>
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