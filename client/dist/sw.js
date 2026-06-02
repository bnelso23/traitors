self.addEventListener('push', function(event) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'New update from the Castle.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'traitors-general',
      renotify: true,
      vibrate: [300, 100, 300],
      data: data.data || {}
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'The Traitors', options)
    );
  } catch (err) {
    console.error('Error in service worker push listener:', err);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const data = event.notification.data || {};
  const targetUrl = data.channelId ? `/?channelId=${data.channelId}` : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Focus existing window if open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        const matchOrigin = client.url.startsWith(self.location.origin);
        if (matchOrigin && 'focus' in client) {
          if (data.channelId && 'postMessage' in client) {
            client.postMessage({ type: 'navigate_chat', channelId: data.channelId });
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
