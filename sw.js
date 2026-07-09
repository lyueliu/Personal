/* 离线文件传输工具 - Service Worker */

const CACHE_NAME = 'qrcode-file-transfer-v1';
const ASSETS = [
    'index.html',
    'style.css',
    'app.js',
    'manifest.json'
];

// 安装时：缓存核心资源
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// 激活时：清理旧缓存
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// 拦截请求：缓存优先，网络回退
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then((response) => {
                // 只缓存同源请求
                if (response && response.ok && event.request.url.startsWith(self.location.origin)) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            }).catch(() => {
                // 离线时返回错误信息
                return new Response('离线模式：无法加载资源', { status: 503 });
            });
        })
    );
});
