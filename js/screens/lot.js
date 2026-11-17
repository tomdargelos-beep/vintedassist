// Mode « plusieurs annonces d'un coup » : toutes les photos → regroupement par l'IA → validation
// → création, analyse et détourage de chaque annonce, l'une après l'autre.
import { h, toast } from '../ui.js';
import { TYPES_PHOTO, creerAnnonce, sauverAnnonce, ordreType } from '../state.js';
import { dbGet, dbPut, dbDelete } from '../db.js';
import { redimensionner } from '../images.js';
import { lireReglages } from '../settings.js';
import { grouperPhotos, analyserAnnonce } from '../ai/provider.js';
import { preparerPhotos, repasserTout } from '../retouche.js';
import { aller } from '../app.js';

const CLE = '__lot';
let lot = null; // { photos: [{ id, blob, url }], groupes: [{ description, photos: [{ index, type }] }] | null }

async function chargerLot() {
  if (lot) return lot;
  const s = await dbGet('brouillons', CLE).catch(() => null);
  lot = s ? { photos: s.photos, groupes: s.groupes } : { photos: [], groupes: null };
  for (const p of lot.photos) p.url = URL.createObjectURL(p.blob);
  return lot;
}
const sauverLot = () => dbPut('brouillons', { photos: lot.photos.map(({ url, ...r }) => r), groupes: lot.groupes }, CLE).catch(() => {});
async function viderLot() {
  for (const p of lot?.photos || []) URL.revokeObjectURL(p.url);
  lot = { photos: [], groupes: null };
  await dbDelete('brouillons', CLE).catch(() => {});
}

export async function ecranLot(app) {
  await chargerLot();
  const rendu = () => { app.replaceChildren(); return lot.groupes ? etapeGroupes(app) : etapeImport(app); };
  app._rendu = rendu;
  rendu();
}

function etapeImport(app) {
  const inputCamera = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'file-hidden' });
  const inputGalerie = h('input', { type: 'file', accept: 'image/*', multiple: true, class: 'file-hidden' });
  async function ajouter(fichiers) {
    if (!fichiers.length) return;
    toast(`Préparation de ${fichiers.length} photo(s)…`, 20000);
    for (const f of fichiers) {
      try {
        const blob = await redimensionner(f);
        lot.photos.push({ id: crypto.randomUUID(), blob, url: URL.createObjectURL(blob) });
      } catch (e) { console.error(e); }
    }
    await sauverLot();
    toast('Photos ajoutées');
    app._rendu();
  }
  inputCamera.addEventListener('change', () => { ajouter([...inputCamera.files]); inputCamera.value = ''; });
  inputGalerie.addEventListener('change', () => { ajouter([...inputGalerie.files]); inputGalerie.value = ''; });

  const grille = h('div', { class: 'grille' }, lot.photos.map((p, i) =>
    h('div', { class: 'vignette' }, h('img', { src: p.url, alt: `Photo ${i + 1}` }), h('span', {}, String(i + 1)))));
  const etat = h('p', { class: 'muted' });
  const btn = h('button', { class: 'btn btn-primary', disabled: lot.photos.length < 2, onclick: async () => {
    btn.disabled = true;
    try {
      lot.groupes = await grouperPhotos(lot.photos, lireReglages(), t => { etat.textContent = t; });
      await sauverLot();
      app._rendu();
    } catch (e) {
      etat.textContent = 'Regroupement impossible : ' + e.message;
      btn.disabled = false;
    }
  } }, `Regrouper par article avec l'IA (${lot.photos.length} photos)`);

  app.append(
    inputCamera, inputGalerie,
    h('p', { class: 'muted' }, 'Ajoute toutes les photos de tous les articles. Garde les photos d\'un même article à la suite : ça aide l\'IA.'),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => inputCamera.click() }, 'Appareil photo'),
      h('button', { class: 'btn', onclick: () => inputGalerie.click() }, 'Galerie')),
    lot.photos.length ? grille : h('p', { class: 'empty' }, 'Aucune photo pour l\'instant.'),
    etat,
    h('div', { class: 'sticky-bottom' }, btn),
    lot.photos.length ? h('button', { class: 'btn btn-danger', onclick: async () => {
      if (confirm('Vider toutes les photos du lot ?')) { await viderLot(); app._rendu(); }
    } }, 'Tout effacer') : null
  );
}

