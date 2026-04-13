// Native browser notification utilities

let permissionGranted = false;

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") {
    permissionGranted = true;
    return true;
  }
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  permissionGranted = result === "granted";
  return permissionGranted;
}

export function showNativeNotification(title: string, body: string, icon?: string) {
  // Always try vibration
  try {
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  } catch {}

  // Play sound
  playNotificationSound();

  // Show native notification if permitted
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      const n = new Notification(title, {
        body,
        icon: icon || "/favicon.ico",
        badge: "/favicon.ico",
        tag: `dmh-${Date.now()}`,
      } as NotificationOptions);
      // Auto-close after 5s
      setTimeout(() => n.close(), 5000);
    } catch {
      // Fallback: some mobile browsers don't support Notification constructor
    }
  }
}

// Programmatic WAV notification sound
const NOTIFICATION_SOUND_B64 = (() => {
  const sampleRate = 22050;
  const duration = 0.4;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
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
    const envelope = Math.max(0, 1 - t / duration);
    const sample = envelope * (
      0.5 * Math.sin(2 * Math.PI * 880 * t) +
      0.3 * Math.sin(2 * Math.PI * 1320 * t)
    );
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
    audio.play().catch(() => {});
  } catch {}
}
