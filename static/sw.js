/**
 * PWA Service Worker - 极简版（1:1 复刻 blog.liushen.fun）
 * 仅做缓存清理 + clients.claim，不做预缓存
 * 由 Hugo 直接复制到 public/sw.js（/sw.js）
 */
const CACHE_PREFIXES = ["BlogCache"];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys
          .filter(key => CACHE_PREFIXES.some(prefix => key.startsWith(prefix)))
          .map(key => caches.delete(key))
      );

      await self.clients.claim();
      await self.registration.unregister();

      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      clients.forEach(client => {
        client.navigate(client.url);
      });
    })()
  );
});