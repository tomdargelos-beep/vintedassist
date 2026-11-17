// Service worker : met l'appli en cache pour qu'elle s'ouvre vite et hors connexion.
// Stratégie « réseau d'abord » : en ligne tu as toujours la dernière version, hors ligne le cache prend le relais.
const CACHE = 'va-v0.2.0';
const COQUILLE = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/app.js', './js/ui.js', './js/db.js', './js/state.js', './js/settings.js', './js/images.js',
  './js/screens/accueil.js', './js/screens/photos.js', './js/screens/analyse.js',
  './js/screens/reglages.js', './js/screens/historique.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(cles => Promise.all(cles.filter(k => k.startsWith('va-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  // On ne touche qu'aux fichiers de l'appli (jamais aux appels vers l'API Gemini, etc.).
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(rep => {
        if (rep.ok) {
          const copie = rep.clone();
          caches.open(CACHE).then(c => c.put(req, copie));
        }
        return rep;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
