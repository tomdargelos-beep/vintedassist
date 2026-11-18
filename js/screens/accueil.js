import { h, estIOS, estInstallee } from '../ui.js';
import { icone } from '../icones.js';
import { listerAnnonces, nouvelleAnnonce, ouvrirAnnonce, statutDe } from '../state.js';
import { aller } from '../app.js';

function statut(a) {
  if (a.analyse) return { texte: a.retoucheGemini ? 'Prête · photos envoyées à Gemini' : 'Prête', ok: true };
  return { texte: `${a.photos.length} photo${a.photos.length > 1 ? 's' : ''} · à rédiger`, ok: false };
}

export async function ecranAccueil(app) {
  app.append(h('h1', { class: 'grand-titre' }, 'Annonces'));

  if (estIOS() && !estInstallee()) {
    app.append(h('div', { class: 'hint' },
      'Pour installer l\'appli : bouton Partager de Safari, puis « Sur l\'écran d\'accueil ».'));
  }

  app.append(h('div', { class: 'actions-accueil' },
    h('button', { class: 'tuile principale', onclick: () => aller('lot') },
      icone('pile', 26), h('div', {}, h('strong', {}, 'Ajouter des photos'), h('span', { class: 'muted' }, 'Un ou plusieurs articles'))),
    h('button', { class: 'tuile', onclick: async () => { await nouvelleAnnonce(); aller('photos'); } },
      icone('plus', 26), h('div', {}, h('strong', {}, 'Un article'), h('span', { class: 'muted' }, 'Photos triées à la main')))
  ));

  const toutes = await listerAnnonces();
  const annonces = toutes.filter(a => (a.photos.length || a.analyse) && statutDe(a) === 'en_cours');
  const enVente = toutes.filter(a => statutDe(a) === 'publiee').length;
  const vendues = toutes.filter(a => statutDe(a) === 'vendue').length;
  const lienHistorique = h('div', { class: 'section', style: 'margin-top:22px' },
    h('div', { class: 'annonce-item', role: 'button', onclick: () => aller('historique') },
      h('div', { class: 'ligne-corps' }, h('div', { class: 'titre' }, 'Historique'),
        h('div', { class: 'muted petit' }, `${enVente} en vente · ${vendues} vendue${vendues > 1 ? 's' : ''}`)),
      h('span', { class: 'muted' }, icone('suite', 18))));
  if (!annonces.length) {
    app.append(h('p', { class: 'empty' }, 'Aucune annonce en cours.'), lienHistorique);
    return;
  }
  app.append(h('h2', {}, `En cours · ${annonces.length}`));
  const liste = h('div', { class: 'section' });
  for (const a of annonces) {
    const st = statut(a);
    const url = a.photos[0] ? URL.createObjectURL(a.photos[0].blob) : '';
    liste.append(h('div', { class: 'annonce-item', role: 'button', onclick: async () => {
      await ouvrirAnnonce(a.id);
      aller(a.analyse ? 'analyse' : 'photos');
    } },
      url ? h('img', { src: url, alt: '' }) : h('div', { class: 'vide' }),
      h('div', { class: 'ligne-corps' },
        h('div', { class: 'titre' }, a.analyse?.titre || 'Sans titre'),
        h('div', { class: 'muted petit' }, h('span', { class: 'pastille' + (st.ok ? ' ok' : '') }), st.texte)),
      h('span', { class: 'muted' }, icone('suite', 18))
    ));
  }
  app.append(liste, lienHistorique);
}
