// Couche d'abstraction : l'appli appelle ces fonctions, qui délèguent au fournisseur choisi.
// Pour passer à Claude plus tard : créer js/ai/claude.js avec les mêmes fonctions et l'ajouter ici.
import * as gemini from './gemini.js';
import { redimensionner } from '../images.js';

const FOURNISSEURS = { gemini };

function blobEnBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function analyserAnnonce(photos, reglages, onEtape = () => {}) {
  const f = FOURNISSEURS[reglages.fournisseur] || gemini;
  const base = { cle: reglages.apiKey, modele: reglages.modele };

  onEtape('Préparation des photos…');
  const images = [];
  for (const p of photos) {
    const petit = await redimensionner(p.blob, 1024, 0.85);
    images.push({ mimeType: 'image/jpeg', base64: await blobEnBase64(petit) });
  }

  onEtape('Analyse des photos par l\'IA…');
  const analyse = await f.analyserPhotos({ ...base, photos, images, onEtape });

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
    // On réutilise le modèle qui a fonctionné pour l'analyse.
    marche = await f.rechercherMarche({ ...base, modele: analyse.modele_utilise || base.modele, resume, onEtape });
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

export async function listerModeles(reglages) {
  const f = FOURNISSEURS[reglages.fournisseur] || gemini;
  return f.listerModeles(reglages.apiKey);
}
