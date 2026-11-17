// Retouche des photos : détourage (dans le navigateur), choix du fond selon le contraste,
// composition avec ombre douce, rotation, luminosité, export JPEG.
// Le vêtement n'est jamais modifié : seul le fond change (le détourage ne fait que découper).
import { TYPES_SANS_DETOURAGE } from './state.js';

export const FONDS = {
  blanc: { nom: 'Blanc', couleur: '#ffffff', L: 255 },
  'gris-clair': { nom: 'Gris clair', couleur: '#d9d9d9', L: 217 },
  anthracite: { nom: 'Anthracite', couleur: '#3a3a3c', L: 58 },
  noir: { nom: 'Noir', couleur: '#141414', L: 20 }
};
const SEUIL_CONTRASTE = 70; // écart minimal de luminance (0-255) entre vêtement et fond
const SORTIE = { largeur: 1200, hauteur: 1600 }; // portrait 3:4, ~1600 px sur le grand côté
const DONNEES = new URL('../assets/detourage/', import.meta.url).href;

let moduleDetourage = null;
const chargerModule = () => (moduleDetourage ??= import('./vendor/bg-removal-1.4.5.mjs'));

export const doitDetourer = p => !TYPES_SANS_DETOURAGE.includes(p.type) && !p.garderOriginal;

export async function detourer(blob, onProgres = () => {}) {
  const { removeBackground } = await chargerModule();
  return removeBackground(blob, {
    publicPath: DONNEES,
    model: 'small',
    output: { format: 'image/png' },
    progress: (cle, actuel, total) => onProgres(cle, actuel, total)
  });
}

// Luminance moyenne du vêtement (pixels du masque uniquement), de 0 (noir) à 255 (blanc).
export async function luminance(pngDetoure) {
  const bmp = await createImageBitmap(pngDetoure);
  const r = Math.min(1, 200 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * r));
  c.height = Math.max(1, Math.round(bmp.height * r));
  const ctx = c.getContext('2d');
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let somme = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 128) { somme += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++; }
  }
  return n ? somme / n : 128;
}

// Vêtement foncé → fond clair ; clair → fond foncé ; jamais un fond trop proche.
export function choisirFond(L) {
  const preferences = L < 100 ? ['blanc', 'gris-clair'] : L > 170 ? ['anthracite', 'noir'] : ['blanc', 'anthracite'];
  const ok = preferences.find(f => Math.abs(FONDS[f].L - L) >= SEUIL_CONTRASTE);
  if (ok) return ok;
  return Object.keys(FONDS).sort((a, b) => Math.abs(FONDS[b].L - L) - Math.abs(FONDS[a].L - L))[0];
}

// Détoure les photos qui doivent l'être, puis choisit le fond de l'annonce (d'après la 1re photo détourée).
export async function preparerPhotos(annonce, { onEtape = () => {}, sauver = async () => {}, fondDefaut = 'auto' } = {}) {
  const aFaire = annonce.photos.filter(p => doitDetourer(p) && !p.detoure);
  for (const [i, p] of aFaire.entries()) {
    onEtape(`Détourage de la photo ${annonce.photos.indexOf(p) + 1} (${i + 1}/${aFaire.length})…`);
    p.detoure = await detourer(p.blob, (cle, actuel, total) => {
      if (cle.startsWith('fetch:') && total > 1e6) {
        onEtape(`Téléchargement de l'outil de détourage (une seule fois) : ${Math.round(actuel / 1e6)} / ${Math.round(total / 1e6)} Mo…`);
      }
    });
    p.lum = await luminance(p.detoure);
    await sauver();
  }
  const ref = annonce.photos.find(p => doitDetourer(p) && p.detoure);
  if (ref && ref.lum === undefined) ref.lum = await luminance(ref.detoure);
  if (!annonce.fond || annonce.fondAuto !== false) {
    annonce.fond = fondDefaut !== 'auto' && FONDS[fondDefaut] ? fondDefaut : choisirFond(ref?.lum ?? 128);
    annonce.fondAuto = true;
  }
  annonce.fondPropose = ref ? choisirFond(ref.lum) : 'blanc';
  await sauver();
}

