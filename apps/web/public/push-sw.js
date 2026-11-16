/* The notification deliberately never includes anonymous message content. */
self.addEventListener('push', event => {
  event.waitUntil(self.registration.showNotification('After Dark', {
    body: 'You have a new anonymous message.',
    icon: '/icon-concept.png',
    badge: '/icon-concept.png',
    data: { url: '/inbox' }
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL('/inbox', self.location.origin).href;
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = clients.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(url); return existing.focus(); }
    return self.clients.openWindow(url);
  })());
});
