// Native push notification utilities with Service Worker support

let swRegistration: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker(): Promise<void> {
  if ("serviceWorker" in navigator) {
    try {
      swRegistration =
        (await navigator.serviceWorker.getRegistration("/")) ??
        (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
      await navigator.serviceWorker.ready;
      swRegistration = (await navigator.serviceWorker.getRegistration("/")) ?? swRegistration;
      console.log("Service Worker registered successfully");
    } catch (error) {
      console.error("Service Worker registration failed:", error);
      // SW registration failed – fall back to basic Notification API
    }
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.warn("Notifications not supported in this browser");
    return false;
  }

  if (Notification.permission === "granted") {
    console.log("Notification permission already granted");
    return true;
  }

  if (Notification.permission === "denied") {
    console.warn("Notification permission previously denied");
    return false;
  }

  // Permission is "default" - need to ask user
  try {
    const result = await Notification.requestPermission();
    const granted = result === "granted";
    if (granted) {
      console.log("Notification permission granted by user");
    } else {
      console.warn("Notification permission denied by user");
    }
    return granted;
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return false;
  }
}

// Call this when your app starts to initialize notifications
export async function initNotifications(): Promise<boolean> {
  try {
    const hasPermission = await requestNotificationPermission();
    if (hasPermission) {
      await registerServiceWorker();
      return true;
    }
    return false;
  } catch (error) {
    console.error("Failed to initialize notifications:", error);
    return false;
  }
}

export function showNativeNotification(title: string, body: string, icon?: string) {
  console.log("showNativeNotification called:", { title, body });

  // Check if notifications are supported and permitted
  if (!("Notification" in window)) {
    console.warn("Notifications not supported in this browser");
    return;
  }

  if (Notification.permission !== "granted") {
    console.warn("Notification permission not granted. Current permission:", Notification.permission);
    return;
  }

  // Try vibration (requires user interaction, but won't break if blocked)
  try {
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
      console.log("Vibration triggered");
    }
  } catch (error) {
    console.log("Vibration not supported or blocked:", error);
  }

  // Try playing sound (may be blocked by autoplay policies)
  try {
    playNotificationSound();
    console.log("Sound playback attempted");
  } catch (error) {
    console.log("Sound playback failed:", error);
  }

  // Create notification options (removed vibrate property that caused TypeScript error)
  const opts = {
    body: body,
    icon: icon || "/placeholder.svg",
    badge: "/placeholder.svg",
    tag: `dmh-${Date.now()}`,
    requireInteraction: false,
    silent: false, // Keep this false to allow sound
  } as NotificationOptions;

  // Prefer SW-based notification (works when tab is background / phone locked)
  if (swRegistration) {
    console.log("Using Service Worker to show notification");
    swRegistration.showNotification(title, opts).catch((error) => {
      console.error("SW notification failed, using fallback:", error);
      fallbackNotification(title, opts);
    });
  } else {
    console.log("No Service Worker, using fallback notification");
    fallbackNotification(title, opts);
  }
}

function fallbackNotification(title: string, opts: NotificationOptions) {
  try {
    console.log("Showing fallback notification");
    const n = new Notification(title, opts);
    setTimeout(() => {
      n.close();
    }, 6000);
  } catch (error) {
    console.error("Failed to show fallback notification:", error);
  }
}

// Programmatic WAV sound
const NOTIFICATION_SOUND_B64 = (() => {
  const sampleRate = 22050;
  const duration = 0.4;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  w(36, "data");
  view.setUint32(40, numSamples * 2, true);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.max(0, 1 - t / duration);
    const sample = env * (0.5 * Math.sin(2 * Math.PI * 880 * t) + 0.3 * Math.sin(2 * Math.PI * 1320 * t));
    view.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, sample * 32767)), true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return "data:audio/wav;base64," + btoa(binary);
})();

function playNotificationSound() {
  try {
    const audio = new Audio(NOTIFICATION_SOUND_B64);
    audio.volume = 1.0;
    audio.play().catch((error) => {
      // Autoplay policies may block this - that's expected behavior
      console.log("Audio play blocked by browser autoplay policy:", error);
    });
  } catch (error) {
    console.log("Audio creation failed:", error);
  }
}
