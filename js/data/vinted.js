// Listes fermées imposées à l'IA (elle ne peut pas inventer d'autres valeurs).
// Couleurs : PROVISOIRE, libellés à vérifier dans l'appli Vinted.

export const COULEURS = [
  'Noir', 'Gris', 'Blanc', 'Crème', 'Beige', 'Abricot', 'Orange', 'Corail', 'Rouge', 'Bordeaux',
  'Rose', 'Rose fuchsia', 'Violet', 'Lila', 'Bleu clair', 'Bleu', 'Marine', 'Turquoise', 'Menthe',
  'Vert', 'Vert foncé', 'Kaki', 'Marron', 'Moutarde', 'Jaune', 'Argenté', 'Doré', 'Multicolore'
];

// Relevé dans l'appli Vinted le 17/11/2026 (Hommes > Vêtements).
// Chemises, T-shirts, Manteaux et Vestes ont encore un niveau en dessous : à compléter.
// Hommes > Chaussures : PROVISOIRE, pas encore vérifié dans l'appli.
export const CATEGORIES = [
  'Hommes > Vêtements > Jeans > Jeans troués',
  'Hommes > Vêtements > Jeans > Jeans skinny',
  'Hommes > Vêtements > Jeans > Jeans slim',
  'Hommes > Vêtements > Jeans > Jeans coupe droite',
  'Hommes > Vêtements > Manteaux et vestes > Manteaux',
  'Hommes > Vêtements > Manteaux et vestes > Vestes sans manches',
  'Hommes > Vêtements > Manteaux et vestes > Vestes',
  'Hommes > Vêtements > Manteaux et vestes > Ponchos',
  'Hommes > Vêtements > Hauts et t-shirts > Chemises',
  'Hommes > Vêtements > Hauts et t-shirts > T-shirts',
  'Hommes > Vêtements > Hauts et t-shirts > Polos',
  'Hommes > Vêtements > Hauts et t-shirts > T-shirts sans manches',
  'Hommes > Vêtements > Costumes et blazers > Blazers',
  'Hommes > Vêtements > Costumes et blazers > Pantalons de costume',
  'Hommes > Vêtements > Costumes et blazers > Gilets de costume',
  'Hommes > Vêtements > Costumes et blazers > Ensembles costume',
  'Hommes > Vêtements > Costumes et blazers > Costumes de mariage',
  'Hommes > Vêtements > Costumes et blazers > Autres',
  'Hommes > Vêtements > Sweats et pulls > Sweats',
  'Hommes > Vêtements > Sweats et pulls > Pulls et pulls à capuche',
  'Hommes > Vêtements > Sweats et pulls > Pulls à capuche avec zip',
  'Hommes > Vêtements > Sweats et pulls > Cardigans',
  'Hommes > Vêtements > Sweats et pulls > Pulls ras de cou',
  'Hommes > Vêtements > Sweats et pulls > Sweats à col V',
  'Hommes > Vêtements > Sweats et pulls > Pulls à col roulé',
  'Hommes > Vêtements > Sweats et pulls > Sweats longs',
  "Hommes > Vêtements > Sweats et pulls > Pulls d'hiver",
  'Hommes > Vêtements > Sweats et pulls > Vestes',
  'Hommes > Vêtements > Sweats et pulls > Autres',
  'Hommes > Vêtements > Pantalons > Chinos',
  'Hommes > Vêtements > Pantalons > Jogging',
  'Hommes > Vêtements > Pantalons > Pantalons skinny',
  'Hommes > Vêtements > Pantalons > Pantacourts',
  'Hommes > Vêtements > Pantalons > Pantalons de costume',
  'Hommes > Vêtements > Pantalons > Pantalons à jambes larges',
  'Hommes > Vêtements > Pantalons > Autres pantalons',
  'Hommes > Vêtements > Shorts > Shorts cargo',
  'Hommes > Vêtements > Shorts > Shorts chino',
  'Hommes > Vêtements > Shorts > Shorts en jean',
  'Hommes > Vêtements > Shorts > Autres shorts',
  "Hommes > Vêtements > Vêtements de sport et accessoires > Vêtements d'extérieur",
  'Hommes > Vêtements > Vêtements de sport et accessoires > Survêtements',
  'Hommes > Vêtements > Vêtements de sport et accessoires > Pantalons',
  'Hommes > Vêtements > Vêtements de sport et accessoires > Shorts',
  'Hommes > Vêtements > Vêtements de sport et accessoires > Hauts et t-shirts',
  'Hommes > Vêtements > Vêtements de sport et accessoires > Maillots',
  'Hommes > Vêtements > Vêtements de sport et accessoires > Pulls & sweats',
  'Hommes > Vêtements > Vêtements de sport et accessoires > Autres',
  'Hommes > Vêtements > Maillots de bain',
  'Hommes > Vêtements > Vêtements spécialisés et costumes',
  'Hommes > Vêtements > Autres',
  'Hommes > Chaussures > Baskets',
  'Hommes > Chaussures > Chaussures de sport',
  'Hommes > Chaussures > Bottes',
  'Hommes > Chaussures > Chaussures habillées',
  'Hommes > Chaussures > Mocassins et chaussures bateau',
  'Hommes > Chaussures > Sandales et tongs',
  'Hommes > Chaussures > Autres',
  'Autre (à préciser)'
];

export const ETATS = ['Neuf avec étiquette', 'Neuf sans étiquette', 'Très bon état', 'Bon état', 'Satisfaisant'];
export const GENRES = ['Homme', 'Femme', 'Enfant', 'Unisexe'];
export const CERTITUDES = ['tres_elevee', 'elevee', 'moyenne', 'faible'];
