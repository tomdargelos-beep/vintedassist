// Fournisseur Claude (API Anthropic), appelée directement depuis le navigateur via le SDK officiel.
import Anthropic from '../vendor/anthropic-sdk-1.4.0.mjs';
import { SCHEMA_ANALYSE, SCHEMA_GROUPEMENT, enJsonSchema } from './schema.js';
import { promptAnalyse, promptMarche, promptGroupement } from './prompt.js';
import { nettoyerCle } from '../settings.js';

export const MODELE = 'claude-opus-5-5';
// Modèles proposés dans les Réglages (du moins cher au plus précis). Coût estimé par annonce sans recherche de prix.
export const MODELES = [
  { id: 'claude-haiku-5-5', nom: 'Haiku 5.5 — économique (< 1 centime)', effort: 'medium' },
  { id: 'claude-sonnet-5-5', nom: 'Sonnet 5.5 — équilibré (~3-4 centimes)', effort: 'medium' },
  { id: 'claude-opus-5-5', nom: 'Opus 5.5 — le plus précis (~10 centimes)', effort: 'high' }
];
const infos = id => MODELES.find(m => m.id === id) || MODELES[0];
const SCHEMA = enJsonSchema(SCHEMA_ANALYSE);
// Repli automatique côté serveur si le modèle refuse une requête (rare ici). Pas disponible sur Haiku.
const repli = id => (id === 'claude-haiku-5-5' ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });

function client(cle) {
  return new Anthropic({ apiKey: nettoyerCle(cle), dangerouslyAllowBrowser: true, maxRetries: 2, timeout: 180000 });
}

// Traduit les erreurs du SDK en messages clairs ; `status` marque les erreurs temporaires (bascule possible).
function traduire(e) {
  const err = msg => Object.assign(new Error(msg), { status: e.status });
  if (e instanceof Anthropic.AuthenticationError) return new Error('Clé Claude refusée (invalide ou supprimée). Recopie-la depuis console.anthropic.com.');
  if (e instanceof Anthropic.PermissionDeniedError) return new Error('Clé Claude sans autorisation pour ce modèle.');
  if (e instanceof Anthropic.RateLimitError) return err('Trop de requêtes vers Claude pour le moment. Réessaie dans une minute.');
  if (e instanceof Anthropic.BadRequestError) return new Error('Requête refusée par Claude : ' + e.message + ' (si on parle de crédits : recharge sur console.anthropic.com).');
  if (e instanceof Anthropic.APIConnectionError) return Object.assign(new Error('Pas de connexion à Internet, ou Claude injoignable.'), { status: 0 });
  if (e instanceof Anthropic.APIError && e.status >= 500) return err(`Claude est indisponible en ce moment (erreur ${e.status}).`);
  if (e instanceof Anthropic.APIError) return new Error(`Erreur Claude ${e.status} : ${e.message}`);
  return e;
}

function verifierFin(rep) {
  if (rep.stop_reason === 'refusal') throw new Error('Claude a refusé d\'analyser ces photos.');
  if (rep.stop_reason === 'max_tokens') throw new Error('Réponse de Claude trop longue (coupée). Réessaie.');
}

const texte = rep => rep.content.filter(b => b.type === 'text').map(b => b.text).join('');

export async function analyserPhotos({ cle, modeleClaude, photos, images }) {
  const m = infos(modeleClaude);
  const content = [{ type: 'text', text: promptAnalyse(photos) }];
  images.forEach((img, i) => {
    content.push({ type: 'text', text: `Photo ${i + 1} :` });
    content.push({ type: 'image', source: { type: 'base64', media_type: img.mimeType, data: img.base64 } });
  });
  let rep;
  try {
    rep = await client(cle).beta.messages.create({
      model: m.id,
      max_tokens: 16000,
      ...repli(m.id),
      output_config: { effort: m.effort, format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content }]
    });
  } catch (e) {
    throw traduire(e);
  }
  verifierFin(rep);
  return { ...JSON.parse(texte(rep)), modele_utilise: rep.model };
}

function extraireJSON(t) {
  const debut = t.indexOf('{');
  const fin = t.lastIndexOf('}');
  if (debut < 0 || fin < debut) throw new Error('Pas de JSON dans la réponse.');
  return JSON.parse(t.slice(debut, fin + 1));
}

export async function rechercherMarche({ cle, modeleClaude, resume }) {
  const m = infos(modeleClaude);
  const c = client(cle);
  const messages = [{ role: 'user', content: promptMarche(resume) }];
  const outils = [{
    // La variante récente (filtrage dynamique) n'existe pas sur Haiku : variante de base pour lui.
    type: m.id === 'claude-haiku-5-5' ? 'web_search_20250305' : 'web_search_20260209', name: 'web_search', max_uses: 4,
    user_location: { type: 'approximate', country: 'FR' },
    blocked_domains: ['vinted.fr', 'vinted.com']
  }];
  let rep;
  try {
    // La recherche web peut faire une pause (« pause_turn ») : on relance pour la laisser finir.
    for (let i = 0; i < 3; i++) {
      rep = await c.beta.messages.create({
        model: m.id, max_tokens: 16000, ...repli(m.id),
        output_config: { effort: 'medium' }, tools: outils, messages
      });
      if (rep.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: rep.content });
    }
  } catch (e) {
    throw traduire(e);
  }
  verifierFin(rep);
  const res = extraireJSON(texte(rep));
  const sources = rep.content
    .filter(b => b.type === 'web_search_tool_result' && Array.isArray(b.content))
    .flatMap(b => b.content.map(r => r.title)).filter(Boolean);
  res.references_marche = (res.references_marche || []).slice(0, 4).map((r, i) => ({
    ...r, source: r.source || sources[i] || 'source non précisée'
  }));
  return res;
}

export async function listerModeles(cle) {
  try {
    const page = await client(cle).models.list();
    return page.data.map(m => m.id);
  } catch (e) {
    throw traduire(e);
  }
}

export async function grouperPhotos({ cle, modeleClaude, images }) {
  const m = infos(modeleClaude);
  const content = [{ type: 'text', text: promptGroupement(images.length) }];
  images.forEach((img, i) => {
    content.push({ type: 'text', text: `Photo ${i + 1} :` });
    content.push({ type: 'image', source: { type: 'base64', media_type: img.mimeType, data: img.base64 } });
  });
  let rep;
  try {
    rep = await client(cle).beta.messages.create({
      model: m.id, max_tokens: 16000, ...repli(m.id),
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: enJsonSchema(SCHEMA_GROUPEMENT) } },
      messages: [{ role: 'user', content }]
    });
  } catch (e) {
    throw traduire(e);
  }
  verifierFin(rep);
  return JSON.parse(texte(rep));
}
