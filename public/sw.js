const CACHE_NAME = 'portsync-cache-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/favicon.ico'
];

// Installation : Mise en cache des ressources critiques de base (App Shell)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Pré-mise en cache de l\'App Shell...');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activation : Nettoyage des anciens caches obsolètes
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Nettoyage de l\'ancien cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch : Interception des requêtes avec des stratégies adaptées
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // On ignore les requêtes non-GET et les requêtes tierces de Supabase/API qui gèrent leur propre offline
  if (request.method !== 'GET' || request.url.includes('supabase.co') || request.url.includes('/api/')) {
    return;
  }

  // Stratégie pour la Navigation (accès aux pages HTML de l'application)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // On met à jour l'index en cache à chaque navigation réussie
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put('/index.html', responseClone);
          });
          return response;
        })
        .catch(() => {
          // Hors-ligne : on retourne le fichier index.html mis en cache
          console.log('[Service Worker] Mode hors-ligne détecté pour la navigation. Repli sur l\'App Shell.');
          return caches.match('/index.html');
        })
    );
    return;
  }

  // Stratégie Stale-While-Revalidate pour les scripts JS, styles CSS et images
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      }).catch((err) => {
        console.log('[Service Worker] Échec de la récupération réseau pour:', request.url, err);
      });

      // Retourne immédiatement la ressource du cache si elle existe, sinon attend la réponse réseau
      return cachedResponse || fetchPromise;
    })
  );
});
