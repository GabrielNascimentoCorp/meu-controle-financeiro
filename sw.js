// --- CONFIGURAÇÃO ---
// Mude este número SEMPRE que fizer uma alteração no código (v3, v4, v5...)
// Isso avisa o celular que existe uma nova versão para baixar.
const CACHE_NAME = 'financas-v3'; 

const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap'
];

// 1. INSTALAÇÃO: Força o novo sistema a entrar imediatamente
self.addEventListener('install', event => {
  self.skipWaiting(); // Pula a fila de espera e instala logo
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// 2. ATIVAÇÃO: A faxina automática (O SEGREDO ESTÁ AQUI)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          // Se o cache no celular for diferente da versão atual (ex: v2 vs v3)
          if (cache !== CACHE_NAME) {
            console.log('Limpando versão antiga:', cache);
            return caches.delete(cache); // Apaga a versão velha sozinho!
          }
        })
      );
    })
  );
  return self.clients.claim(); // Assume o controle da página na hora
});

// 3. INTERCEPTAÇÃO: Estratégia "Internet Primeiro" (Network First)
// Tenta buscar o site novo na internet. Se tiver internet, mostra o novo e atualiza o cache.
// Se estiver offline, mostra o que tem salvo.
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Se a internet funcionou, atualiza o cache com a versão nova
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
            if(event.request.method === 'GET') {
                cache.put(event.request, responseClone);
            }
        });
        return response;
      })
      .catch(() => {
        // Se deu erro (sem internet), usa o cache salvo
        return caches.match(event.request);
      })
  );
});