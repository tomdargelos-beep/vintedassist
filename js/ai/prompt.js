// Consignes données à l'IA (communes à tous les fournisseurs).
import { TYPES_PHOTO } from '../state.js';

export const ECHELLE = `Échelle de certitude, à appliquer strictement :
- tres_elevee : lu directement et nettement sur une étiquette ou un logo.
- elevee : visible mais un peu flou, ou recoupé par plusieurs indices.
- moyenne : déduit (coupe, style, logo partiel), sans preuve directe.
- faible : supposition, ou information absente des photos.
Si une valeur est inconnue : valeur null et certitude faible. Ne jamais inventer.`;

export function descriptionPhotos(photos) {
  return photos.map((p, i) => {
    const t = TYPES_PHOTO.find(x => x.id === p.type)?.label || p.type;
    return `Photo ${i + 1} : ${t}`;
  }).join('\n');
}

export function promptAnalyse(photos) {
  return `Tu aides un vendeur particulier à créer une annonce Vinted (France) pour l'article photographié.
Les photos sont numérotées à partir de 1, dans cet ordre :
${descriptionPhotos(photos)}

${ECHELLE}

Règles :
- Ne jamais inventer une marque ou une taille. Si l'étiquette n'est pas lisible : valeur null, certitude faible.
- Pour la taille, préciser le système lu (ex. "M", "EU 43", "US 10 / EU 44"). Pour les chaussures, donner la pointure EU si elle figure sur l'étiquette.
- Usure : être prudent et exhaustif (bouloches, taches, décoloration, fils tirés, coutures, trous, élasticité, col, poignets ; pour les chaussures : semelle, talon, plis, intérieur, lacets). Mieux vaut signaler un doute que l'oublier. Chaque défaut indique le numéro de la photo où il est visible (0 si non localisé).
- L'état choisi doit être cohérent avec les défauts trouvés.
- couleurs : 1 ou 2 couleurs maximum, choisies dans la liste autorisée.
- prix.prix_vise : prix réaliste en euros qu'un vendeur peut encaisser sur Vinted pour cette pièce d'occasion (marque, type, état). C'est une estimation provisoire ; références de marché vides ici.
- titre : 60 caractères maximum, format exact : Type + Marque (avec la ligne précise si lisible, ex. "Carhartt WIP") + couleur précise + "taille" + Taille. Exemple : "T-shirt Carhartt WIP marron rouille taille M". Pas d'emoji.
- description : en français, ton simple, naturel et honnête, sans emoji. Format exact, sur le modèle de l'exemple ci-dessous :
  1) UN seul paragraphe de 4 à 6 phrases courtes : type + marque + couleur précise + taille ; le logo, l'imprimé ou le détail principal et son emplacement ; une qualité concrète et vérifiable sur les photos (imprimé net, col propre, coton épais…) sans inventer ; l'état, en citant clairement chaque défaut s'il y en a ; un usage ou un style (streetwear, casual…).
  2) une ligne vide.
  3) une ligne de 4 à 6 hashtags en minuscules, sans accent ni espace : #marque, #marque+ligne si elle existe, #type, #style, #taille.
  Exemple :
  "T-shirt Carhartt WIP de couleur marron rouille, taille M. Logo imprimé noir sur la poitrine. Imprimé net et col propre, beau coton épais de qualité. En très bon état général. Idéal pour un look streetwear.

#carhartt #carharttwip #tshirt #streetwear #m"
  S'il y a des défauts, la phrase d'état les cite précisément (ex. "Très bon état, petite tache discrète sur le bas du dos, voir photo 4.") : ne jamais les cacher.
- mots_cles : 5 à 10 mots-clés utiles pour la recherche.
- Toutes les justifications : une phrase courte qui cite la photo (ex. "lu sur l'étiquette, photo 3").`;
}

export function promptMarche(resume) {
  return `Recherche sur le web les prix de seconde main en France (sites de revente, annonces d'occasion, comparateurs) pour un article comparable à :
${resume}

N'utilise pas Vinted comme source. Réponds UNIQUEMENT avec un objet JSON, sans texte autour, de la forme :
{"prix_vise": nombre en euros, "certitude": "tres_elevee|elevee|moyenne|faible", "references_marche": [{"description": "article comparable", "prix": nombre, "source": "nom du site"}], "justification": "une phrase"}
Donne 2 à 4 références réelles trouvées. Si tu n'en trouves pas, references_marche vide et certitude faible. Le prix visé est ce qu'un particulier peut réellement encaisser pour cette pièce dans cet état.`;
}

export function promptGroupement(n) {
  return `Voici ${n} photos numérotées de 1 à ${n}, prises par un vendeur pour créer plusieurs annonces Vinted (une annonce par article).
Regroupe les photos par article : chaque photo appartient à exactement un article, et chaque numéro de 1 à ${n} doit apparaître une seule fois.
Rattache les gros plans (étiquettes, défauts, détails) au bon article grâce aux indices : couleur, matière, motif, arrière-plan, et ordre de prise de vue (les photos d'un même article sont en général consécutives).
Pour chaque photo, donne son type parmi : face, dos, profil (chaussures), semelle, etiquette_marque, etiquette_taille (taille ou composition), defaut, detail.
description : type d'article + marque si elle est lisible + couleur, en quelques mots (ex. "T-shirt Carhartt noir"). Ne devine pas une marque illisible.
Garde les articles dans l'ordre où ils apparaissent dans les photos.`;
}
