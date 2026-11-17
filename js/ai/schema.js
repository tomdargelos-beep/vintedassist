// Schéma de sortie structurée imposé à l'IA (format « responseSchema » de l'API Gemini).
import { COULEURS, CATEGORIES, ETATS, GENRES, CERTITUDES } from '../data/vinted.js';
import { TYPES_PHOTO } from '../state.js';

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

// Conversion vers le format JSON Schema standard (utilisé par Claude) :
// types en minuscules, null autorisé via anyOf, objets fermés (additionalProperties: false).
export function enJsonSchema(s) {
  const { type, nullable, propertyOrdering, maxItems, properties, items, ...reste } = s;
  let out = { ...reste, type: type.toLowerCase() };
  if (properties) {
    out.properties = Object.fromEntries(Object.entries(properties).map(([k, v]) => [k, enJsonSchema(v)]));
    out.required = s.required || Object.keys(properties);
    out.additionalProperties = false;
  }
  if (items) out.items = enJsonSchema(items);
  if (nullable) out = { anyOf: [out, { type: 'null' }] };
  return out;
}

export const SCHEMA_GROUPEMENT = {
  type: 'OBJECT',
  properties: {
    groupes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          description: { type: 'STRING' },
          photos: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: { numero: { type: 'INTEGER' }, type: { type: 'STRING', enum: TYPES_PHOTO.map(t => t.id) } },
              required: ['numero', 'type']
            }
          }
        },
        required: ['description', 'photos']
      }
    }
  },
  required: ['groupes']
};