function canvas(l, h) {
  const c = document.createElement('canvas');
  c.width = l; c.height = h;
  return c;
}

// Applique rotation (multiple de 90°) et luminosité à une image ; renvoie un canvas.
async function preparerSource(blob, rotation = 0, luminosite = 1) {
  const bmp = await createImageBitmap(blob);
  const tourne = rotation % 180 !== 0;
  const c = canvas(tourne ? bmp.height : bmp.width, tourne ? bmp.width : bmp.height);
  const ctx = c.getContext('2d');
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
  if (luminosite !== 1) {
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.min(255, d[i] * luminosite);
      d[i + 1] = Math.min(255, d[i + 1] * luminosite);
      d[i + 2] = Math.min(255, d[i + 2] * luminosite);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.putImageData(img, 0, 0);
  }
  return c;
}

// Rectangle englobant le vêtement (pixels non transparents).
function cadre(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y += 2) {
    for (let x = 0; x < c.width; x += 2) {
      if (d[(y * c.width + x) * 4 + 3] > 20) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? { x: 0, y: 0, l: c.width, h: c.height } : { x: x0, y: y0, l: x1 - x0 + 2, h: y1 - y0 + 2 };
}

// Produit la photo finale (JPEG) d'une photo de l'annonce.
export async function rendre(p, fond, qualite = 0.9) {
  const rotation = p.rotation || 0;
  const luminosite = p.luminosite || 1;
  let sortie;
  if (doitDetourer(p) && p.detoure) {
    const src = await preparerSource(p.detoure, rotation, luminosite);
    const b = cadre(src);
    sortie = canvas(SORTIE.largeur, SORTIE.hauteur);
    const ctx = sortie.getContext('2d');
    ctx.fillStyle = FONDS[fond]?.couleur || '#ffffff';
    ctx.fillRect(0, 0, sortie.width, sortie.height);
    const echelle = Math.min((sortie.width * 0.84) / b.l, (sortie.height * 0.86) / b.h);
    const l = b.l * echelle, h = b.h * echelle;
    // Ombre portée douce sous le vêtement, pour éviter l'effet « collage ».
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 14;
    ctx.drawImage(src, b.x, b.y, b.l, b.h, (sortie.width - l) / 2, (sortie.height - h) / 2, l, h);
  } else {
    const src = await preparerSource(p.blob, rotation, luminosite);
    const r = Math.min(1, 1600 / Math.max(src.width, src.height));
    sortie = canvas(Math.round(src.width * r), Math.round(src.height * r));
    sortie.getContext('2d').drawImage(src, 0, 0, sortie.width, sortie.height);
  }
  return new Promise((ok, ko) => sortie.toBlob(b => (b ? ok(b) : ko(new Error('Export impossible'))), 'image/jpeg', qualite));
}

// Enregistre les photos : partage natif (iPhone → « Enregistrer N images ») sinon téléchargements.
export async function enregistrer(blobs, nomBase = 'annonce') {
  const slug = nomBase.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'annonce';
  const fichiers = blobs.map((b, i) => new File([b], `${slug}-${i + 1}.jpg`, { type: 'image/jpeg' }));
  if (navigator.canShare?.({ files: fichiers })) {
    try {
      await navigator.share({ files: fichiers });
      return 'partage';
    } catch (e) {
      if (e.name === 'AbortError') return 'annule';
      console.warn('Partage impossible, téléchargement à la place', e);
    }
  }
  for (const f of fichiers) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    document.body.append(a);
    a.click();
    a.remove();
    await new Promise(r => setTimeout(r, 300));
  }
  return 'telechargement';
}
