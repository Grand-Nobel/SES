// public/sw.js

// Ensure Workbox libraries are imported.
// If not using a build tool that bundles these, you might need to use:
// importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');
// if (workbox) {
//   console.log(`Workbox is loaded`);
//   workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);
//   // ... rest of the workbox configuration
// } else {
//   console.log(`Workbox didn't load`);
// }
// For this implementation, assuming a build step handles Workbox imports.

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Ensure that the manifest is available
// declare var self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any }; // TS specific, remove for JS
// self is globally available in SW scope

cleanupOutdatedCaches(); // Clean up old caches

// Precache all assets defined in the Workbox manifest
// self.__WB_MANIFEST is injected by the Workbox build process
precacheAndRoute(self.__WB_MANIFEST || []);

// Cache CSS, JS, and Web Worker requests with a Stale While Revalidate strategy
registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'worker',
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 }), // 30 Days
    ],
  })
);

// Cache image files with a Cache First strategy
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  })
);

// Cache API calls with a Network First strategy
registerRoute(
  ({ request, url }) => request.method === 'GET' && url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 10 * 60, // 10 minutes
      }),
    ],
  })
);

// Handle push notifications (from SEED outline for PWA guide)
self.addEventListener('push', (event) => { // Removed PushEvent type
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || '/icon-192x192.png', // Default icon
      badge: data.badge || '/badge-72x72.png', // Default badge
      vibrate: data.vibrate || [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.primaryKey || '1',
        url: data.url || '/', // URL to open on notification click
        ...data.data // Allow additional data
      },
      // actions: data.actions || [] // Example: [{ action: 'explore', title: 'Explore' }]
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
  } else {
    console.log('Push event but no data');
  }
});

self.addEventListener('notificationclick', (event) => { // Removed NotificationEvent type
  console.log('Notification click Received.', event.notification.data);
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList.find(c => c.url === urlToOpen && 'focus' in c);
        if (client) {
          return client.focus();
        }
        // If no matching client is found, open a new window/tab
        if (clientList[0] && 'focus' in clientList[0]) {
            clientList[0].focus(); // Focus the first available client
        }
      }
      return self.clients.openWindow(urlToOpen);
    })
  );
});

// Optional: Skip waiting and activate new service worker immediately
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim()); // Take control of all clients immediately
});
