// Fournisseur Gemini (API Google AI Studio, appelée directement depuis le navigateur).
import { SCHEMA_ANALYSE, SCHEMA_GROUPEMENT } from './schema.js';
import { promptAnalyse, promptMarche, promptGroupement } from './prompt.js';
import { nettoyerCle } from '../settings.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

async function appel(cle, chemin, corps) {
  let rep;
  try {
    rep = await fetch(`${BASE}/${chemin}`, {
      method: corps ? 'POST' : 'GET',
      headers: { 'x-goog-api-key': nettoyerCle(cle), ...(corps ? { 'Content-Type': 'application/json' } : {}) },
      body: corps ? JSON.stringify(corps) : undefined
    });
  } catch {
    throw new Error('Pas de connexion à Internet, ou Gemini injoignable.');
  }
  const json = await rep.json().catch(() => ({}));
  if (!rep.ok) {
    const msg = json?.error?.message || rep.statusText;
    if (rep.status === 401 || (rep.status === 400 && /api key/i.test(msg))) throw new Error('Clé API refusée par Google (clé invalide, incomplète ou supprimée). Recopie-la depuis Google AI Studio.');
    if (rep.status === 400 && /api key/i.test(msg)) throw new Error('Clé API invalide. Vérifie-la dans les Réglages.');
    if (rep.status === 403) throw new Error('Clé API refusée (403). Vérifie qu\'elle autorise l\'API Gemini.');
    if (rep.status === 404) throw new Error('Modèle introuvable. Utilise « Tester la clé » dans les Réglages pour choisir un modèle disponible.');
    if ([500, 502, 503, 504].includes(rep.status)) {
      const e = new Error('Gemini est surchargé en ce moment (erreur ' + rep.status + '). Réessaie dans quelques minutes.');
      e.status = rep.status;
      throw e;
    }
    if (rep.status === 429) throw Object.assign(new Error('quota gratuit atteint (réessaie dans une minute, ou demain si c\'est le quota du jour).'), { status: 429 });
    throw new Error(`Erreur Gemini ${rep.status} : ${msg}`);
  }
  return json;
}

const attendre = ms => new Promise(r => setTimeout(r, ms));
const DELAIS = [3000, 8000]; // nouveaux essais après 3 s puis 8 s

// Modèles de secours : autres modèles Flash disponibles avec la clé, du plus récent au plus ancien.
async function modelesSecours(cle, actuel) {
  try {
    const noms = await listerModeles(cle);
    const version = n => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
    const stables = noms
      .filter(n => /^gemini-\d+(\.\d+)?-flash(-lite)?$/.test(n) && n !== actuel)
      .sort((a, b) => version(b) - version(a) || a.length - b.length);
    return [...stables.slice(0, 2), 'gemini-flash-lite-latest'].filter((n, i, t) => n !== actuel && t.indexOf(n) === i);
  } catch {
    return ['gemini-flash-lite-latest'].filter(n => n !== actuel);
  }
}

// Appel generateContent avec nouveaux essais si surcharge, puis bascule sur un modèle de secours.
async function generer({ cle, modele, corps, onEtape = () => {} }) {
  let candidats = [modele];
  let derniere;
  for (let i = 0; i < candidats.length; i++) {
    const m = candidats[i];
    for (let essai = 0; essai <= DELAIS.length; essai++) {
      try {
        const rep = await appel(cle, `models/${m}:generateContent`, corps);
        return { rep, modele: m };
      } catch (e) {
        if (!e.status) throw e; // erreur non liée à la surcharge : inutile d'insister
        derniere = e;
        if (essai < DELAIS.length) {
          onEtape(`Gemini surchargé, nouvel essai dans ${DELAIS[essai] / 1000} s…`);
          await attendre(DELAIS[essai]);
        }
      }
    }
    if (i === 0) candidats = [modele, ...(await modelesSecours(cle, modele))];
    if (candidats[i + 1]) onEtape(`Modèle saturé, essai avec ${candidats[i + 1]}…`);
  }
  throw derniere;
}

function texte(rep) {
  const c = rep?.candidates?.[0];
  const t = (c?.content?.parts || []).map(p => p.text || '').join('');
  if (!t) throw new Error(`Réponse vide de Gemini (${c?.finishReason || 'raison inconnue'}).`);
  return t;
}

function extraireJSON(t) {
  const debut = t.indexOf('{');
  const fin = t.lastIndexOf('}');
  if (debut < 0 || fin < debut) throw new Error('Pas de JSON dans la réponse.');
  return JSON.parse(t.slice(debut, fin + 1));
}

export async function analyserPhotos({ cle, modele, photos, images, onEtape }) {
  const parts = [{ text: promptAnalyse(photos) }];
  images.forEach((img, i) => {
    parts.push({ text: `Photo ${i + 1} :` });
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
  });
  const { rep, modele: utilise } = await generer({ cle, modele, onEtape, corps: {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA_ANALYSE, temperature: 0.2 }
  } });
  return { ...JSON.parse(texte(rep)), modele_utilise: utilise };
}

export async function rechercherMarche({ cle, modele, resume, onEtape }) {
  const { rep } = await generer({ cle, modele, onEtape, corps: {
    contents: [{ role: 'user', parts: [{ text: promptMarche(resume) }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.2 }
  } });
  const res = extraireJSON(texte(rep));
  // Sources réelles renvoyées par la recherche Google, si l'IA n'a pas nommé les siennes.
  const sources = (rep.candidates?.[0]?.groundingMetadata?.groundingChunks || [])
    .map(c => c.web?.title).filter(Boolean);
  res.references_marche = (res.references_marche || []).slice(0, 4).map((r, i) => ({
    ...r, source: r.source || sources[i] || 'source non précisée'
  }));
  return res;
}

export async function listerModeles(cle) {
  const rep = await appel(cle, 'models?pageSize=200');
  return (rep.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name.replace(/^models\//, ''));
}

export async function grouperPhotos({ cle, modele, images, onEtape }) {
  const parts = [{ text: promptGroupement(images.length) }];
  images.forEach((img, i) => {
    parts.push({ text: `Photo ${i + 1} :` });
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
  });
  const { rep } = await generer({ cle, modele, onEtape, corps: {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA_GROUPEMENT, temperature: 0.1 }
  } });
  return JSON.parse(texte(rep));
}
