// Réglages stockés uniquement dans le localStorage de l'appareil (jamais dans le code).
const CLE = 'va.reglages';

export const DEFAUTS = {
  apiKey: '',
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
