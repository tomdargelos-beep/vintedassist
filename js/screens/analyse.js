import { h } from '../ui.js';
import { chargerAnnonce } from '../state.js';
import { lireReglages } from '../settings.js';
import { aller } from '../app.js';

export async function ecranAnalyse(app) {
  const annonce = await chargerAnnonce();
  const { apiKey } = lireReglages();
  app.append(
    h('div', { class: 'card' },
      h('p', {}, `${annonce.photos.length} photo(s) prête(s) pour l'analyse.`),
      h('p', { class: 'muted' }, 'L\'analyse par l\'IA (marque, taille, état, prix, titre, description) arrive à l\'étape 3.')
    ),
    apiKey ? null : h('div', { class: 'hint' },
      'Aucune clé API Gemini enregistrée. Ajoute-la dans les Réglages avant l\'étape 3.',
      h('button', { class: 'btn', onclick: () => aller('reglages') }, 'Ouvrir les Réglages')
    )
  );
}
