import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { CalendarDays, Clock } from "lucide-react";
import { format } from "date-fns";

export default function WelcomeBanner() {
  const { profile } = useAuth();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const firstName = profile?.full_name?.split(" ")[0] || "User";
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const greetingEmoji = hour < 12 ? "🌅" : hour < 17 ? "☀️" : "🌙";

  return (
    <div className="rounded-xl gradient-primary p-4 text-primary-foreground">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{greetingEmoji}</span>
        <span className="font-bold text-sm">
          {greeting}, {firstName}! Welcome to DonMacDataHub
        </span>
      </div>
      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="w-4 h-4 opacity-80" />
          <span className="text-xs opacity-90">{format(now, "EEEE, MMM dd, yyyy")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 opacity-80" />
          <span className="text-xs opacity-90 tabular-nums">{format(now, "hh:mm:ss a")}</span>
        </div>
      </div>
    </div>
  );
}
