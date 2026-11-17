import { h, toast } from '../ui.js';
import { lireReglages, ecrireReglages, nettoyerCle, diagnosticCle } from '../settings.js';
import { VERSION_APP } from '../app.js';
import { listerModeles } from '../ai/provider.js';

const FONDS = [
  ['auto', 'Automatique (selon le contraste)'],
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
  const gemini = blocCle({
    titre: 'Clé API Gemini (secours gratuit)', valeur: r.apiKey, fournisseur: 'gemini',
    aide: ['Optionnelle. Gratuite sur ', h('a', { href: 'https://aistudio.google.com/apikey', target: '_blank', rel: 'noopener' }, 'Google AI Studio'),
      '. Utilisée si Claude est indisponible.'],
    extra: [h('label', {}, 'Modèle Gemini'), modele],
    onValide: (cle, modeles, res) => {
      ecrireReglages({ apiKey: cle });
      const noms = modeles.filter(n => /flash/.test(n));
      res.replaceChildren(h('p', {}, 'Clé valide et enregistrée. Modèles Flash disponibles (touche pour choisir) :'),
        ...noms.map(n => h('button', { class: 'mini', style: 'margin:3px', onclick: () => { modele.value = n; } }, n)));
    }
  });

  const marge = h('input', { type: 'number', inputMode: 'numeric', min: 0, max: 100, value: r.margePct });
  const plancher = h('input', { type: 'number', inputMode: 'numeric', min: 0, max: 100, value: r.plancherPct });
  const fond = h('select', {}, FONDS.map(([v, l]) => h('option', { value: v, selected: v === r.fondDefaut }, l)));

  function enregistrer() {
    ecrireReglages({
      fournisseur: fournisseur.value,
      cleClaude: nettoyerCle(claude.input.value),
      apiKey: nettoyerCle(gemini.input.value),
      modele: modele.value.trim() || 'gemini-flash-latest',
      margePct: Number(marge.value) || 0,
      plancherPct: Number(plancher.value) || 0,
      fondDefaut: fond.value
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
    h('div', { class: 'card' }, h('label', {}, 'Fond par défaut'), fond),
    h('button', { class: 'btn btn-primary', onclick: enregistrer }, 'Enregistrer'),
    h('p', { class: 'muted', style: 'text-align:center' }, `Version ${VERSION_APP}`)
  );
}
