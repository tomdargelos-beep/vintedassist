# Projet : Assistant d'annonces Vinted (usage personnel)

## Contexte
Je m'appelle Tom, étudiant, je vends sur Vinted mes propres vêtements et des pièces achetées pour revente.
Objectif : réduire au maximum le temps passé à créer une annonce. L'appli ne sert qu'à moi.
Je débute en code : **explique-moi ce que tu fais et pourquoi, étape par étape**, définis les termes techniques la première fois, et avance par petites étapes testables.

## Ce que fait l'appli (vue d'ensemble)
1. Je prends en photo un vêtement avec mon téléphone (plusieurs photos : face, dos, étiquette de marque, étiquette de taille/composition, gros plans des défauts éventuels).
2. L'appli analyse les photos avec une IA et propose : marque, taille, couleur, matière, catégorie, état, défauts, titre et description.
3. L'appli détoure le vêtement et le place sur un fond choisi (uni ou parquet), en choisissant un fond qui contraste avec le vêtement.
4. Je relis, je corrige si besoin, puis je copie chaque champ en un clic et je télécharge les photos retouchées pour les poster sur Vinted à la main.

**Pas de publication automatique sur Vinted** : pas de bot ni d'accès non officiel à Vinted. Je copie-colle moi-même.

## Contraintes techniques
- Je travaille sur **Chromebook** et je prends les photos sur **téléphone**.
- Format : **appli web progressive (PWA)** = un site web installable comme une appli sur le téléphone, qui marche aussi sur le Chromebook.
- Code **100 % front-end** (HTML, CSS, JavaScript), sans serveur à payer. Framework léger accepté (par ex. Vite + JavaScript simple) si tu justifies le choix.
- Hébergement gratuit : **GitHub Pages** (HTTPS obligatoire pour la PWA et l'accès à l'appareil photo).
- Budget quasi nul : uniquement des outils gratuits, à part éventuellement quelques centimes d'API.

## Analyse IA des photos
- Fournisseur par défaut : **API Google Gemini** (offre gratuite, modèle « Flash » multimodal). Vérifie dans la doc officielle le nom du modèle actuel au lieu d'en coder un de mémoire.
- Prévois une **couche d'abstraction** (un module `aiProvider`) pour pouvoir passer plus tard à l'API Claude sans tout réécrire.
- **Clé API** : je la saisis dans un écran « Réglages » ; elle est stockée uniquement dans le `localStorage` de l'appareil. Elle ne doit **jamais** apparaître dans le code ni dans le dépôt GitHub. Ajoute un `.gitignore` adapté.
- Réduis les images avant l'envoi (≈1024 px sur le plus grand côté) pour limiter le coût et le temps.
- Demande à l'IA une **réponse JSON stricte** (utilise le mode de sortie structurée de l'API) avec ce schéma :

Chaque information identifiée est un objet `{valeur, certitude, justification}` :
- `certitude` ∈ `tres_elevee | elevee | moyenne | faible`
- `justification` : une phrase courte (ex. « lu sur l'étiquette, photo 3 », « déduit de la coupe, pas d'étiquette visible »).

```json
{
  "marque":        {"valeur": "string | null", "certitude": "...", "justification": "string"},
  "taille":        {"valeur": "string | null", "certitude": "...", "justification": "string"},
  "categorie_vinted": {"valeur": "ex. Femmes > Vêtements > Pulls & sweats > Sweats", "certitude": "...", "justification": "string"},
  "couleurs":      {"valeur": ["max 2, noms de couleurs de Vinted"], "certitude": "...", "justification": "string"},
  "matiere":       {"valeur": "string | null", "certitude": "...", "justification": "string"},
  "etat":          {"valeur": "Neuf avec étiquette | Neuf sans étiquette | Très bon état | Bon état | Satisfaisant", "certitude": "...", "justification": "string"},
  "defauts": [{"description": "string", "photo_index": 0, "certitude": "...", "justification": "string"}],
  "prix": {
    "prix_affiche": 0,
    "prix_vise": 0,
    "prix_plancher": 0,
    "certitude": "...",
    "references_marche": [{"description": "string", "prix": 0, "source": "string"}],
    "justification": "string"
  },
  "titre": "string, max ~60 caractères, format : Type + Marque + détail clé + Taille",
  "description": "string prête à coller",
  "mots_cles": ["string"]
}
```

### Échelle de certitude (à appliquer strictement)
| Niveau | Quand l'utiliser | Affichage |
|---|---|---|
| Très élevée | Lu directement et nettement sur une étiquette ou un logo | Vert, texte « Certitude très élevée » |
| Élevée | Visible mais un peu flou, ou recoupé par plusieurs indices | Vert clair, texte « Certitude élevée » |
| Moyenne | Déduit (coupe, style, logo partiel), sans preuve directe | **Rouge**, texte « Certitude moyenne » |
| Faible | Supposition, ou information absente des photos | **Rouge gras + fond rouge pâle**, texte « Certitude faible – à vérifier » |

- Le niveau est **toujours écrit en toutes lettres** à côté du champ (pas seulement une couleur), avec la justification visible au toucher/survol.
- Si une valeur est inconnue → `valeur: null`, certitude `faible`. **Ne jamais inventer.**
- En haut de l'écran de relecture : un compteur « X champs en rouge à vérifier », pour voir d'un coup d'œil s'il faut contrôler quelque chose.

