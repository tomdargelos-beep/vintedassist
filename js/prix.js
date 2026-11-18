// Calcul des prix dans le code (l'IA ne fournit que le prix visé).
const PRIX_RONDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 20, 22, 25, 28, 30, 35, 40, 45, 50,
  55, 60, 65, 70, 75, 80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200
];

function rondSuperieur(x) {
  const r = PRIX_RONDS.find(p => p >= x - 0.01);
  return r ?? Math.ceil(x / 25) * 25;
}

export function calculerPrix(prixVise, margePct, plancherPct) {
  const vise = Math.max(1, Math.round(Number(prixVise) || 0));
  return {
    prix_vise: vise,
    prix_affiche: rondSuperieur(vise * (1 + margePct / 100)),
    prix_plancher: Math.max(1, Math.floor(vise * (1 - plancherPct / 100)))
  };
}
