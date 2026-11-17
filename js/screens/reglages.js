import { h, toast } from '../ui.js';
import { lireReglages, ecrireReglages } from '../settings.js';
import { VERSION_APP } from '../app.js';
import { listerModeles } from '../ai/provider.js';

const FONDS = [
  ['auto', 'Automatique (selon le contraste)'],
  ['blanc', 'Blanc'],
  ['gris-clair', 'Gris clair'],
  ['anthracite', 'Gris anthracite'],
  ['noir', 'Noir']
];

export async function ecranReglages(app) {
  const r = lireReglages();

  const cle = h('input', { type: 'password', value: r.apiKey, autocomplete: 'off', autocapitalize: 'off', spellcheck: false, placeholder: 'Colle ta clé ici' });
  const voir = h('button', { class: 'icon-btn', type: 'button', onclick: () => {
    cle.type = cle.type === 'password' ? 'text' : 'password';
    voir.textContent = cle.type === 'password' ? 'Afficher' : 'Masquer';
  } }, 'Afficher');
  const modele = h('input', { type: 'text', value: r.modele, autocapitalize: 'off', spellcheck: false });
  const listeModeles = h('div', { class: 'muted' });
  async function tester() {
    listeModeles.textContent = 'Test en cours…';
    try {
      const noms = (await listerModeles({ ...r, apiKey: cle.value.trim() })).filter(n => /flash/.test(n));
      listeModeles.replaceChildren(h('p', {}, 'Clé valide. Modèles Flash disponibles (touche pour choisir) :'),
        ...noms.map(n => h('button', { class: 'mini', style: 'margin:3px', onclick: () => { modele.value = n; } }, n)));
    } catch (e) {
      listeModeles.textContent = e.message;
    }
  }
  const marge = h('input', { type: 'number', inputMode: 'numeric', min: 0, max: 100, value: r.margePct });
  const plancher = h('input', { type: 'number', inputMode: 'numeric', min: 0, max: 100, value: r.plancherPct });
  const fond = h('select', {}, FONDS.map(([v, l]) => h('option', { value: v, selected: v === r.fondDefaut }, l)));

  function enregistrer() {
    ecrireReglages({
      apiKey: cle.value.trim(),
      modele: modele.value.trim() || 'gemini-flash-latest',
      margePct: Number(marge.value) || 0,
      plancherPct: Number(plancher.value) || 0,
      fondDefaut: fond.value
    });
    toast('Réglages enregistrés');
  }

  app.append(
    h('div', { class: 'card' },
      h('label', {}, 'Clé API Gemini'),
      h('div', { class: 'row' }, cle, voir),
      h('p', { class: 'muted' },
        'Stockée uniquement sur cet appareil. À créer gratuitement sur ',
        h('a', { href: 'https://aistudio.google.com/apikey', target: '_blank', rel: 'noopener' }, 'Google AI Studio'),
        ' (ton abonnement Gemini Pro ne donne pas de clé API).'),
      h('button', { class: 'btn', onclick: tester }, 'Tester la clé'),
      h('label', {}, 'Modèle'), modele,
      h('p', { class: 'muted' }, 'Laisse « gemini-flash-latest » sauf problème.'),
      listeModeles
    ),
    h('div', { class: 'card' },
      h('label', {}, 'Marge de négociation (%)'), marge,
      h('p', { class: 'muted' }, 'Prix affiché = prix visé + cette marge, arrondi à un prix rond.'),
      h('label', {}, 'Écart du prix plancher (%)'), plancher,
      h('p', { class: 'muted' }, 'Prix plancher = prix visé moins cet écart. En dessous, tu refuses les offres.')
    ),
    h('div', { class: 'card' },
      h('label', {}, 'Fond par défaut'), fond
    ),
    h('button', { class: 'btn btn-primary', onclick: enregistrer }, 'Enregistrer'),
    h('p', { class: 'muted', style: 'text-align:center' }, `Version ${VERSION_APP}`)
  );
}
