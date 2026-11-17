import { h, toast } from '../ui.js';
import { chargerAnnonce, sauverAnnonce, TYPES_PHOTO, TYPES_SANS_DETOURAGE } from '../state.js';
import { lireReglages } from '../settings.js';
import { FONDS, doitDetourer, preparerPhotos, rendre, enregistrer, versionRepassee, photosAnnonce } from '../retouche.js';
import { aller } from '../app.js';

export async function ecranRetouche(app) {
  const annonce = await chargerAnnonce();
  if (!annonce.photos.length) {
    app.append(h('p', { class: 'empty' }, 'Aucune photo dans cette annonce.'),
      h('button', { class: 'btn', onclick: () => aller('photos') }, 'Aller aux photos'));
    return;
  }

  const etat = h('p', { class: 'chargement' });
  const barre = h('div', { class: 'card centre' }, h('div', { class: 'spinner' }), etat);
  const choixFond = h('div', { class: 'fonds' });
  const liste = h('ul', { class: 'photos' });
  const rendus = new Map(); // id de photo → JPEG final (prêt pour le partage)
  const btnEnregistrer = h('button', { class: 'btn btn-primary', disabled: true, onclick: async () => {
    const blobs = photosAnnonce(annonce, rendus);
    const res = await enregistrer(blobs, annonce.analyse?.titre || 'annonce');
    if (res === 'telechargement') toast(`${blobs.length} photo(s) téléchargée(s)`);
  } }, 'Enregistrer toutes les photos');

  app.append(
    barre,
    h('div', { class: 'card' }, h('label', {}, 'Fond'), choixFond,
      h('p', { class: 'muted' }, 'Le fond proposé contraste avec le vêtement. Étiquettes, défauts, détails et semelles restent des photos réelles.')),
    liste,
    h('div', { class: 'sticky-bottom' }, btnEnregistrer),
    h('button', { class: 'btn', onclick: () => aller('analyse') }, 'Retour aux textes de l\'annonce')
  );

  function majBouton() {
    const n = photosAnnonce(annonce, rendus).length;
    btnEnregistrer.disabled = !n;
    btnEnregistrer.textContent = `Enregistrer les ${n} photos`;
  }

  // Version « repassée » par l'IA : génération, aperçu, et choix de ce qui va dans l'annonce.
  function blocIA(p) {
    const zone = h('div', { class: 'bloc-ia' });
    const etat = h('p', { class: 'muted' });
    const dessiner = () => {
      zone.replaceChildren();
      if (p.repasse) {
        const url = URL.createObjectURL(p.repasse);
        const choix = h('select', { onchange: async e => { p.versionIA = e.target.value; await sauverAnnonce(); majBouton(); } },
          [['les-deux', 'Les deux (IA en premier)'], ['ia', 'Version IA seule'], ['reelle', 'Photo réelle seule']]
            .map(([v, l]) => h('option', { value: v, selected: (p.versionIA || 'les-deux') === v }, l)));
        zone.append(
          h('label', {}, 'Version repassée par l\'IA'),
          h('img', { class: 'apercu', src: url, alt: 'Version IA' }),
          p.repasseFond !== annonce.fond ? h('p', { class: 'alerte-texte' }, 'Faite sur un autre fond : refais-la pour qu\'elle corresponde.') : null,
          h('p', { class: 'muted' }, 'Compare avec la photo réelle : logo, couleurs, taches. Si un détail a changé, ne l\'utilise pas.'),
          h('label', {}, 'Dans l\'annonce'), choix);
      }
      zone.append(h('button', { class: 'btn', onclick: generer }, p.repasse ? 'Refaire la version IA' : 'Repasser avec l\'IA'), etat);
    };
    async function generer() {
      etat.textContent = 'Génération en cours (10 à 40 secondes)…';
      try {
        const { blob } = await versionRepassee(p, annonce.fond, lireReglages());
        p.repasse = blob;
        p.repasseFond = annonce.fond;
        p.versionIA = p.versionIA || 'les-deux';
        await sauverAnnonce();
        dessiner();
        majBouton();
      } catch (e) {
        console.error(e);
        etat.textContent = 'Échec : ' + e.message;
      }
    }
    dessiner();
    return zone;
  }

  function majFonds() {
    choixFond.replaceChildren(...Object.entries(FONDS).map(([cle, f]) =>
      h('button', {
        class: 'fond' + (annonce.fond === cle ? ' actif' : ''),
        style: `background:${f.couleur}`,
        'aria-label': f.nom,
        onclick: async () => {
          annonce.fond = cle;
          annonce.fondAuto = false;
          await sauverAnnonce();
          majFonds();
          await toutRendre();
        }
      }, h('span', {}, f.nom + (annonce.fondPropose === cle ? ' (proposé)' : '')))));
  }

  async function rendrePhoto(p, img) {
    const blob = await rendre(p, annonce.fond);
    rendus.set(p.id, blob);
    if (img.src) URL.revokeObjectURL(img.src);
    img.src = URL.createObjectURL(blob);
  }

  async function toutRendre() {
    btnEnregistrer.disabled = true;
    liste.replaceChildren();
    for (const [i, p] of annonce.photos.entries()) {
      const img = h('img', { class: 'apercu', alt: `Photo ${i + 1}` });
      const type = TYPES_PHOTO.find(t => t.id === p.type)?.label || p.type;
      const lum = h('input', { type: 'range', min: 0.7, max: 1.4, step: 0.05, value: p.luminosite || 1, 'aria-label': 'Luminosité' });
      lum.addEventListener('change', async () => { p.luminosite = Number(lum.value); await sauverAnnonce(); await rendrePhoto(p, img); });
      const modes = !TYPES_SANS_DETOURAGE.includes(p.type);
      liste.append(h('li', { class: 'card retouche' },
        img,
        h('div', { class: 'photo-num' }, `Photo ${i + 1} · ${type}`),
        h('label', {}, 'Luminosité'), lum,
        h('div', { class: 'photo-actions' },
          h('button', { class: 'icon-btn', onclick: async () => {
            p.rotation = ((p.rotation || 0) + 90) % 360; await sauverAnnonce(); await rendrePhoto(p, img);
          } }, 'Pivoter'),
          modes ? h('button', { class: 'icon-btn', onclick: async () => {
            p.garderOriginal = !p.garderOriginal; await sauverAnnonce();
            if (doitDetourer(p) && !p.detoure) { app.replaceChildren(); await ecranRetouche(app); return; }
            await toutRendre();
          } }, p.garderOriginal ? 'Détourer' : 'Photo d\'origine') : null
        )
      ));
      await rendrePhoto(p, img);
      if (doitDetourer(p)) liste.lastChild.append(blocIA(p));
    }
    majBouton();
  }

  try {
    await preparerPhotos(annonce, {
      onEtape: t => { etat.textContent = t; },
      sauver: () => sauverAnnonce(annonce),
      fondDefaut: lireReglages().fondDefaut
    });
    barre.remove();
    majFonds();
    await toutRendre();
  } catch (e) {
    console.error(e);
    barre.replaceChildren(h('div', { class: 'alerte' }, h('strong', {}, 'Le détourage a échoué. '), e.message),
      h('button', { class: 'btn', onclick: async () => { app.replaceChildren(); await ecranRetouche(app); } }, 'Réessayer'));
  }
}
