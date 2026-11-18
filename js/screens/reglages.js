// Réglages : enregistrés automatiquement à chaque modification (uniquement sur cet appareil).
import { h, toast } from '../ui.js';
import { lireReglages, ecrireReglages, nettoyerCle, diagnosticCle } from '../settings.js';
import { VERSION_APP } from '../app.js';
import { listerModeles } from '../ai/provider.js';
import { MODELES } from '../ai/claude.js';

const FONDS = [
  ['auto', 'Automatique (contraste)'], ['studio', 'Studio (blanc cassé)'], ['blanc', 'Blanc'],
  ['gris-clair', 'Gris clair'], ['anthracite', 'Gris anthracite'], ['noir', 'Noir']
];

const ligne = (label, champ, droite = null) =>
  h('div', { class: 'ligne' }, h('div', { class: 'ligne-corps' }, h('div', { class: 'ligne-label' }, label), champ), droite);
const interrupteur = (label, input) => { input.classList.add('switch'); return h('label', { class: 'ligne interrupteur' }, h('span', { class: 'ligne-corps' }, label), input); };

export async function ecranReglages(app) {
  const r = lireReglages();
  let delai;
  const enregistrer = () => {
    clearTimeout(delai);
    delai = setTimeout(() => { ecrireReglages(lire()); toast('Enregistré'); }, 300);
  };
  const champ = (tag, attrs) => { const el = h(tag, attrs); el.addEventListener('change', enregistrer); return el; };
  const choix = (options, valeur) => {
    const s = champ('select', {});
    s.append(...options.map(([v, l]) => h('option', { value: v, selected: v === valeur }, l)));
    return s;
  };
  const coche = v => champ('input', { type: 'checkbox', checked: !!v });

  // Champs
  const modeleClaude = choix(MODELES.map(m => [m.id, m.nom]), r.modeleClaude);
  const fournisseur = choix([['claude', 'Claude'], ['gemini', 'Gemini (gratuit, souvent surchargé)']], r.fournisseur === 'gemini' ? 'gemini' : 'claude');
  const cleClaude = champ('input', { type: 'password', value: r.cleClaude, autocomplete: 'off', autocapitalize: 'off', spellcheck: false, placeholder: 'sk-ant-…' });
  const cleGemini = champ('input', { type: 'password', value: r.apiKey, autocomplete: 'off', autocapitalize: 'off', spellcheck: false, placeholder: 'AIza… (optionnelle)' });
  const modele = champ('input', { type: 'text', value: r.modele, autocapitalize: 'off', spellcheck: false });
  const recherchePrix = coche(r.recherchePrix);
  const marge = champ('input', { type: 'number', inputMode: 'numeric', min: 0, max: 100, value: r.margePct });
  const plancher = champ('input', { type: 'number', inputMode: 'numeric', min: 0, max: 100, value: r.plancherPct });
  const mentionIA = champ('textarea', { rows: 4 });
  mentionIA.value = r.mentionIA;
  const retoucheAuto = coche(r.retoucheAuto);
  const fond = choix(FONDS, r.fondDefaut);
  const redressementAuto = coche(r.redressementAuto !== false);
  const iaImage = coche(r.iaImage);
  const repassageAuto = coche(r.repassageAuto);
  const modeleImage = champ('input', { type: 'text', value: r.modeleImage, autocapitalize: 'off', spellcheck: false, placeholder: 'automatique' });

  function lire() {
    return {
      modeleClaude: modeleClaude.value, fournisseur: fournisseur.value,
      cleClaude: nettoyerCle(cleClaude.value), apiKey: nettoyerCle(cleGemini.value),
      modele: modele.value.trim() || 'gemini-flash-latest',
      recherchePrix: recherchePrix.checked, margePct: Number(marge.value) || 0, plancherPct: Number(plancher.value) || 0,
      mentionIA: mentionIA.value.trim(), retoucheAuto: retoucheAuto.checked, fondDefaut: fond.value,
      redressementAuto: redressementAuto.checked, iaImage: iaImage.checked, repassageAuto: repassageAuto.checked,
      modeleImage: modeleImage.value.trim()
    };
  }

  // Test d'une clé : diagnostic du format puis appel réel à la liste des modèles.
  function testeur(fournisseurCle, input) {
    const res = h('div', { class: 'muted petit', style: 'padding: 0 16px 12px' });
    const btn = h('button', { class: 'mini texte', type: 'button', onclick: async () => {
      input.value = nettoyerCle(input.value);
      res.textContent = 'Test… ' + diagnosticCle(input.value, fournisseurCle);
      try {
        const modeles = await listerModeles(fournisseurCle, input.value);
        ecrireReglages(lire());
        res.textContent = fournisseurCle === 'claude'
          ? (modeles.includes(modeleClaude.value) ? 'Clé valide, modèle disponible.' : 'Clé valide, mais le modèle choisi n\'est pas listé pour ce compte.')
          : `Clé valide. Modèles Flash : ${modeles.filter(n => /flash/.test(n)).slice(0, 4).join(', ') || 'aucun'}.`;
      } catch (e) {
        res.textContent = e.message + ' ' + diagnosticCle(input.value, fournisseurCle);
      }
    } }, 'Tester');
    return { btn, res };
  }
  const tClaude = testeur('claude', cleClaude);
  const tGemini = testeur('gemini', cleGemini);

  app.append(
    h('h1', { class: 'grand-titre' }, 'Réglages'),

    h('h2', {}, 'Rédaction des annonces'),
    h('div', { class: 'section' },
      ligne('Modèle Claude', modeleClaude),
      ligne('Clé API Claude', cleClaude, tClaude.btn), tClaude.res,
      interrupteur('Rechercher les prix sur le web (plus cher)', recherchePrix)),
    h('p', { class: 'muted petit', style: 'margin: 8px 6px' },
      'Clé à créer sur ', h('a', { href: 'https://console.anthropic.com/settings/keys', target: '_blank', rel: 'noopener' }, 'console.anthropic.com'),
      '. Stockée uniquement sur ce téléphone. Haiku suffit dans la plupart des cas ; passe sur Sonnet si tu vois des erreurs.'),

    h('h2', {}, 'Prix'),
    h('div', { class: 'section' },
      ligne('Marge de négociation (%)', marge),
      ligne('Écart du prix plancher (%)', plancher)),

    h('h2', {}, 'Photos'),
    h('div', { class: 'section' },
      ligne('Mention si les photos sont retouchées', mentionIA),
      interrupteur('Détourer dans l\'appli après la rédaction', retoucheAuto),
      ligne('Fond par défaut (détourage)', fond),
      interrupteur('Redresser automatiquement le vêtement', redressementAuto)),

    h('h2', {}, 'Secours et options avancées'),
    h('div', { class: 'section' },
      ligne('IA principale', fournisseur),
      ligne('Clé API Gemini (secours gratuit)', cleGemini, tGemini.btn), tGemini.res,
      ligne('Modèle Gemini', modele),
      interrupteur('Repassage par l\'IA via l\'API Google (payant)', iaImage),
      interrupteur('… automatiquement à chaque annonce', repassageAuto),
      ligne('Modèle d\'image Gemini', modeleImage)),

    h('p', { class: 'muted petit centre', style: 'margin-top:24px' }, `Vinted Assist · version ${VERSION_APP}`)
  );
}
