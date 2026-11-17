import { h, toast } from '../ui.js';
import { lireReglages, ecrireReglages, nettoyerCle, diagnosticCle } from '../settings.js';
import { VERSION_APP } from '../app.js';
import { listerModeles } from '../ai/provider.js';

const FONDS = [
  ['auto', 'Automatique (selon le contraste)'],
  ['studio', 'Studio (blanc cassé)'],
  ['blanc', 'Blanc'],
  ['gris-clair', 'Gris clair'],
  ['anthracite', 'Gris anthracite'],
  ['noir', 'Noir']
];

// Bloc « clé API » réutilisable (champ masqué, bouton Afficher, bouton Tester, résultat).
function blocCle({ titre, valeur, fournisseur, aide, onValide, extra = [] }) {
  const cle = h('input', { type: 'password', value: valeur, autocomplete: 'off', autocapitalize: 'off', spellcheck: false, placeholder: 'Colle ta clé ici' });
  const voir = h('button', { class: 'icon-btn', type: 'button', onclick: () => {
    cle.type = cle.type === 'password' ? 'text' : 'password';
    voir.textContent = cle.type === 'password' ? 'Afficher' : 'Masquer';
  } }, 'Afficher');
  const resultat = h('div', { class: 'muted' });
  async function tester() {
    cle.value = nettoyerCle(cle.value);
    resultat.textContent = 'Test en cours… ' + diagnosticCle(cle.value, fournisseur);
    try {
      const modeles = await listerModeles(fournisseur, cle.value);
      onValide(cle.value, modeles, resultat);
    } catch (e) {
      resultat.textContent = e.message + ' ' + diagnosticCle(cle.value, fournisseur);
    }
  }
  return {
    input: cle,
    noeud: h('div', { class: 'card' },
      h('label', {}, titre),
      h('div', { class: 'row' }, cle, voir),
      h('p', { class: 'muted' }, ...aide),
      h('button', { class: 'btn', onclick: tester }, 'Tester la clé'),
      ...extra,
      resultat)
  };
}

