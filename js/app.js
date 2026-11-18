// Point d'entrée : routeur par « hash » (#/photos, #/reglages…) + enregistrement du service worker.
import { ecranAccueil } from './screens/accueil.js';
import { ecranPhotos } from './screens/photos.js';
import { ecranAnalyse } from './screens/analyse.js';
import { ecranReglages } from './screens/reglages.js';
import { ecranHistorique } from './screens/historique.js';
import { ecranRetouche } from './screens/retouche.js';
import { ecranLot } from './screens/lot.js';
import { icone } from './icones.js';

export const VERSION_APP = '1.0.0';

const ROUTES = {
  '': { titre: '', ecran: ecranAccueil, retour: null, reglages: true },
  photos: { titre: 'Photos', ecran: ecranPhotos, retour: '' },
  analyse: { titre: 'Annonce', ecran: ecranAnalyse, retour: '' },
  retouche: { titre: 'Retouche', ecran: ecranRetouche, retour: 'analyse' },
  lot: { titre: 'Plusieurs articles', ecran: ecranLot, retour: '' },
  reglages: { titre: '', ecran: ecranReglages, retour: '' },
  historique: { titre: 'Historique', ecran: ecranHistorique, retour: '' }
};

export function aller(route) {
  location.hash = '#/' + route;
}

async function afficher() {
  const nom = location.hash.replace(/^#\/?/, '');
  const route = ROUTES[nom] || ROUTES[''];
  document.getElementById('titre').textContent = route.titre;
  const retour = document.getElementById('btn-retour');
  retour.hidden = route.retour === null;
  retour.onclick = () => aller(route.retour);
  if (!retour.firstChild) retour.append(icone('retour', 24));
  const droite = document.getElementById('btn-droite');
  if (!droite.firstChild) droite.append(icone('reglages', 22));
  droite.hidden = !route.reglages;
  droite.onclick = () => aller('reglages');
  const app = document.getElementById('app');
  app.replaceChildren();
  window.scrollTo(0, 0);
  try {
    await route.ecran(app);
  } catch (e) {
    console.error(e);
    app.textContent = 'Erreur : ' + e.message;
  }
}

window.addEventListener('hashchange', afficher);
afficher();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(e => console.warn('Service worker non enregistré', e));
}
