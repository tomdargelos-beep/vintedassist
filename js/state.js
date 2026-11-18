// Annonces en cours (brouillons), sauvegardées en continu dans IndexedDB pour ne rien perdre
// si iOS ferme l'appli en arrière-plan. Plusieurs annonces peuvent être en cours en même temps.
import { dbGet, dbGetAll, dbPut, dbDelete } from './db.js';

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

const STORE = 'brouillons';
const CLE_COURANTE = 'va.annonceCourante';
let courante = null;

function vide(photos = []) {
  return { id: crypto.randomUUID(), creeLe: Date.now(), photos };
}

// Les URL temporaires (url, urlDetoure…) ne survivent pas à un rechargement : on ne les stocke pas.
function serialiser(a) {
  return { ...a, photos: a.photos.map(p => Object.fromEntries(Object.entries(p).filter(([k]) => !k.startsWith('url')))) };
}

function hydrater(a) {
  for (const p of a.photos) p.url = URL.createObjectURL(p.blob);
  return a;
}

function liberer(a) {
  for (const p of a?.photos || []) for (const [k, v] of Object.entries(p)) if (k.startsWith('url') && v) URL.revokeObjectURL(v);
}

function memoriserCourante(id) {
  try { localStorage.setItem(CLE_COURANTE, id); } catch { /* stockage indisponible */ }
}

export async function sauverAnnonce(a = courante) {
  if (!a) return;
  try {
    await dbPut(STORE, serialiser(a), a.id);
  } catch (e) {
    console.warn('Sauvegarde impossible', e);
  }
}

// Migration : l'ancienne version stockait un seul brouillon sous la clé « courant ».
async function migrer() {
  try {
    const ancien = await dbGet(STORE, 'courant');
    if (ancien) {
      await dbPut(STORE, ancien, ancien.id);
      await dbDelete(STORE, 'courant');
      memoriserCourante(ancien.id);
    }
  } catch { /* rien à migrer */ }
}

export async function listerAnnonces() {
  await migrer();
  const toutes = (await dbGetAll(STORE).catch(() => [])) || [];
  return toutes.filter(a => a && a.id && Array.isArray(a.photos)).sort((x, y) => x.creeLe - y.creeLe);
}

export async function ouvrirAnnonce(id) {
  if (courante?.id === id) return courante;
  const a = await dbGet(STORE, id).catch(() => null);
  if (!a) return null;
  liberer(courante);
  courante = hydrater(a);
  memoriserCourante(id);
  return courante;
}

// Annonce affichée par les écrans Photos / Analyse / Retouche.
export async function chargerAnnonce() {
  if (courante) return courante;
  await migrer();
  let id = null;
  try { id = localStorage.getItem(CLE_COURANTE); } catch { /* ignoré */ }
  if (id && (await ouvrirAnnonce(id))) return courante;
  return nouvelleAnnonce();
}

export async function nouvelleAnnonce() {
  liberer(courante);
  courante = vide();
  memoriserCourante(courante.id);
  await sauverAnnonce();
  return courante;
}

// Crée une annonce complète (mode lot) sans changer l'annonce affichée.
export async function creerAnnonce(photos) {
  const a = vide(photos.map(p => ({ id: crypto.randomUUID(), blob: p.blob, type: p.type })));
  await sauverAnnonce(a);
  return a;
}

export async function supprimerAnnonce(id) {
  if (courante?.id === id) { liberer(courante); courante = null; }
  await dbDelete(STORE, id).catch(() => {});
}

export function typeParDefaut(index) {
  return index === 0 ? 'face' : index === 1 ? 'dos' : 'detail';
}

export function ordreType(type) {
  const i = TYPES_PHOTO.findIndex(t => t.id === type);
  return i < 0 ? 99 : i;
}

// Sauvegarde immédiate quand l'appli passe en arrière-plan (ex. bascule vers Vinted sur iPhone).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') sauverAnnonce();
});
window.addEventListener('pagehide', () => sauverAnnonce());