export async function ecranReglages(app) {
  const r = lireReglages();

  const fournisseur = h('select', {},
    h('option', { value: 'claude', selected: r.fournisseur !== 'gemini' }, 'Claude Opus 5.5 (payant, fiable)'),
    h('option', { value: 'gemini', selected: r.fournisseur === 'gemini' }, 'Gemini (gratuit, souvent surchargé)'));

  const claude = blocCle({
    titre: 'Clé API Claude', valeur: r.cleClaude, fournisseur: 'claude',
    aide: ['À créer sur ', h('a', { href: 'https://console.anthropic.com/settings/keys', target: '_blank', rel: 'noopener' }, 'console.anthropic.com'),
      ' (crédits prépayés, environ 0,10 à 0,15 € par annonce). Stockée uniquement sur cet appareil.'],
    onValide: (cle, modeles, res) => {
      ecrireReglages({ cleClaude: cle });
      res.textContent = modeles.includes('claude-opus-5-5')
        ? 'Clé valide et enregistrée. Claude Opus 5.5 est disponible.'
        : 'Clé valide et enregistrée, mais Claude Opus 5.5 n\'apparaît pas dans la liste des modèles de ce compte.';
    }
  });

  const modele = h('input', { type: 'text', value: r.modele, autocapitalize: 'off', spellcheck: false });
  const modeleImage = h('input', { type: 'text', value: r.modeleImage, autocapitalize: 'off', spellcheck: false, placeholder: 'automatique' });
  const mentionIA = h('textarea', { rows: 5 });
  mentionIA.value = r.mentionIA;
  const gemini = blocCle({
    titre: 'Clé API Gemini (secours gratuit)', valeur: r.apiKey, fournisseur: 'gemini',
    aide: ['Optionnelle. Gratuite sur ', h('a', { href: 'https://aistudio.google.com/apikey', target: '_blank', rel: 'noopener' }, 'Google AI Studio'),
      '. Utilisée si Claude est indisponible.'],
    extra: [h('label', {}, 'Modèle Gemini (analyse)'), modele,
      h('label', {}, 'Modèle Gemini (photos repassées par l\'IA)'), modeleImage,
      h('p', { class: 'muted' }, 'Laisse vide pour la détection automatique. L\'édition d\'image peut demander une facturation activée sur ta clé Google.')],
    onValide: (cle, modeles, res) => {
      ecrireReglages({ apiKey: cle });
      const noms = modeles.filter(n => /flash/.test(n));
      const images = modeles.filter(n => /image/.test(n) && /^gemini/.test(n));
      res.replaceChildren(h('p', {}, 'Clé valide et enregistrée. Modèles Flash disponibles (touche pour choisir) :'),
        ...noms.map(n => h('button', { class: 'mini', style: 'margin:3px', onclick: () => { modele.value = n; } }, n)),
        h('p', {}, images.length ? 'Modèles d\'image disponibles (touche pour choisir) :' : 'Aucun modèle d\'image disponible avec cette clé.'),
        ...images.map(n => h('button', { class: 'mini', style: 'margin:3px', onclick: () => { modeleImage.value = n; } }, n)));
    }
  });

  const marge = h('input', { type: 'number', inputMode: 'numeric', min: 0, max: 100, value: r.margePct });
  const plancher = h('input', { type: 'number', inputMode: 'numeric', min: 0, max: 100, value: r.plancherPct });
  const fond = h('select', {}, FONDS.map(([v, l]) => h('option', { value: v, selected: v === r.fondDefaut }, l)));
  const repassageAuto = h('input', { type: 'checkbox', checked: !!r.repassageAuto });
  const iaImage = h('input', { type: 'checkbox', checked: !!r.iaImage });
  const redressementAuto = h('input', { type: 'checkbox', checked: r.redressementAuto !== false });
  const retoucheAuto = h('input', { type: 'checkbox', checked: !!r.retoucheAuto });

  function enregistrer() {
    ecrireReglages({
      fournisseur: fournisseur.value,
      cleClaude: nettoyerCle(claude.input.value),
      apiKey: nettoyerCle(gemini.input.value),
      modele: modele.value.trim() || 'gemini-flash-latest',
      modeleImage: modeleImage.value.trim(),
      mentionIA: mentionIA.value.trim(),
      margePct: Number(marge.value) || 0,
      plancherPct: Number(plancher.value) || 0,
      fondDefaut: fond.value,
      repassageAuto: repassageAuto.checked,
      iaImage: iaImage.checked,
      redressementAuto: redressementAuto.checked,
      retoucheAuto: retoucheAuto.checked
    });
    toast('Réglages enregistrés');
  }

  app.append(
    h('div', { class: 'card' },
      h('label', {}, 'IA principale'), fournisseur,
      h('p', { class: 'muted' }, 'Si l\'IA principale est indisponible, l\'appli bascule seule sur l\'autre (si sa clé est saisie).')),
    claude.noeud,
    gemini.noeud,
    h('div', { class: 'card' },
      h('label', {}, 'Marge de négociation (%)'), marge,
      h('p', { class: 'muted' }, 'Prix affiché = prix visé + cette marge, arrondi à un prix rond.'),
      h('label', {}, 'Écart du prix plancher (%)'), plancher,
      h('p', { class: 'muted' }, 'Prix plancher = prix visé moins cet écart. En dessous, tu refuses les offres.')
    ),
    h('div', { class: 'card' }, h('label', {}, 'Fond par défaut'), fond,
      h('label', { class: 'case' }, retoucheAuto, ' Détourer dans l\'appli après l\'analyse (mode lot)'),
      h('p', { class: 'muted' }, 'Décoché : le mode lot ne fait que trier et analyser ; les photos se retouchent dans l\'appli Gemini.'),
      h('label', { class: 'case' }, redressementAuto, ' Redresser automatiquement le vêtement'),
      h('p', { class: 'muted' }, 'Remet le vêtement d\'aplomb (simple rotation, gratuit, le vêtement n\'est pas modifié).'),
      h('label', { class: 'case' }, iaImage, ' Repassage par l\'IA (payant chez Google)'),
      h('label', { class: 'case' }, repassageAuto, ' … automatiquement à chaque annonce'),
      h('p', { class: 'muted' }, 'Désactivé : l\'édition d\'image de Google demande une facturation activée sur ta clé.')),
    h('div', { class: 'card' }, h('label', {}, 'Mention si une photo est retouchée par l\'IA'), mentionIA,
      h('p', { class: 'muted' }, 'Ajoutée automatiquement à la description. Elle doit rester exacte : la photo IA est défroissée, pas seulement détourée.')),
    h('button', { class: 'btn btn-primary', onclick: enregistrer }, 'Enregistrer'),
    h('p', { class: 'muted', style: 'text-align:center' }, `Version ${VERSION_APP}`)
  );
}