### Prix
- Objectif : vendre au prix du marché **en gardant une marge de négociation**, car les acheteurs Vinted font presque toujours une offre.
- L'IA estime d'abord le **prix visé** (ce que je veux réellement encaisser) à partir de la marque, du type de pièce, de l'état et des prix observés pour des pièces comparables en seconde main.
- **Prix affiché = prix visé + marge de négociation** (par défaut +15 %, arrondi à un prix « propre » : 12, 15, 18, 20, 25…). Le pourcentage de marge est réglable dans les Réglages.
- **Prix plancher** = prix en dessous duquel je refuse les offres (par défaut −10 % du prix visé, réglable).
- Les trois prix sont calculés **dans le code** à partir du prix visé renvoyé par l'IA (les règles d'arrondi et de marge ne sont pas laissées à l'IA).
- Pour les références de marché : utilise si possible l'**ancrage sur la recherche Google** de l'API Gemini (« grounding with Google Search ») dans un appel séparé, puis passe le résultat à l'appel qui produit le JSON. Vérifie dans la doc si les deux peuvent être combinés et si c'est inclus dans l'offre gratuite. **Ne pas extraire de données de Vinted** (scraping interdit par leurs conditions d'utilisation).
- Afficher 2 à 4 références de marché avec leur source. Sans références trouvées → certitude du prix `faible` (en rouge).
- Si j'ai saisi un **prix d'achat** (achat-revente), afficher la marge brute estimée et alerter en rouge si le prix plancher est inférieur au prix d'achat.

### Règles à mettre dans le prompt de l'IA
- **Ne jamais inventer** une marque ou une taille : si l'étiquette n'est pas lisible → `null` + source `inconnu` + ajout dans `a_verifier`.
- Pour l'usure, être **prudent et exhaustif** : bouloches, taches, décoloration, fils tirés, coutures, trous, élasticité, col/poignets. Mieux vaut signaler un doute que l'oublier. L'état choisi doit être cohérent avec les défauts trouvés.
- La description est en **français**, ton simple et honnête. Structure : une phrase d'accroche, puis marque, taille (et conseil de coupe si visible), couleur, matière, état avec les défauts **mentionnés clairement**, puis une ligne de mots-clés. Pas d'emojis. Pas de superlatifs mensongers.

### Interface de relecture
- Chaque champ est **modifiable** et a un bouton **« Copier »**.
- Chaque champ affiche son niveau de certitude selon l'échelle ci-dessus (rouge = moyenne ou faible). Quand je modifie ou valide un champ rouge, il passe en « Vérifié par Tom » (gris neutre).
- Champ optionnel **« Prix d'achat »** pour les pièces achetées pour revente.
- Bouton « Tout copier » pour titre + description.

## Retouche des photos
- **Détourage dans le navigateur, gratuit** : utilise la bibliothèque `@imgly/background-removal` (ou une alternative gratuite équivalente côté navigateur ; justifie ton choix). Pas d'IA générative pour retoucher le vêtement : **le vêtement doit rester strictement identique** (couleurs, défauts compris), seul le fond change.
- Prévois un indicateur de chargement : le modèle de détourage se télécharge au premier usage et peut être lent sur téléphone. Mets-le en cache.
- **Fonds disponibles** :
  - Unis : blanc, gris clair, gris anthracite, noir.
  - Parquet/bois : à partir d'une **photo de texture que je fournirai** (mon propre parquet), placée dans `assets/fonds/`. Permets d'en ajouter d'autres facilement.
- **Choix automatique du fond selon le contraste** :
  - calculer la luminance moyenne du vêtement (pixels du masque de détourage uniquement) ;
  - vêtement clair → fond foncé ou gris ; vêtement foncé → fond blanc ou gris clair ;
  - ne jamais proposer un fond trop proche du vêtement (seuil d'écart de luminance à définir et à ajuster) ;
  - le fond proposé est présélectionné, mais je peux changer.
- Ajouter une **ombre portée douce** sous le vêtement pour éviter l'effet « collage », surtout sur le parquet.
- Option de réglages simples : recadrage, luminosité, rotation.
- Les photos d'étiquettes et de défauts : **pas de détourage** par défaut (juste recadrage/luminosité), car elles doivent rester des photos réelles.
- Export : JPEG de bonne qualité, ≈1600 px sur le plus grand côté, format portrait. Vérifie le format recommandé par Vinted. Bouton « Télécharger toutes les photos » dans l'ordre de l'annonce.

## Parcours utilisateur (écrans)
1. **Accueil** : bouton « Nouvelle annonce ».
2. **Photos** : prendre/importer plusieurs photos, et indiquer leur type (face, dos, étiquette, défaut, détail). Je peux réordonner les photos.
3. **Analyse** : chargement, puis écran de relecture des champs.
4. **Retouche** : aperçu de chaque photo avec le fond choisi, changement de fond.
5. **Export** : copier les textes, télécharger les photos.
6. **Réglages** : clé API, fond par défaut, gestion des textures, marge de négociation (%), écart du prix plancher (%).
7. **Historique** (simple) : les annonces précédentes sont sauvegardées localement (IndexedDB) pour les retrouver.

## Étapes de développement (dans cet ordre, une à la fois)
1. Squelette de la PWA + déploiement sur GitHub Pages + test d'installation sur mon téléphone.
2. Import/prise de photos et écran de typage des photos.
3. Appel à Gemini + affichage et édition des champs + boutons copier.
4. Détourage + fonds unis + choix automatique selon le contraste.
5. Fond parquet + ombre portée + export des photos.
6. Historique local.
7. (Plus tard) Suivi achat-revente : prix d'achat, prix de vente, date, marge, export CSV pour ma comptabilité.

À la fin de chaque étape : dis-moi comment tester sur mon téléphone, ce qui a été fait, et propose l'étape suivante.

## Hors périmètre (V1)
- Publication automatique sur Vinted ou extraction de données Vinted.
- Comptes utilisateurs, serveur, base de données en ligne.
