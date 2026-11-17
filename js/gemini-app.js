// Retouche des photos via l'appli Gemini (incluse dans l'abonnement Gemini Pro de Tom) :
// l'appli prépare le prompt et envoie les photos du vêtement ; Gemini renvoie les photos retouchées.
import { TYPES_PHOTO } from './state.js';

// Couleurs Vinted considérées comme claires → fond foncé ; sinon fond clair (règle de contraste de Tom).
const CLAIRES = ['Blanc', 'Crème', 'Beige', 'Abricot', 'Jaune', 'Argenté', 'Doré', 'Rose', 'Bleu clair', 'Menthe', 'Lila', 'Gris'];

export function fondPourGemini(annonce) {
  const couleurs = annonce.analyse?.couleurs?.valeur || [];
  const principale = Array.isArray(couleurs) ? couleurs[0] : couleurs;
  return CLAIRES.includes(principale)
    ? { nom: 'gris anthracite uni (#3a3a3c)', raison: `vêtement clair (${principale})` }
    : { nom: 'blanc cassé très légèrement grisé (#f1f1f0), style studio photo', raison: principale ? `vêtement ${principale.toLowerCase()}` : 'couleur non détectée' };
}

// Photos du vêtement entier (les étiquettes, défauts et détails restent des photos réelles, non envoyées).
export const photosPourGemini = annonce => annonce.photos.filter(p => ['face', 'dos', 'profil'].includes(p.type));

export function promptGeminiApp(annonce) {
  const fond = fondPourGemini(annonce);
  const photos = photosPourGemini(annonce);
  const liste = photos.map((p, i) => `- image ${i + 1} : ${TYPES_PHOTO.find(t => t.id === p.type)?.label.toLowerCase() || p.type}`).join('\n');
  const article = annonce.analyse?.titre ? ` (${annonce.analyse.titre})` : '';
  return `Je t'envoie ${photos.length} photo${photos.length > 1 ? 's' : ''} du même vêtement d'occasion${article}, pour une annonce Vinted :
${liste}

Pour CHAQUE image, renvoie une image retouchée séparée, dans le même ordre (une image par photo envoyée). Si tu ne peux pas toutes les faire d'un coup, fais la première puis attends que je te dise « suivante ».

Retouche demandée, identique pour toutes les images :
- photo produit de type packshot e-commerce, à partir de CE vêtement précis ;
- vêtement défroissé comme s'il venait d'être repassé, posé bien à plat, vu exactement du dessus, droit, symétrique, manches écartées naturellement, centré, occupant environ 80 % de la hauteur ;
- fond uni ${fond.nom}, le même sur toutes les images ; ombre très douce sous le vêtement ; éclairage studio homogène ; format portrait 3:4.

Garde STRICTEMENT identiques : le modèle, la coupe, les proportions, les couleurs exactes (sans les saturer), le logo, l'imprimé et tout texte (même police, même position, même taille), l'étiquette du col, les coutures, et SURTOUT tous les défauts (taches, décolorations, bouloches, trous, fils tirés). Ne retire aucun défaut, n'ajoute rien.`;
}

// Envoie les photos via le menu de partage (iPhone → choisir « Gemini »). Renvoie false si le partage est indisponible.
export async function envoyerAGemini(annonce) {
  const photos = photosPourGemini(annonce);
  const fichiers = photos.map((p, i) => new File([p.blob], `photo-${i + 1}-${p.type}.jpg`, { type: 'image/jpeg' }));
  if (!fichiers.length || !navigator.canShare?.({ files: fichiers })) return false;
  try {
    await navigator.share({ files: fichiers });
  } catch (e) {
    if (e.name !== 'AbortError') throw e;
  }
  return true;
}
