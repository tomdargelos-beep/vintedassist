// Schéma de sortie structurée imposé à l'IA (format « responseSchema » de l'API Gemini).
import { COULEURS, CATEGORIES, ETATS, GENRES, CERTITUDES } from '../data/vinted.js';

const S = (extra = {}) => ({ type: 'STRING', ...extra });
const certitude = S({ enum: CERTITUDES });

function champ(valeur) {
  return {
    type: 'OBJECT',
    properties: { valeur, certitude, justification: S() },
    required: ['valeur', 'certitude', 'justification'],
    propertyOrdering: ['valeur', 'certitude', 'justification']
  };
}

export const SCHEMA_ANALYSE = {
  type: 'OBJECT',
  properties: {
    genre: champ(S({ enum: GENRES, nullable: true })),
    marque: champ(S({ nullable: true })),
    taille: champ(S({ nullable: true })),
    categorie_vinted: champ(S({ enum: CATEGORIES, nullable: true })),
    couleurs: champ({ type: 'ARRAY', items: S({ enum: COULEURS }), maxItems: 2 }),
    matiere: champ(S({ nullable: true })),
    etat: champ(S({ enum: ETATS })),
    defauts: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { description: S(), photo_index: { type: 'INTEGER' }, certitude, justification: S() },
        required: ['description', 'photo_index', 'certitude', 'justification']
      }
    },
    prix: {
      type: 'OBJECT',
      properties: { prix_vise: { type: 'NUMBER' }, certitude, justification: S() },
      required: ['prix_vise', 'certitude', 'justification']
    },
    titre: S(),
    description: S(),
    mots_cles: { type: 'ARRAY', items: S() }
  },
  required: ['genre', 'marque', 'taille', 'categorie_vinted', 'couleurs', 'matiere', 'etat', 'defauts', 'prix', 'titre', 'description', 'mots_cles'],
  propertyOrdering: ['genre', 'marque', 'taille', 'categorie_vinted', 'couleurs', 'matiere', 'etat', 'defauts', 'prix', 'titre', 'description', 'mots_cles']
};
