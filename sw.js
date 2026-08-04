const CACHE_NAME = 'sydney-pwa-v4'; // 未來如果要更新 App，就把這裡改成 v2, v3...

// 1. 這裡放入你需要快取的核心檔案清單
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './sydney_places_with_coords.json' // 探索功能的景點資料庫
  // 如果你專案資料夾裡還有其他圖片，也可以照格式加進來
];

// 2. 安裝階段：將指定的檔案寫入快取
self.addEventListener('install', event => {
  self.skipWaiting(); // 強制立即接管控制權，不用等舊版關閉
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 [Service Worker] 正在快取核心檔案...');
        return cache.addAll(urlsToCache);
      })
  );
});

// 3. 啟動階段：清除舊版本的快取
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🧹 [Service Worker] 清除舊快取:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // 確保更新後立即控制所有的客戶端網頁
});

// 4. 攔截網路請求：「網路優先，失敗則讀取快取」
self.addEventListener('fetch', event => {
  // 排除第三方 API：天氣、地圖等動態服務不進快取，避免離線時報錯
  if (
    event.request.url.includes('api.open-meteo.com') || 
    event.request.url.includes('api.bigdatacloud.net') ||
    event.request.url.includes('google.com/maps')
  ) {
    return; // 這些請求直接放行，讓 index.html 裡的 try...catch 去處理失敗
  }

  // 核心的離線救援機制
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 如果有網路，就把抓到的新網頁/檔案存進快取順便更新
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
        }
        return response;
      })
      .catch(() => {
        // 🚨 飛航模式或無網路時，就會觸發這裡！從快取裡把檔案拿出來
        console.log('✈️ [Service Worker] 偵測到離線，載入快取檔案:', event.request.url);
        return caches.match(event.request);
      })
  );
});
