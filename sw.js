// Service worker : met l'appli en cache pour qu'elle s'ouvre vite et hors connexion.
// Stratégie « réseau d'abord » : en ligne tu as toujours la dernière version, hors ligne le cache prend le relais.
const CACHE = 'va-v0.9.0';
const CACHE_DONNEES = 'va-donnees-1'; // conservé d'une version à l'autre
const COQUILLE = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/app.js', './js/ui.js', './js/db.js', './js/state.js', './js/settings.js', './js/images.js', './js/prix.js', './js/data/vinted.js',
  './js/ai/provider.js', './js/ai/gemini.js', './js/ai/claude.js', './js/vendor/anthropic-sdk-1.4.0.mjs', './js/ai/schema.js', './js/ai/prompt.js',
  './js/screens/accueil.js', './js/screens/photos.js', './js/screens/analyse.js',
  './js/screens/reglages.js', './js/screens/historique.js', './js/screens/retouche.js', './js/screens/lot.js', './js/retouche.js', './js/gemini-app.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(cles => Promise.all(cles.filter(k => k.startsWith('va-v') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  // On ne touche qu'aux fichiers de l'appli (jamais aux appels vers l'API Gemini, etc.).
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // Données du détourage (≈ 55 Mo, nommées par empreinte donc jamais modifiées) : cache d'abord.
  if (req.url.includes('/assets/detourage/') || req.url.includes('/js/vendor/')) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(rep => {
      if (rep.ok) { const copie = rep.clone(); caches.open(CACHE_DONNEES).then(c => c.put(req, copie)); }
      return rep;
    })));
    return;
  }
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
