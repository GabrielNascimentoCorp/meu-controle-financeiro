const CACHE_NAME = 'financas-v13-scrollfix';
const urls = ['./', './index.html', './style.css', './app.js', './manifest.json'];

self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(urls)));
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(ks => Promise.all(ks.map(k => {
        if(k !== CACHE_NAME) return caches.delete(k);
    }))));
    return self.clients.claim();
});

self.addEventListener('fetch', e => {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});