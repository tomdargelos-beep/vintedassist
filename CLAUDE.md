# Projet : Assistant d'annonces Vinted (usage personnel)

## Contexte
Je m'appelle Tom, étudiant, je vends sur Vinted mes propres vêtements et des pièces achetées pour revente.
Objectif : réduire au maximum le temps passé à créer une annonce. L'appli ne sert qu'à moi.
Je ne cherche **pas** à apprendre le code : Claude écrit tout. Explications courtes, centrées sur **ce que je dois faire et comment tester sur mon iPhone**. Avancer par étapes testables.

Ce que je vends : surtout de l'**homme**, principalement des **hauts** (t-shirts, sweats, pulls, chemises, polos, vestes) et des **chaussures** (baskets surtout).

## Ce que fait l'appli (vue d'ensemble)
1. Je prends en photo un vêtement avec mon téléphone (plusieurs photos : face, dos, étiquette de marque, étiquette de taille/composition, gros plans des défauts éventuels).
2. L'appli analyse les photos avec une IA et propose : marque, taille, couleur, matière, catégorie, état, défauts, titre et description.
3. L'appli détoure le vêtement et le place sur un fond choisi (uni ou parquet), en choisissant un fond qui contraste avec le vêtement.
4. Je relis, je corrige si besoin, puis je copie chaque champ en un clic et je télécharge les photos retouchées pour les poster sur Vinted à la main.

**Pas de publication automatique sur Vinted** : pas de bot ni d'accès non officiel à Vinted. Je copie-colle moi-même.

## Contraintes techniques
- Je travaille sur **Chromebook** et je prends les photos sur **iPhone (Safari)**. Tout doit marcher sur iOS : installation via Safari > Partager > « Sur l'écran d'accueil », import photos via `<input type="file">` (pas d'attribut `capture` sur l'import multiple), export via le partage natif (`navigator.share` avec fichiers → « Enregistrer les images » dans Photos) car le téléchargement de plusieurs fichiers est mauvais sur iOS.
- Format : **appli web progressive (PWA)** = un site web installable comme une appli sur le téléphone, qui marche aussi sur le Chromebook.
- Code **100 % front-end** (HTML, CSS, JavaScript), sans serveur à payer. **Choix retenu : JavaScript en modules ES natifs, sans étape de build** (pas de Vite, pas de Node requis). Les bibliothèques externes sont chargées depuis un CDN avec une version figée.
- Hébergement gratuit : **GitHub Pages** (HTTPS obligatoire pour la PWA et l'accès à l'appareil photo). Le dépôt est **public** (condition de la gratuité de Pages). Tous les chemins sont **relatifs** (le site est servi sous `/vintedassist/`).
- Budget quasi nul : uniquement des outils gratuits, à part éventuellement quelques centimes d'API.

## Analyse IA des photos
- **Fournisseur principal : Claude Opus 5.5** (`claude-opus-5-5`, API Anthropic, crédits prépayés, ~0,10-0,15 € par annonce), choisi le 17/11/2026 car l'offre gratuite Gemini renvoyait des erreurs 503 « surchargé » sur tous les modèles Flash. SDK officiel `@anthropic-ai/sdk` 1.4.0 empaqueté dans `js/vendor/` (appel direct depuis le navigateur, `dangerouslyAllowBrowser`). Analyse en sortie JSON stricte (`output_config.format`, effort `high`), prix via l'outil `web_search_20260209` (Vinted bloqué), repli serveur `fallbacks: "default"`. Bascule automatique sur Gemini si Claude est indisponible et qu'une clé Gemini est saisie.
- **Mise à jour 18/11/2026 (coût, choix de Tom)** : modèle Claude au choix dans les Réglages (`claude-haiku-5-5` par défaut, < 1 centime/annonce ; `claude-sonnet-5-5` ~3-4 centimes ; `claude-opus-5-5` ~10 centimes). **Recherche de prix désactivée par défaut** (`recherchePrix`) : le prix visé est une estimation indicative de l'IA (non comptée dans les champs à vérifier), Tom fixe ses prix. Pas de `fallbacks` serveur sur Haiku ; recherche web en `web_search_20250305` sur Haiku.
- Fournisseur de secours : **API Google Gemini** (offre gratuite, modèle « Flash » multimodal). Note : mon abonnement Gemini Pro (appli grand public) ne donne **pas** d'accès à l'API ; la clé API se crée séparément et gratuitement sur Google AI Studio. Vérifie dans la doc officielle le nom du modèle actuel au lieu d'en coder un de mémoire.
- Modèle : alias `gemini-flash-latest` par défaut (modifiable dans les Réglages, bouton « Tester la clé » qui liste les modèles disponibles). Recherche de prix : 2e appel avec l'outil `google_search`, sortie JSON lue dans le texte (le JSON strict n'est pas combiné à la recherche).
- Prévois une **couche d'abstraction** (un module `aiProvider`) pour pouvoir passer plus tard à l'API Claude sans tout réécrire.
- **Clé API** : je la saisis dans un écran « Réglages » ; elle est stockée uniquement dans le `localStorage` de l'appareil. Elle ne doit **jamais** apparaître dans le code ni dans le dépôt GitHub. Ajoute un `.gitignore` adapté.
- Réduis les images avant l'envoi (≈1024 px sur le plus grand côté) pour limiter le coût et le temps.
- Demande à l'IA une **réponse JSON stricte** (utilise le mode de sortie structurée de l'API) avec ce schéma :

