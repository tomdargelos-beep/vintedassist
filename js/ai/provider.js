// Couche d'abstraction : l'appli appelle ces fonctions, qui délèguent au fournisseur choisi.
// Principal = Claude (fiable, payant) ; Gemini (gratuit) sert de secours si une clé est saisie, et inversement.
import * as gemini from './gemini.js';
import * as claude from './claude.js';
import { redimensionner } from '../images.js';

const FOURNISSEURS = { claude, gemini };
export const NOMS = { claude: 'Claude Opus 5.5', gemini: 'Gemini (gratuit)' };

function blobEnBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

const cleDe = (nom, r) => (nom === 'claude' ? r.cleClaude : r.apiKey);

// Fournisseurs utilisables, dans l'ordre d'essai.
export function ordreFournisseurs(r) {
  const principal = r.fournisseur === 'gemini' ? 'gemini' : 'claude';
  const secours = principal === 'claude' ? 'gemini' : 'claude';
  return [principal, secours].filter(n => cleDe(n, r));
}

// Essaie chaque fournisseur ; ne bascule que sur une erreur temporaire (surcharge, réseau, quota).
// En cas d'échec final, le message liste chaque IA essayée et sa raison.
async function avecSecours(r, onEtape, fn) {
  const ordre = ordreFournisseurs(r);
  if (!ordre.length) throw new Error('Aucune clé API enregistrée. Ajoute ta clé Claude dans les Réglages.');
  const echecs = [];
  for (const [i, nom] of ordre.entries()) {
    try {
      return { nom, res: await fn(FOURNISSEURS[nom], { cle: cleDe(nom, r), modele: r.modele }) };
    } catch (e) {
      echecs.push(`${NOMS[nom]} : ${e.message}`);
      const fin = e.status === undefined || i === ordre.length - 1;
      if (fin) {
        const manque = !r.cleClaude ? ' (Aucune clé Claude enregistrée : seule l\'IA gratuite a été utilisée.)' : '';
        throw new Error(echecs.join(' — Puis ') + manque);
      }
      onEtape(`${NOMS[nom]} indisponible, bascule sur ${NOMS[ordre[i + 1]]}…`);
    }
  }
}

export async function analyserAnnonce(photos, reglages, onEtape = () => {}) {
  onEtape('Préparation des photos…');
  const images = [];
  for (const p of photos) {
    const petit = await redimensionner(p.blob, 1024, 0.85);
    images.push({ mimeType: 'image/jpeg', base64: await blobEnBase64(petit) });
  }

  onEtape('Analyse des photos par l\'IA…');
  const { nom, res: analyse } = await avecSecours(reglages, onEtape,
    (f, base) => f.analyserPhotos({ ...base, photos, images, onEtape }));

  onEtape('Recherche des prix du marché…');
  let marche = null;
  let erreurMarche = null;
  try {
    const resume = [
      analyse.titre,
      analyse.marque?.valeur && `marque ${analyse.marque.valeur}`,
      analyse.taille?.valeur && `taille ${analyse.taille.valeur}`,
      analyse.etat?.valeur && `état ${analyse.etat.valeur}`,
      analyse.matiere?.valeur && `matière ${analyse.matiere.valeur}`
    ].filter(Boolean).join(', ');
    // On commence par le fournisseur qui a réussi l'analyse.
    const r2 = { ...reglages, fournisseur: nom };
    marche = (await avecSecours(r2, onEtape, (f, base) =>
      f.rechercherMarche({ ...base, modele: nom === 'gemini' ? (analyse.modele_utilise || base.modele) : base.modele, resume, onEtape }))).res;
  } catch (e) {
    console.warn('Recherche de marché impossible', e);
    erreurMarche = e.message;
  }

  // Fusion : si la recherche a trouvé des références, son prix visé l'emporte.
  const refs = marche?.references_marche || [];
  analyse.prix = refs.length
    ? { prix_vise: marche.prix_vise || analyse.prix.prix_vise, certitude: marche.certitude, justification: marche.justification, references_marche: refs }
    : { ...analyse.prix, certitude: 'faible', references_marche: [],
        justification: (erreurMarche ? 'Recherche de prix impossible : ' + erreurMarche + ' ' : 'Aucune référence de marché trouvée. ') + 'Estimation de l\'IA seule : ' + analyse.prix.justification };
  return analyse;
}

// Regroupe les photos d'un lot par article. Renvoie [{ description, photos: [{ index, type }] }],
// avec chaque photo exactement une fois (les oubliées vont dans un groupe « À classer »).
export async function grouperPhotos(photos, reglages, onEtape = () => {}) {
  onEtape('Préparation des photos…');
  const images = [];
  for (const p of photos) {
    const petit = await redimensionner(p.blob, 512, 0.8);
    images.push({ mimeType: 'image/jpeg', base64: await blobEnBase64(petit) });
  }
  onEtape(`Regroupement de ${photos.length} photos par article…`);
  const { res } = await avecSecours(reglages, onEtape, (f, base) => f.grouperPhotos({ ...base, images, onEtape }));
  const vues = new Set();
  const groupes = [];
  for (const g of res.groupes || []) {
    const ph = [];
    for (const x of g.photos || []) {
      const i = x.numero - 1;
      if (i >= 0 && i < photos.length && !vues.has(i)) { vues.add(i); ph.push({ index: i, type: x.type }); }
    }
    if (ph.length) groupes.push({ description: g.description || 'Article', photos: ph });
  }
  const oubliees = photos.map((_, i) => i).filter(i => !vues.has(i));
  if (oubliees.length) groupes.push({ description: 'À classer', photos: oubliees.map(i => ({ index: i, type: 'detail' })) });
  return groupes;
}

export async function listerModeles(nom, cle) {
  return FOURNISSEURS[nom].listerModeles(cle);
}
