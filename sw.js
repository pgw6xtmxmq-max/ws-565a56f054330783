/* 蘇永康專輯封面牆 service worker
 * 只快取 App 外殼（HTML、manifest、圖示），讓離線也能打開介面。
 * 絕不快取 YouTube、Spotify、圖片 CDN 或任何音樂／影片／封面。
 * 第三方請求不攔截，一律直接走網路。
 */
"use strict";

const CACHE_VERSION = "20261117t011241p0800";
const CACHE_NAME = "williamso-wall-" + CACHE_VERSION;

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png",
];

function shellPaths() {
  const paths = new Set();
  for (const item of APP_SHELL) {
    const url = new URL(item, self.location.href);
    paths.add(url.pathname);
    if (url.pathname.endsWith("/index.html")) {
      paths.add(url.pathname.slice(0, -"index.html".length));
      paths.add(url.pathname.slice(0, -"index.html".length - 1) || "/");
    }
  }
  return paths;
}

const SHELL_PATHS = shellPaths();

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isShellRequest(request, url) {
  if (!isSameOrigin(url)) return false;
  if (request.mode === "navigate") return true;
  return SHELL_PATHS.has(url.pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

async function networkFirstShell(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached =
      (await cache.match(request)) ||
      (await cache.match("./index.html")) ||
      (await cache.match("./"));
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch (err) {
    return;
  }

  // 第三方與非 App 外殼：不攔截、不快取，由瀏覽器直接走網路。
  if (!isShellRequest(request, url)) return;

  event.respondWith(networkFirstShell(request));
});
