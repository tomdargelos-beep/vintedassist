import { h, estIOS, estInstallee } from '../ui.js';
import { listerAnnonces, nouvelleAnnonce, ouvrirAnnonce, supprimerAnnonce } from '../state.js';
import { aller } from '../app.js';

function statut(a) {
  if (a.photos.some(p => p.detoure || p.sansDetourage)) return 'Photos retouchées';
  if (a.analyse) return 'Analysée';
  if (a.photos.length) return `${a.photos.length} photo${a.photos.length > 1 ? 's' : ''}, à analyser`;
  return 'Vide';
}

export async function ecranAccueil(app) {
  if (estIOS() && !estInstallee()) {
    app.append(h('div', { class: 'hint' },
      h('strong', {}, 'Installer l\'appli : '),
      'dans Safari, touche le bouton Partager (carré avec une flèche), puis « Sur l\'écran d\'accueil ».'
    ));
  }

  app.append(
    h('button', { class: 'btn btn-primary', onclick: async () => { await nouvelleAnnonce(); aller('photos'); } }, 'Nouvelle annonce'),
    h('button', { class: 'btn', onclick: () => aller('lot') }, 'Plusieurs annonces d\'un coup')
  );

  const annonces = (await listerAnnonces()).filter(a => a.photos.length || a.analyse);
  if (annonces.length) {
    app.append(h('h2', {}, `Annonces en cours (${annonces.length})`));
    const liste = h('ul', { class: 'photos' });
    for (const a of annonces) {
      const url = a.photos[0] ? URL.createObjectURL(a.photos[0].blob) : '';
      liste.append(h('li', { class: 'photo annonce-ligne' },
        url ? h('img', { src: url, alt: '' }) : h('div', {}),
        h('div', {},
          h('div', { class: 'photo-num' }, a.analyse?.titre || 'Sans titre'),
          h('p', { class: 'muted' }, statut(a)),
          h('div', { class: 'photo-actions' },
            h('button', { class: 'icon-btn', onclick: async () => {
              await ouvrirAnnonce(a.id);
              aller(a.analyse ? 'analyse' : 'photos');
            } }, 'Ouvrir'),
            h('button', { class: 'icon-btn suppr', onclick: async () => {
              if (!confirm('Supprimer cette annonce et ses photos ?')) return;
              await supprimerAnnonce(a.id);
              app.replaceChildren();
              await ecranAccueil(app);
            } }, 'Suppr.')
          )
        )
      ));
    }
    app.append(liste);
  }

  app.append(
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => aller('historique') }, 'Historique'),
      h('button', { class: 'btn', onclick: () => aller('reglages') }, 'Réglages')
    )
  );
}