function etapeGroupes(app) {
  const G = lot.groupes;
  function deplacer(gi, pi, cible) {
    const [ph] = G[gi].photos.splice(pi, 1);
    if (cible === 'nouvelle') G.push({ description: 'Nouvel article', photos: [ph] });
    else G[Number(cible)].photos.push(ph);
    lot.groupes = G.filter(g => g.photos.length);
    sauverLot();
    app._rendu();
  }

  const cartes = G.map((g, gi) => {
    const titre = h('input', { type: 'text', value: g.description });
    titre.addEventListener('change', () => { g.description = titre.value; sauverLot(); });
    return h('div', { class: 'card' },
      h('label', {}, `Annonce ${gi + 1}`), titre,
      h('div', { class: 'grille' }, g.photos.map((ph, pi) => {
        const type = h('select', { 'aria-label': 'Type', onchange: e => { ph.type = e.target.value; sauverLot(); } },
          TYPES_PHOTO.map(t => h('option', { value: t.id, selected: t.id === ph.type }, t.label)));
        const dest = h('select', { 'aria-label': 'Déplacer vers', onchange: e => deplacer(gi, pi, e.target.value) },
          G.map((_, k) => h('option', { value: k, selected: k === gi }, `Annonce ${k + 1}`)),
          h('option', { value: 'nouvelle' }, 'Nouvelle annonce'));
        return h('div', { class: 'vignette' },
          h('img', { src: lot.photos[ph.index].url, alt: '' }), h('span', {}, String(ph.index + 1)), type, dest);
      })));
  });

  app.append(
    h('p', { class: 'muted' }, `L'IA a trouvé ${G.length} article(s). Vérifie les groupes et les types, déplace une photo si besoin.`),
    ...cartes,
    h('div', { class: 'sticky-bottom' },
      h('button', { class: 'btn btn-primary', onclick: () => traiter(app) }, `Créer et préparer les ${G.length} annonces`)),
    h('button', { class: 'btn', onclick: () => { lot.groupes = null; sauverLot(); app._rendu(); } }, 'Revenir aux photos')
  );
}

async function traiter(app) {
  const reglages = lireReglages();
  const groupes = lot.groupes;
  const lignes = groupes.map(g => {
    const etat = h('p', { class: 'muted' }, 'En attente');
    return { g, etat, noeud: h('div', { class: 'card' }, h('strong', {}, g.description), etat) };
  });
  const fin = h('div', {});
  app.replaceChildren(
    h('p', { class: 'muted' }, 'Garde l\'appli ouverte pendant la préparation (environ 1 minute par annonce).'),
    ...lignes.map(l => l.noeud), fin);

  // Les photos sont rangées dans l'ordre d'une annonce : face, dos, …, étiquettes, défauts.
  const annonces = [];
  for (const l of lignes) {
    const photos = [...l.g.photos].sort((a, b) => ordreType(a.type) - ordreType(b.type))
      .map(ph => ({ blob: lot.photos[ph.index].blob, type: ph.type }));
    annonces.push({ l, a: await creerAnnonce(photos) });
  }
  await viderLot();

  let ok = 0;
  for (const { l, a } of annonces) {
    try {
      a.analyse = await analyserAnnonce(a.photos, reglages, t => { l.etat.textContent = t; });
      a.saisie = { mesures: '', prixAchat: '' };
      await sauverAnnonce(a);
      await preparerPhotos(a, { onEtape: t => { l.etat.textContent = t; }, sauver: () => sauverAnnonce(a), fondDefaut: reglages.fondDefaut });
      let note = '';
      if (reglages.iaImage && reglages.repassageAuto && reglages.apiKey) {
        const echecs = await repasserTout(a, reglages, { onEtape: t => { l.etat.textContent = t; }, sauver: () => sauverAnnonce(a) });
        if (echecs.length) note = ` (repassage IA impossible pour ${echecs.length} photo(s))`;
      }
      l.etat.textContent = `Prête : ${a.analyse.titre}${note}`;
      ok++;
    } catch (e) {
      console.error(e);
      l.etat.textContent = 'Erreur : ' + e.message + ' (tu pourras relancer depuis l\'accueil).';
      l.etat.className = 'alerte-texte';
    }
  }
  fin.append(h('p', {}, `${ok} annonce(s) prête(s) sur ${annonces.length}.`),
    h('button', { class: 'btn btn-primary', onclick: () => aller('') }, 'Voir mes annonces'));
}
