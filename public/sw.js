// Service Worker for Web Push notifications
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => self.clients.claim());

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Donmac Data Hub", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Donmac Data Hub";
  const forceNotification = data.forceNotification === true;
  const options = {
    body: data.body || "",
    icon: data.icon || "/favicon.png",
    badge: data.badge || "/favicon.png",
    tag: data.tag || `dmh-${Date.now()}`,
    renotify: true,
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
    data: { url: data.url || "/dashboard" },
  };

  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const hasFocusedClient = clientsList.some((c) => c.focused === true && c.visibilityState === "visible");

    // Always tell open clients to play the sound (in-app chime)
    clientsList.forEach((c) => {
      try { c.postMessage({ type: "play-sound", title, body: options.body, forceNotification }); } catch {}
    });

    // Regular account events use in-app toasts when focused; broadcasts must still show visibly.
    if (hasFocusedClient && !forceNotification) return;

    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) {
          c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
