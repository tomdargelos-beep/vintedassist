// Réglages stockés uniquement dans le localStorage de l'appareil (jamais dans le code).
const CLE = 'va.reglages';

export const DEFAUTS = {
  fournisseur: 'gemini',
  apiKey: '',
  modele: 'gemini-flash-latest', // alias officiel qui suit le dernier modèle Flash
  margePct: 15,      // prix affiché = prix visé + marge
  plancherPct: 10,   // prix plancher = prix visé - écart
  fondDefaut: 'auto' // auto | blanc | gris-clair | anthracite | noir
};

export function lireReglages() {
  try {
    return { ...DEFAUTS, ...JSON.parse(localStorage.getItem(CLE) || '{}') };
  } catch {
    return { ...DEFAUTS };
  }
}

export function ecrireReglages(maj) {
  const r = { ...lireReglages(), ...maj };
  localStorage.setItem(CLE, JSON.stringify(r));
  return r;
}

// Nettoie une clé collée depuis iOS : espaces, retours à la ligne, caractères invisibles, guillemets.
export function nettoyerCle(cle) {
  return String(cle || '').replace(/[\s\u200B-\u200D\u2060\uFEFF"'«»“”]/g, '');
}

// Diagnostic sans révéler la clé : longueur et début.
export function diagnosticCle(cle) {
  const c = nettoyerCle(cle);
  if (!c) return 'Aucune clé saisie.';
  const debut = c.slice(0, 4);
  const ok = c.startsWith('AIza') && c.length === 39;
  return ok
    ? `Format correct (${c.length} caractères, commence par « AIza »).`
    : `Format inhabituel : ${c.length} caractères, commence par « ${debut} ». Une clé Gemini fait normalement 39 caractères et commence par « AIza ».`;
}
