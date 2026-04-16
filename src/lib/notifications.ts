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
    } catch {
      // SW registration failed – fall back to basic Notification API
    }
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;

  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  const result = await Notification.requestPermission();
  return result === "granted";
}

export function showNativeNotification(title: string, body: string, icon?: string) {
  // Vibrate safely
  try {
    if ("vibrate" in navigator) {
      navigator.vibrate?.([100, 50, 100]);
    }
  } catch {}

  // Play sound
  playNotificationSound();

  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const opts = {
    body,
    icon: icon || "/placeholder.svg",
    badge: "/placeholder.svg",
    tag: `dmh-${Date.now()}`,
    requireInteraction: false,
    vibrate: [100, 50, 100],
  } as NotificationOptions;

  // Prefer Service Worker notification
  if (swRegistration && "showNotification" in swRegistration) {
    (swRegistration as ServiceWorkerRegistration)
      .showNotification(title, opts)
      .catch(() => fallbackNotification(title, opts));
  } else {
    fallbackNotification(title, opts);
  }
}

function fallbackNotification(title: string, opts: NotificationOptions) {
  try {
    const n = new Notification(title, opts);
    setTimeout(() => n.close(), 6000);
  } catch {}
}

// Programmatic WAV sound
const NOTIFICATION_SOUND_B64 = (() => {
  const sampleRate = 22050;
  const duration = 0.4;
  const numSamples = Math.floor(sampleRate * duration);

  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, "WAVE");

  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);

  writeString(36, "data");
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.max(0, 1 - t / duration);

    const sample = env * (0.5 * Math.sin(2 * Math.PI * 880 * t) + 0.3 * Math.sin(2 * Math.PI * 1320 * t));

    view.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, sample * 32767)), true);
  }

  const bytes = new Uint8Array(buffer);

  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  // Handle both browser and Node environments
  const base64 = typeof btoa !== "undefined" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");

  return "data:audio/wav;base64," + base64;
})();

function playNotificationSound() {
  try {
    const audio = new Audio(NOTIFICATION_SOUND_B64);
    audio.volume = 1.0;
    audio.play().catch(() => {});
  } catch {}
}
