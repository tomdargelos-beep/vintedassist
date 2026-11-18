// Réglages stockés uniquement dans le localStorage de l'appareil (jamais dans le code).
const CLE = 'va.reglages';

export const DEFAUTS = {
  fournisseur: 'claude',  // principal : claude | gemini
  cleClaude: '',
  modeleClaude: 'claude-haiku-5-5', // économique par défaut (choix de Tom : réduire le coût)
  recherchePrix: false,              // recherche web des prix : désactivée (coût) ; Tom fixe ses prix
  apiKey: '',              // clé Gemini (secours)
  modele: 'gemini-flash-latest', // alias officiel qui suit le dernier modèle Flash
  modeleImage: '',         // modèle Gemini d'édition d'image (vide = détection automatique)
  mentionIA: 'Photos de l\'article retouchées numériquement (fond et défroissage) pour le mettre en valeur ; l\'article est bien celui photographié. Les photos d\'étiquettes et de détails ne sont pas retouchées. N\'hésitez pas à me demander des photos supplémentaires ou de détail.',
  margePct: 15,      // prix affiché = prix visé + marge
  plancherPct: 10,   // prix plancher = prix visé - écart
  fondDefaut: 'auto', // auto | studio | blanc | gris-clair | anthracite | noir
  iaImage: false,       // repassage par IA (Gemini image, payant) : désactivé par choix de Tom
  repassageAuto: false, // version IA générée automatiquement (si iaImage)
  redressementAuto: true, // remet le vêtement d'aplomb (rotation seule, gratuit)
  retoucheAuto: false     // détourage dans l'appli après l'analyse (sinon : retouche via l'appli Gemini)
};

// Ancienne mention par défaut (repassage d'une seule photo) : devenue inexacte avec la retouche via Gemini.
const ANCIENNE_MENTION = 'Photo de couverture retouchée numériquement (fond et défroissage) pour mettre l\'article en valeur. Les photos suivantes montrent l\'article réel, sans retouche. N\'hésitez pas à me demander des photos supplémentaires ou de détail.';

export function lireReglages() {
  try {
    const r = { ...DEFAUTS, ...JSON.parse(localStorage.getItem(CLE) || '{}') };
    if (r.mentionIA === ANCIENNE_MENTION) r.mentionIA = DEFAUTS.mentionIA;
    return r;
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
export function diagnosticCle(cle, fournisseur = 'gemini') {
  const c = nettoyerCle(cle);
  if (!c) return 'Aucune clé saisie.';
  if (fournisseur === 'claude') {
    return c.startsWith('sk-ant-')
      ? `Format correct (commence par « sk-ant- », ${c.length} caractères).`
      : `Format inhabituel : commence par « ${c.slice(0, 4)} ». Une clé Claude commence par « sk-ant- ».`;
  }
  const ok = c.startsWith('AIza') && c.length === 39;
  return ok
    ? `Format correct (${c.length} caractères, commence par « AIza »).`
    : `Format inhabituel : ${c.length} caractères, commence par « ${c.slice(0, 4)} ». Une clé Gemini fait normalement 39 caractères et commence par « AIza ».`;
}
