/**
 * PWA Service Worker - 极简版（修复版）
 * 只在激活时清理旧缓存 + claim clients，不再执行 unregister + navigate
 * 让浏览器自行处理新旧 SW 的版本切换，避免无限刷新
 * 1:1 复刻 blog.liushen.fun 思路，但修复 activate 逻辑
 */
const CACHE_PREFIXES = ["BlogCache"];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      // 只清理旧缓存，不再调用 unregister() + navigate()
      // 这能避免“每次激活都注销自身 → 刷新 → 重新 register → 再次激活”的无限循环
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys
          .filter(key => CACHE_PREFIXES.some(prefix => key.startsWith(prefix)))
          .map(key => caches.delete(key))
      );

      // 声明控制所有处于打开状态的 client（不刷新页面）
      await self.clients.claim();
    })()
  );
});