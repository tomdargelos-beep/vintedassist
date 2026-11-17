import { h, estIOS, estInstallee } from '../ui.js';
import { chargerAnnonce, nouvelleAnnonce } from '../state.js';
import { aller } from '../app.js';

export async function ecranAccueil(app) {
  const annonce = await chargerAnnonce();
  const enCours = annonce.photos.length > 0;

  if (estIOS() && !estInstallee()) {
    app.append(h('div', { class: 'hint' },
      h('strong', {}, 'Installer l\'appli : '),
      'dans Safari, touche le bouton Partager (carré avec une flèche), puis « Sur l\'écran d\'accueil ».'
    ));
  }

  if (enCours) {
    app.append(
      h('button', { class: 'btn btn-primary', onclick: () => aller('photos') },
        `Reprendre l'annonce en cours (${annonce.photos.length} photo${annonce.photos.length > 1 ? 's' : ''})`),
      h('button', {
        class: 'btn', onclick: async () => {
          if (!confirm('Abandonner l\'annonce en cours et en commencer une nouvelle ?')) return;
          await nouvelleAnnonce();
          aller('photos');
        }
      }, 'Nouvelle annonce')
    );
  } else {
    app.append(h('button', {
      class: 'btn btn-primary', onclick: async () => { await nouvelleAnnonce(); aller('photos'); }
    }, 'Nouvelle annonce'));
  }

  app.append(
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => aller('historique') }, 'Historique'),
      h('button', { class: 'btn', onclick: () => aller('reglages') }, 'Réglages')
    )
  );
}