Chaque information identifiée est un objet `{valeur, certitude, justification}` :
- `certitude` ∈ `tres_elevee | elevee | moyenne | faible`
- `justification` : une phrase courte (ex. « lu sur l'étiquette, photo 3 », « déduit de la coupe, pas d'étiquette visible »).
- Les photos sont numérotées **à partir de 1**, dans l'ordre affiché à l'écran (`photo_index` aussi).
- **Couleurs** et **catégorie** : listes fermées (enum dans le schéma de sortie structurée), définies dans un fichier de données du code (`js/data/vinted.js`) que je peux corriger. Catégories prioritaires : Hommes > hauts (t-shirts, polos, chemises, sweats, pulls, vestes) et Hommes > chaussures. Les libellés exacts sont à vérifier dans l'appli Vinted.
- L'IA ne renvoie **que le prix visé** ; prix affiché et prix plancher sont calculés par le code.

```json
{
  "genre":         {"valeur": "Homme | Femme | Enfant | Unisexe", "certitude": "...", "justification": "string"},
  "marque":        {"valeur": "string | null", "certitude": "...", "justification": "string"},
  "taille":        {"valeur": "string | null", "certitude": "...", "justification": "string"},
  "categorie_vinted": {"valeur": "choisie dans une liste fermée (enum) fournie par le code, ex. Hommes > Vêtements > Sweats et pulls > Sweats", "certitude": "...", "justification": "string"},
  "couleurs":      {"valeur": ["max 2, noms de couleurs de Vinted"], "certitude": "...", "justification": "string"},
  "matiere":       {"valeur": "string | null", "certitude": "...", "justification": "string"},
  "etat":          {"valeur": "Neuf avec étiquette | Neuf sans étiquette | Très bon état | Bon état | Satisfaisant", "certitude": "...", "justification": "string"},
  "defauts": [{"description": "string", "photo_index": 1, "certitude": "...", "justification": "string"}],
  "prix": {
    "prix_vise": 0,
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
- **Ne jamais inventer** une marque ou une taille : si l'étiquette n'est pas lisible → `valeur: null`, certitude `faible`. Pour la taille, indiquer le système lu (EU, US, UK) ; pour les chaussures, donner la pointure EU si elle figure sur l'étiquette.
- Pour l'usure, être **prudent et exhaustif** : bouloches, taches, décoloration, fils tirés, coutures, trous, élasticité, col/poignets. Mieux vaut signaler un doute que l'oublier. L'état choisi doit être cohérent avec les défauts trouvés.
- **Format de référence (choisi par Tom le 17/11/2026)** : titre « Type Marque(+ligne) couleur taille X » (ex. « T-shirt Carhartt WIP marron rouille taille M ») ; description = un paragraphe de 4 à 6 phrases courtes (type/marque/couleur/taille, logo ou détail, qualité vérifiable, état avec défauts cités, style), ligne vide, puis 4 à 6 hashtags (#marque #marqueligne #type #style #taille). Photos visées : rendu packshot (à plat, défroissé, symétrique, fond « Studio » blanc cassé #f1f1f0, ombre douce), obtenu à partir des photos de l'article réel, jamais avec des photos de la marque.
- La description est en **français**, ton simple et honnête. Structure : une phrase d'accroche, puis marque, taille (et conseil de coupe si visible), couleur, matière, état avec les défauts **mentionnés clairement**, puis une ligne de mots-clés. Pas d'emojis. Pas de superlatifs mensongers.

### Interface de relecture
- Chaque champ est **modifiable** et a un bouton **« Copier »**.
- Chaque champ affiche son niveau de certitude selon l'échelle ci-dessus (rouge = moyenne ou faible). Quand je modifie ou valide un champ rouge, il passe en « Vérifié par Tom » (gris neutre).
- Champ optionnel **« Prix d'achat »** pour les pièces achetées pour revente.
- Champ optionnel **« Mesures »** saisi à la main (hauts : longueur, aisselle à aisselle ; chaussures : longueur intérieure), inséré automatiquement dans la description.
- Bouton « Tout copier » pour titre + description.

## Retouche des photos
- **Choix retenu (17/11/2026)** : `@imgly/background-removal` **1.4.5** + données 1.4.5 (paire cohérente publiée sur npm), modèle « small », **hébergés dans le dépôt** (`js/vendor/bg-removal-1.4.5.mjs`, `assets/detourage/`, ~62 Mo) pour ne dépendre d'aucun CDN ; le service worker les met en cache (cache d'abord). Licence AGPL-3.0, compatible avec un dépôt public à usage perso. Fond choisi d'après la luminance de la 1re photo détourée (seuil d'écart 70/255). Sortie 1200×1600 (3:4 portrait, ratio Vinted encore à vérifier).
- **Détourage dans le navigateur, gratuit** : utilise la bibliothèque `@imgly/background-removal` (ou une alternative gratuite équivalente côté navigateur ; justifie ton choix). Le détourage ne modifie pas le vêtement (couleurs, défauts compris), seul le fond change ; la seule exception est la version « repassée » par l'IA décrite plus bas, toujours optionnelle et signalée.
- Prévois un indicateur de chargement : le modèle de détourage se télécharge au premier usage et peut être lent sur téléphone. Mets-le en cache.
- **Fonds disponibles** :
  - Unis : blanc, gris clair, gris anthracite, noir.
  - Parquet/bois : à partir d'une **photo de texture que je fournirai** (mon propre parquet), placée dans `assets/fonds/`. Permets d'en ajouter d'autres facilement.
- **Choix automatique du fond selon le contraste** :
  - calculer la luminance moyenne du vêtement (pixels du masque de détourage uniquement) ;
  - vêtement clair → fond foncé ou gris ; vêtement foncé → fond blanc ou gris clair ;
  - ne jamais proposer un fond trop proche du vêtement (seuil d'écart de luminance à définir et à ajuster) ;
  - le fond proposé est présélectionné, mais je peux changer.
- **Version « repassée » par l'IA (décision de Tom, 17/11/2026)** : bouton optionnel sur les photos détourées (face, dos, profil) qui envoie la photo au modèle d'édition d'image de Gemini (détection automatique d'un modèle `…image…`, réglable) pour défroisser, redresser et centrer le vêtement, avec consigne de garder à l'identique couleurs, logo, texte, étiquettes, proportions **et défauts**. Jamais sur étiquettes, défauts, détails, semelles. Par défaut : version IA en couverture **et** photo réelle juste après (choix par photo : les deux / IA seule / réelle seule). Dès qu'une photo IA est utilisée, une **mention exacte** (réglable, « retouchée numériquement : fond et défroissage ») est ajoutée à la description. Ne jamais écrire que la photo n'a reçu « qu'un fond blanc » si elle a été défroissée par l'IA.
- **Mise à jour 17/11/2026 : Tom refuse de payer l'édition d'image Google** → repassage IA **désactivé par défaut** (option « Repassage par l'IA (payant chez Google) » dans les Réglages, code conservé). À la place, gratuit et sans modifier le vêtement : **nettoyage du détourage** (on ne garde que les grandes zones d'un seul tenant, ≥ 15 % de la plus grande) et **redressement automatique** (angle qui maximise la symétrie gauche-droite de la silhouette, entre −20° et +20°, appliqué seulement si le gain est net ; pas sur les profils de chaussures). Pour les plis : défroisser en vrai avant la photo.
- **Retouche via l'appli Gemini (décision de Tom, 17/11/2026)** : Tom a Gemini Pro (abonnement grand public, édition d'image incluse). Sur chaque annonce : « 1. Copier le prompt Gemini » puis « 2. Envoyer les photos à Gemini » (partage natif des photos face/dos/profil uniquement ; étiquettes et défauts restent réelles). Le prompt demande une image retouchée par photo envoyée (packshot, défroissé, symétrique, défauts conservés) et impose le fond selon la couleur détectée par Claude : couleur claire (Blanc, Crème, Beige, Gris…) → gris anthracite, sinon → blanc cassé #f1f1f0 (`js/gemini-app.js`). L'envoi coche la mention « photos retouchées » ajoutée à la description (paragraphe, mention, hashtags). Le détourage dans l'appli devient optionnel (`retoucheAuto`, désactivé par défaut : le lot ne fait que trier et analyser).
- Ajouter une **ombre portée douce** sous le vêtement pour éviter l'effet « collage », surtout sur le parquet.
- Option de réglages simples : recadrage, luminosité, rotation.
- Les photos d'étiquettes et de défauts : **pas de détourage** par défaut (juste recadrage/luminosité), car elles doivent rester des photos réelles.
- Export : JPEG de bonne qualité, ≈1600 px sur le plus grand côté, format portrait. Vérifie le format recommandé par Vinted. Bouton « Enregistrer toutes les photos » dans l'ordre de l'annonce : sur iPhone via le partage natif (enregistrement dans Photos), sinon téléchargement classique.

## Mode « plusieurs annonces d'un coup » (lot)
- J'importe toutes les photos de plusieurs articles ; l'IA les regroupe par article et donne le type de chaque photo (un appel, photos réduites à 512 px).
- Je valide ou corrige les groupes (déplacer une photo, changer un type, renommer), puis l'appli crée chaque annonce, range les photos dans l'ordre (face, dos, …, étiquettes, défauts), lance l'analyse puis le détourage, l'une après l'autre.
- Plusieurs annonces peuvent être en cours en même temps (liste sur l'accueil, stockées dans IndexedDB).

## Interface (18/11/2026)
Minimaliste, inspirée d'iOS : fond #f6f6f4, blocs blancs arrondis sans bordure, un seul bouton noir par écran, icônes au trait (`js/icones.js`), interrupteurs façon iOS, mode sombre automatique, réglages enregistrés automatiquement. Accueil : « Ajouter des photos » (un ou plusieurs articles, tri par l'IA) et « Un article », puis la liste des annonces en cours. Écran annonce : bandeau de photos, Texte, Prix, Détails Vinted (lignes compactes + copier + certitude), Défauts, Photos (Gemini), liens discrets en bas. Tom pourra envoyer un design de référence.

## Parcours utilisateur (écrans)
1. **Accueil** : bouton « Nouvelle annonce ».
2. **Photos** : prendre/importer plusieurs photos, et indiquer leur type (face, dos, profil, semelle, étiquette marque, étiquette taille/composition, défaut, détail). Je peux réordonner les photos.
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

## Points fiscaux (à garder en tête)
- Vendre ses propres vêtements d'occasion : non imposable.
- Achat-revente : activité commerciale, à déclarer (en général micro-entreprise) dès le début, indépendamment des seuils DAC7 (30 ventes ou 2 000 €/an déclarés par Vinted au fisc). Vinted demande aux vendeurs pros d'utiliser Vinted Pro. À faire vérifier (URSSAF / conseiller), y compris l'impact sur le foyer fiscal des parents.

## Hors périmètre (V1)
- Publication automatique sur Vinted ou extraction de données Vinted.
- Comptes utilisateurs, serveur, base de données en ligne.
