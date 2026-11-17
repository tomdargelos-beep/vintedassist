// Fournisseur Gemini (API Google AI Studio, appelée directement depuis le navigateur).
import { SCHEMA_ANALYSE } from './schema.js';
import { promptAnalyse, promptMarche } from './prompt.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

async function appel(cle, chemin, corps) {
  let rep;
  try {
    rep = await fetch(`${BASE}/${chemin}`, {
      method: corps ? 'POST' : 'GET',
      headers: { 'x-goog-api-key': cle, ...(corps ? { 'Content-Type': 'application/json' } : {}) },
      body: corps ? JSON.stringify(corps) : undefined
    });
  } catch {
    throw new Error('Pas de connexion à Internet, ou Gemini injoignable.');
  }
  const json = await rep.json().catch(() => ({}));
  if (!rep.ok) {
    const msg = json?.error?.message || rep.statusText;
    if (rep.status === 400 && /api key/i.test(msg)) throw new Error('Clé API invalide. Vérifie-la dans les Réglages.');
    if (rep.status === 403) throw new Error('Clé API refusée (403). Vérifie qu\'elle autorise l\'API Gemini.');
    if (rep.status === 404) throw new Error('Modèle introuvable. Utilise « Tester la clé » dans les Réglages pour choisir un modèle disponible.');
    if (rep.status === 429) throw new Error('Quota gratuit atteint pour le moment. Réessaie dans une minute (ou demain si c\'est le quota du jour).');
    throw new Error(`Erreur Gemini ${rep.status} : ${msg}`);
  }
  return json;
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

export async function analyserPhotos({ cle, modele, photos, images }) {
  const parts = [{ text: promptAnalyse(photos) }];
  images.forEach((img, i) => {
    parts.push({ text: `Photo ${i + 1} :` });
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
  });
  const rep = await appel(cle, `models/${modele}:generateContent`, {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA_ANALYSE, temperature: 0.2 }
  });
  return JSON.parse(texte(rep));
}

export async function rechercherMarche({ cle, modele, resume }) {
  const rep = await appel(cle, `models/${modele}:generateContent`, {
    contents: [{ role: 'user', parts: [{ text: promptMarche(resume) }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.2 }
  });
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
