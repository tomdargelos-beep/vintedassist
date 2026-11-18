import { h, toast } from '../ui.js';
import { chargerAnnonce, sauverAnnonce, TYPES_PHOTO, typeParDefaut } from '../state.js';
import { redimensionner } from '../images.js';
import { aller } from '../app.js';
import { icone } from '../icones.js';

export async function ecranPhotos(app) {
  const annonce = await chargerAnnonce();

  // Deux champs fichier cachés : un qui ouvre directement l'appareil photo,
  // un qui ouvre le choix (photothèque, appareil photo, fichiers) avec sélection multiple.
  const inputCamera = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'file-hidden' });
  const inputGalerie = h('input', { type: 'file', accept: 'image/*', multiple: true, class: 'file-hidden' });

  const liste = h('ul', { class: 'photos' });
  const btnContinuer = h('button', { class: 'btn btn-primary', onclick: () => aller('analyse') }, 'Rédiger l\'annonce');
  const aide = h('p', { class: 'muted' },
    'Ordre conseillé : face, dos, étiquettes, puis défauts. La première photo sert de couverture.');

  async function ajouter(fichiers) {
    if (!fichiers.length) return;
    toast(`Préparation de ${fichiers.length} photo${fichiers.length > 1 ? 's' : ''}…`, 10000);
    let erreurs = 0;
    for (const f of fichiers) {
      try {
        const blob = await redimensionner(f);
        annonce.photos.push({
          id: crypto.randomUUID(),
          blob,
          url: URL.createObjectURL(blob),
          type: typeParDefaut(annonce.photos.length)
        });
      } catch (e) {
        console.error(e);
        erreurs++;
      }
    }
    await sauverAnnonce();
    rendre();
    toast(erreurs ? `${erreurs} photo(s) illisible(s) ignorée(s)` : 'Photos ajoutées');
  }

  inputCamera.addEventListener('change', () => { ajouter([...inputCamera.files]); inputCamera.value = ''; });
  inputGalerie.addEventListener('change', () => { ajouter([...inputGalerie.files]); inputGalerie.value = ''; });

  function deplacer(i, delta) {
    const j = i + delta;
    if (j < 0 || j >= annonce.photos.length) return;
    [annonce.photos[i], annonce.photos[j]] = [annonce.photos[j], annonce.photos[i]];
    sauverAnnonce();
    rendre();
  }

  function supprimer(i) {
    if (!confirm('Supprimer cette photo ?')) return;
    const [p] = annonce.photos.splice(i, 1);
    URL.revokeObjectURL(p.url);
    sauverAnnonce();
    rendre();
  }

  function rendre() {
    liste.replaceChildren();
    if (!annonce.photos.length) {
      liste.append(h('li', { class: 'empty' }, 'Aucune photo pour l\'instant.'));
    }
    annonce.photos.forEach((p, i) => {
      const select = h('select', {
        'aria-label': `Type de la photo ${i + 1}`,
        onchange: e => { p.type = e.target.value; sauverAnnonce(); }
      }, TYPES_PHOTO.map(t => h('option', { value: t.id, selected: t.id === p.type }, t.label)));
      liste.append(h('li', { class: 'photo' },
        h('img', { src: p.url, alt: `Photo ${i + 1}` }),
        h('div', {},
          h('div', { class: 'photo-num' }, `Photo ${i + 1}`, i === 0 ? h('span', { class: 'couverture' }, 'couverture') : null),
          select,
          h('div', { class: 'photo-actions' },
            h('button', { class: 'icon-btn', 'aria-label': 'Monter', disabled: i === 0, onclick: () => deplacer(i, -1) }, icone('haut', 18)),
            h('button', { class: 'icon-btn', 'aria-label': 'Descendre', disabled: i === annonce.photos.length - 1, onclick: () => deplacer(i, 1) }, icone('bas', 18)),
            h('button', { class: 'icon-btn suppr', 'aria-label': 'Supprimer', onclick: () => supprimer(i) }, icone('supprimer', 18))
          )
        )
      ));
    });
    btnContinuer.disabled = annonce.photos.length === 0;
  }

  app.append(
    inputCamera, inputGalerie,
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => inputCamera.click() }, icone('photo'), 'Prendre'),
      h('button', { class: 'btn', onclick: () => inputGalerie.click() }, icone('galerie'), 'Importer')
    ),
    aide,
    liste,
    h('div', { class: 'sticky-bottom' }, btnContinuer)
  );
  rendre();
}
