// Annonce en cours de création. Sauvegardée en continu dans IndexedDB pour ne rien perdre
// si iOS ferme l'appli en arrière-plan (par ex. pendant que tu es sur Vinted).
import { dbGet, dbPut, dbDelete } from './db.js';

export const TYPES_PHOTO = [
  { id: 'face', label: 'Face' },
  { id: 'dos', label: 'Dos' },
  { id: 'profil', label: 'Profil (chaussures)' },
  { id: 'semelle', label: 'Semelle' },
  { id: 'etiquette_marque', label: 'Étiquette marque' },
  { id: 'etiquette_taille', label: 'Étiquette taille / composition' },
  { id: 'defaut', label: 'Défaut' },
  { id: 'detail', label: 'Détail' }
];

// Types pour lesquels on ne détoure pas (photos qui doivent rester réelles).
export const TYPES_SANS_DETOURAGE = ['etiquette_marque', 'etiquette_taille', 'defaut', 'detail', 'semelle'];

const CLE = 'courant';
let annonce = null;

function vide() {
  return { id: crypto.randomUUID(), creeLe: Date.now(), photos: [] };
}

export async function chargerAnnonce() {
  if (annonce) return annonce;
  try {
    annonce = (await dbGet('brouillons', CLE)) || null;
  } catch (e) {
    console.warn('Lecture du brouillon impossible', e);
  }
  if (!annonce) annonce = vide();
  for (const p of annonce.photos) p.url = URL.createObjectURL(p.blob);
  return annonce;
}

export async function sauverAnnonce() {
  if (!annonce) return;
  // On ne stocke pas les URL temporaires (elles ne survivent pas à un rechargement).
  const copie = { ...annonce, photos: annonce.photos.map(({ url, ...reste }) => reste) };
  try {
    await dbPut('brouillons', copie, CLE);
  } catch (e) {
    console.warn('Sauvegarde du brouillon impossible', e);
  }
}

export async function nouvelleAnnonce() {
  if (annonce) for (const p of annonce.photos) URL.revokeObjectURL(p.url);
  annonce = vide();
  await dbDelete('brouillons', CLE).catch(() => {});
  return annonce;
}

export function typeParDefaut(index) {
  return index === 0 ? 'face' : index === 1 ? 'dos' : 'detail';
}

// Sauvegarde immédiate quand l'appli passe en arrière-plan (ex. bascule vers Vinted sur iPhone).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') sauverAnnonce();
});
window.addEventListener('pagehide', () => sauverAnnonce());
