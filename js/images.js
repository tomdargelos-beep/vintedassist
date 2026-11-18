// Préparation des images importées : redimensionnement + conversion JPEG.
// Les photos d'iPhone font 12 à 48 Mpx : on les réduit à 2048 px max pour garder l'appli fluide.
// (L'envoi à l'IA sera réduit à ~1024 px, l'export final à ~1600 px.)

function chargerImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Format d\'image non lisible')); };
    img.src = url;
  });
}

export async function redimensionner(blob, maxCote = 2048, qualite = 0.9) {
  // <img> applique automatiquement l'orientation EXIF (photo prise en portrait, etc.).
  const img = await chargerImage(blob);
  const ratio = Math.min(1, maxCote / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * ratio);
  const h = Math.round(img.naturalHeight * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Conversion impossible'))), 'image/jpeg', qualite)
  );
}
