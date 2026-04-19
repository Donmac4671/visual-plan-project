import { useEffect, useState } from "react";
import { Bell, X, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeToPush } from "@/lib/notifications";
import { toast } from "@/hooks/use-toast";

const DISMISS_KEY = "dmh_notif_banner_dismissed_until";

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}
function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

export default function EnableNotificationsBanner() {
  const { user } = useAuth();
  const [needsEnable, setNeedsEnable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    const dismissedUntil = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (Date.now() < dismissedUntil) return;

    const supported = "Notification" in window && "serviceWorker" in navigator;
    if (!supported) return;

    // iOS Safari (not standalone) cannot register push at all
    if (isIOS() && !isStandalone()) {
      setNeedsEnable(true);
      return;
    }

    if (Notification.permission !== "granted") {
      setNeedsEnable(true);
      return;
    }

    // Permission granted but maybe no active push subscription
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!sub) setNeedsEnable(true);
      })
      .catch(() => {});
  }, [user]);

  if (!user || !needsEnable) return null;

  const iosNeedsInstall = isIOS() && !isStandalone();

  const handleEnable = async () => {
    setBusy(true);
    try {
      const ok = await subscribeToPush(user.id);
      if (ok) {
        toast({ title: "Notifications enabled", description: "You'll now get order and top-up alerts." });
        setNeedsEnable(false);
      } else {
        toast({
          title: "Couldn't enable",
          description: "Please allow notifications in your browser settings.",
          variant: "destructive",
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = () => {
    // snooze 24h
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    setNeedsEnable(false);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-lg border bg-card p-3 shadow-lg sm:bottom-6">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2 shrink-0">
          <Bell className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          {iosNeedsInstall ? (
            <>
              <p className="text-sm font-medium">Enable notifications on iPhone</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Tap <Share className="inline h-3 w-3" /> <strong>Share</strong> in Safari, then{" "}
                <strong>Add to Home Screen</strong>. Open the app from the home screen icon to receive alerts.
              </p>
              <div className="mt-2 flex justify-end">
                <Button size="sm" variant="outline" onClick={handleDismiss}>
                  Got it
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Get order alerts</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Enable notifications to know instantly when your data is delivered.
              </p>
              <div className="mt-2 flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={handleDismiss}>
                  Later
                </Button>
                <Button size="sm" onClick={handleEnable} disabled={busy}>
                  {busy ? "Enabling…" : "Enable"}
                </Button>
              </div>
            </>
          )}
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
