import { h, toast } from '../ui.js';
import { chargerAnnonce, sauverAnnonce } from '../state.js';
import { lireReglages } from '../settings.js';
import { analyserAnnonce } from '../ai/provider.js';
import { calculerPrix } from '../prix.js';
import { CATEGORIES, COULEURS, ETATS, GENRES } from '../data/vinted.js';
import { aller } from '../app.js';

const LIBELLES = {
  tres_elevee: 'Certitude très élevée',
  elevee: 'Certitude élevée',
  moyenne: 'Certitude moyenne',
  faible: 'Certitude faible – à vérifier'
};
const estRouge = c => c === 'moyenne' || c === 'faible';

export async function copier(texte) {
  try {
    await navigator.clipboard.writeText(texte);
  } catch {
    const t = h('textarea', { value: texte, style: 'position:fixed;opacity:0' });
    document.body.append(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }
  toast('Copié');
}

export async function ecranAnalyse(app) {
  const annonce = await chargerAnnonce();
  const reglages = lireReglages();

  if (!annonce.photos.length) {
    app.append(h('p', { class: 'empty' }, 'Ajoute d\'abord des photos.'),
      h('button', { class: 'btn', onclick: () => aller('photos') }, 'Aller aux photos'));
    return;
  }
  if (!reglages.cleClaude && !reglages.apiKey) {
    app.append(h('div', { class: 'hint' }, 'Aucune clé API enregistrée (Claude ou Gemini).',
      h('button', { class: 'btn', onclick: () => aller('reglages') }, 'Ouvrir les Réglages')));
    return;
  }

  if (!annonce.analyse) {
    await lancer(app, annonce, reglages);
    if (!annonce.analyse) return;
  }
  relecture(app, annonce, reglages);
}

async function lancer(app, annonce, reglages) {
  const etape = h('p', { class: 'chargement' }, 'Démarrage…');
  app.replaceChildren(h('div', { class: 'card centre' }, h('div', { class: 'spinner' }), etape,
    h('p', { class: 'muted' }, 'Compte 20 à 60 secondes.')));
  try {
    annonce.analyse = await analyserAnnonce(annonce.photos, reglages, t => { etape.textContent = t; });
    annonce.saisie = { mesures: '', prixAchat: '' };
    await sauverAnnonce();
  } catch (e) {
    console.error(e);
    app.replaceChildren(
      h('div', { class: 'card alerte' }, h('strong', {}, 'L\'analyse a échoué. '), e.message),
      h('button', { class: 'btn btn-primary', onclick: async () => { app.replaceChildren(); await ecranAnalyse(app); } }, 'Réessayer'),
      h('button', { class: 'btn', onclick: () => aller('reglages') }, 'Réglages')
    );
  }
}

function relecture(app, annonce, reglages) {
  const a = annonce.analyse;
  a.saisie ??= {};
  const s = annonce.saisie ??= { mesures: '', prixAchat: '' };
  let timer;
  const sauver = () => { clearTimeout(timer); timer = setTimeout(sauverAnnonce, 400); };

  const compteur = h('div', { class: 'compteur' });
  function majCompteur() {
    const champs = ['genre', 'marque', 'taille', 'categorie_vinted', 'couleurs', 'matiere', 'etat'].map(k => a[k]);
    const n = [...champs, ...a.defauts, a.prix].filter(c => c && estRouge(c.certitude) && !c.verifie).length;
    compteur.className = 'compteur ' + (n ? 'rouge' : 'ok');
    compteur.textContent = n ? `${n} champ${n > 1 ? 's' : ''} en rouge à vérifier` : 'Tout est vérifié';
  }

  function badge(c, onValider) {
    const el = h('button', { class: 'badge', type: 'button' });
    const just = h('div', { class: 'justif', hidden: true }, c.justification || '');
    function maj() {
      const rouge = estRouge(c.certitude) && !c.verifie;
      el.className = 'badge ' + (c.verifie ? 'verifie' : c.certitude);
      el.textContent = c.verifie ? 'Vérifié par Tom' : LIBELLES[c.certitude] || c.certitude;
      valider.hidden = !rouge;
    }
    const valider = h('button', { class: 'mini', type: 'button', onclick: () => { c.verifie = true; maj(); majCompteur(); sauverAnnonce(); onValider?.(); } }, 'Valider');
    el.addEventListener('click', () => { just.hidden = !just.hidden; });
    const marquer = () => { c.verifie = true; maj(); majCompteur(); sauverAnnonce(); };
    maj();
    return { noeud: h('div', {}, h('div', { class: 'badge-ligne' }, el, valider), just), marquer };
  }

  function ligneCopie(label, input, getTexte) {
    return h('div', { class: 'champ-ligne' }, input,
      h('button', { class: 'mini', type: 'button', onclick: () => copier(getTexte()) }, 'Copier'));
  }

  // Champ « simple » : valeur texte ou liste fermée.
  function champ(label, cle, options = null) {
    const c = a[cle];
    const b = badge(c);
    let input;
    const val = Array.isArray(c.valeur) ? c.valeur.join(', ') : (c.valeur ?? '');
    if (options) {
      input = h('select', {}, h('option', { value: '' }, '— à choisir —'),
        options.map(o => h('option', { value: o, selected: o === c.valeur }, o)));
      if (c.valeur && !options.includes(c.valeur)) input.append(h('option', { value: c.valeur, selected: true }, c.valeur));
    } else {
      input = h('input', { type: 'text', value: val, placeholder: 'inconnu' });
    }
    input.addEventListener('change', () => {
      c.valeur = cle === 'couleurs' ? input.value.split(',').map(x => x.trim()).filter(Boolean) : (input.value.trim() || null);
      b.marquer();
    });
    return h('div', { class: 'card champ' + (estRouge(c.certitude) && !c.verifie ? ' champ-rouge' : '') },
      h('label', {}, label), ligneCopie(label, input, () => input.value), b.noeud);
  }

  // Titre et description
  const titre = h('input', { type: 'text', value: a.titre || '', maxLength: 100 });
  const compteTitre = h('span', { class: 'muted' });
  const majTitre = () => { compteTitre.textContent = `${titre.value.length} caractères`; };
  titre.addEventListener('input', () => { a.titre = titre.value; majTitre(); sauver(); });
  majTitre();

  const desc = h('textarea', { rows: 10 });
  const descFinale = () => {
    const d = (a.description || '').trim();
    if (!s.mesures.trim()) return d;
    const lignes = d.split('\n');
    const ligneMesures = `Mesures : ${s.mesures.trim()}`;
    if (lignes.length > 1) lignes.splice(lignes.length - 1, 0, ligneMesures);
    else lignes.push(ligneMesures);
    return lignes.join('\n');
  };
  desc.value = a.description || '';
  desc.addEventListener('input', () => { a.description = desc.value; sauver(); });

  const mesures = h('input', { type: 'text', value: s.mesures, placeholder: 'ex. longueur 70 cm, aisselle à aisselle 55 cm' });
  mesures.addEventListener('input', () => { s.mesures = mesures.value; sauver(); });

  // Défauts
  const blocDefauts = h('div', { class: 'card' }, h('label', {}, `Défauts (${a.defauts.length})`));
  if (!a.defauts.length) blocDefauts.append(h('p', { class: 'muted' }, 'Aucun défaut détecté. Vérifie quand même la pièce.'));
  a.defauts.forEach(d => {
    const b = badge(d);
    blocDefauts.append(h('div', { class: 'defaut' + (estRouge(d.certitude) && !d.verifie ? ' champ-rouge' : '') },
      h('p', {}, d.description, d.photo_index ? h('span', { class: 'muted' }, ` (photo ${d.photo_index})`) : null), b.noeud));
  });

  // Prix
  const p = a.prix;
  const prixVise = h('input', { type: 'number', inputMode: 'numeric', value: p.prix_vise });
  const prixAchat = h('input', { type: 'number', inputMode: 'decimal', value: s.prixAchat, placeholder: 'optionnel' });
  const bPrix = badge(p);
  const sortiePrix = h('div', {});
  function majPrix() {
    const calc = calculerPrix(prixVise.value, reglages.margePct, reglages.plancherPct);
    const achat = Number(prixAchat.value);
    sortiePrix.replaceChildren(
      h('div', { class: 'prix-grille' },
        h('div', {}, h('div', { class: 'muted' }, 'Affiché'), h('div', { class: 'prix-gros' }, `${calc.prix_affiche} €`),
          h('button', { class: 'mini', onclick: () => copier(String(calc.prix_affiche)) }, 'Copier')),
        h('div', {}, h('div', { class: 'muted' }, 'Visé'), h('div', { class: 'prix-gros' }, `${calc.prix_vise} €`)),
        h('div', {}, h('div', { class: 'muted' }, 'Plancher'), h('div', { class: 'prix-gros' }, `${calc.prix_plancher} €`))
      ),
      achat > 0 ? h('p', { class: calc.prix_plancher < achat ? 'alerte-texte' : '' },
        `Marge brute estimée : ${(calc.prix_vise - achat).toFixed(2)} € (au prix visé).`,
        calc.prix_plancher < achat ? ' Attention : le prix plancher est inférieur au prix d\'achat.' : '') : null
    );
  }
  prixVise.addEventListener('input', () => { p.prix_vise = Number(prixVise.value); majPrix(); sauver(); });
  prixVise.addEventListener('change', () => bPrix.marquer());
  prixAchat.addEventListener('input', () => { s.prixAchat = prixAchat.value; majPrix(); sauver(); });
  majPrix();

  const refs = (p.references_marche || []);
  const blocPrix = h('div', { class: 'card' + (estRouge(p.certitude) && !p.verifie ? ' champ-rouge' : '') },
    h('label', {}, 'Prix'),
    sortiePrix,
    h('label', {}, 'Prix visé (€)'), prixVise,
    bPrix.noeud,
    refs.length ? h('div', {}, h('p', { class: 'muted' }, 'Références du marché :'),
      h('ul', { class: 'refs' }, refs.map(r => h('li', {}, `${r.description} : ${r.prix} € `, h('span', { class: 'muted' }, `(${r.source})`)))))
      : h('p', { class: 'muted' }, 'Aucune référence de marché trouvée.'),
    h('label', {}, 'Prix d\'achat (€, si achat-revente)'), prixAchat
  );

  app.append(
    compteur,
    h('div', { class: 'card' },
      h('label', {}, 'Titre ', compteTitre), ligneCopie('Titre', titre, () => titre.value)),
    h('div', { class: 'card' },
      h('label', {}, 'Description'), desc,
      h('label', {}, 'Mesures (ajoutées à la description)'), mesures,
      h('button', { class: 'btn', onclick: () => copier(descFinale()) }, 'Copier la description')),
    h('button', { class: 'btn btn-primary', onclick: () => copier(`${titre.value}\n\n${descFinale()}`) }, 'Tout copier (titre + description)'),
    champ('Catégorie Vinted', 'categorie_vinted', CATEGORIES),
    champ('Marque', 'marque'),
    champ('Taille', 'taille'),
    champ('État', 'etat', ETATS),
    champ('Couleurs (max 2, séparées par une virgule)', 'couleurs'),
    champ('Matière', 'matiere'),
    champ('Genre', 'genre', GENRES),
    blocDefauts,
    blocPrix,
    h('div', { class: 'card' }, h('label', {}, 'Mots-clés'), h('p', {}, (a.mots_cles || []).join(', '))),
    h('p', { class: 'muted' }, `Couleurs autorisées : ${COULEURS.join(', ')}.`),
    h('button', { class: 'btn', disabled: true }, 'Retouche des photos (étape 4)'),
    a.modele_utilise ? h('p', { class: 'muted', style: 'text-align:center' }, `Analysé avec ${a.modele_utilise}`) : null,
    h('button', {
      class: 'btn btn-danger', onclick: async () => {
        if (!confirm('Relancer l\'analyse ? Tes corrections seront perdues.')) return;
        annonce.analyse = null;
        app.replaceChildren();
        await ecranAnalyse(app);
      }
    }, 'Relancer l\'analyse')
  );
  majCompteur();
}
