import { h, toast } from '../ui.js';
import { chargerAnnonce, sauverAnnonce, supprimerAnnonce, statutDe, marquerPubliee, marquerVendue, remettreEnVente } from '../state.js';
import { marge } from './historique.js';
import { icone } from '../icones.js';
import { lireReglages } from '../settings.js';
import { analyserAnnonce } from '../ai/provider.js';
import { calculerPrix } from '../prix.js';
import { utiliseIA } from '../retouche.js';
import { promptGeminiApp, envoyerAGemini, fondPourGemini, photosPourGemini } from '../gemini-app.js';
import { CATEGORIES, ETATS, GENRES } from '../data/vinted.js';
import { aller, VERSION_APP } from '../app.js';
import { ordreFournisseurs, NOMS } from '../ai/provider.js';

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
  app.replaceChildren(h('div', { class: 'card centre', style: 'margin-top:40px' }, h('div', { class: 'spinner' }), etape,
    h('p', { class: 'muted petit' }, 'Rédaction de l\'annonce, quelques secondes.')));
  try {
    annonce.analyse = await analyserAnnonce(annonce.photos, reglages, t => { etape.textContent = t; });
    annonce.saisie = { mesures: '', prixAchat: '' };
    await sauverAnnonce();
  } catch (e) {
    console.error(e);
    app.replaceChildren(
      h('div', { class: 'card alerte' }, h('strong', {}, 'L\'analyse a échoué. '), e.message),
      h('p', { class: 'muted' }, `IA configurées : ${ordreFournisseurs(reglages).map(n => NOMS[n]).join(', puis ') || 'aucune'} · version ${VERSION_APP}`),
      h('button', { class: 'btn btn-primary', onclick: async () => { app.replaceChildren(); await ecranAnalyse(app); } }, 'Réessayer'),
      h('button', { class: 'btn', onclick: () => aller('reglages') }, 'Réglages')
    );
  }
}

function relecture(app, annonce, reglages) {
  const a = annonce.analyse;
  const s = annonce.saisie ??= { mesures: '', prixAchat: '' };
  let timer;
  const sauver = () => { clearTimeout(timer); timer = setTimeout(sauverAnnonce, 400); };
  const btnCopier = f => h('button', { class: 'mini', type: 'button', 'aria-label': 'Copier', onclick: () => copier(f()) }, icone('copier', 18));

  // Compteur des champs à vérifier (le prix indicatif, sans recherche, n'est pas compté).
  const compteur = h('div', { class: 'compteur' });
  function majCompteur() {
    const champs = ['genre', 'marque', 'taille', 'categorie_vinted', 'couleurs', 'matiere', 'etat'].map(k => a[k]);
    const prix = a.prix?.sansRecherche ? [] : [a.prix];
    const n = [...champs, ...a.defauts, ...prix].filter(c => c && estRouge(c.certitude) && !c.verifie).length;
    compteur.className = 'compteur ' + (n ? 'rouge' : 'ok');
    compteur.replaceChildren(h('span', {}, n ? `${n} champ${n > 1 ? 's' : ''} à vérifier` : 'Tout est vérifié'));
  }

  // Niveau de certitude écrit en toutes lettres ; toucher = justification ; « Valider » si rouge.
  function certitude(c, ligne) {
    const el = h('button', { class: 'certitude', type: 'button' });
    const valider = h('button', { class: 'valider', type: 'button' }, 'Valider');
    const just = h('div', { class: 'justif', hidden: true }, c.justification || '');
    const maj = () => {
      const rouge = estRouge(c.certitude) && !c.verifie;
      el.className = 'certitude ' + (c.verifie ? 'verifie' : c.certitude);
      el.textContent = c.verifie ? 'Vérifié par Tom' : LIBELLES[c.certitude] || c.certitude;
      valider.hidden = !rouge;
      ligne?.classList.toggle('champ-rouge', rouge);
    };
    const marquer = () => { c.verifie = true; maj(); majCompteur(); sauverAnnonce(); };
    el.addEventListener('click', () => { just.hidden = !just.hidden; });
    valider.addEventListener('click', marquer);
    queueMicrotask(maj);
    return { noeud: h('div', {}, el, valider, just), marquer };
  }

  // Ligne « détail Vinted » : libellé, valeur modifiable, certitude, bouton copier.
  function detail(label, cle, options = null) {
    const c = a[cle];
    const val = Array.isArray(c.valeur) ? c.valeur.join(', ') : (c.valeur ?? '');
    let input;
    if (options) {
      input = h('select', {}, h('option', { value: '' }, 'À choisir'),
        options.map(o => h('option', { value: o, selected: o === c.valeur }, cle === 'categorie_vinted' ? o.replace('Hommes > ', '').replace('Vêtements > ', '') : o)));
      if (c.valeur && !options.includes(c.valeur)) input.append(h('option', { value: c.valeur, selected: true }, c.valeur));
    } else {
      input = h('input', { type: 'text', value: val, placeholder: 'Inconnu' });
    }
    const ligne = h('div', { class: 'ligne' });
    const cert = certitude(c, ligne);
    input.addEventListener('change', () => {
      c.valeur = cle === 'couleurs' ? input.value.split(',').map(x => x.trim()).filter(Boolean) : (input.value.trim() || null);
      cert.marquer();
    });
    const texteCopie = () => (cle === 'categorie_vinted' ? (input.value.split(' > ').pop() || '') : input.value);
    ligne.append(h('div', { class: 'ligne-corps' }, h('div', { class: 'ligne-label' }, label), input, cert.noeud), btnCopier(texteCopie));
    return ligne;
  }

  // Texte
  const titre = h('input', { type: 'text', value: a.titre || '', maxLength: 100 });
  const labelTitre = h('div', { class: 'ligne-label' });
  const majTitre = () => { labelTitre.textContent = `Titre · ${titre.value.length} caractères`; };
  titre.addEventListener('input', () => { a.titre = titre.value; majTitre(); sauver(); });
  majTitre();

  const desc = h('textarea', { rows: 9 });
  desc.value = a.description || '';
  desc.addEventListener('input', () => { a.description = desc.value; sauver(); });
  // Description finale : paragraphe (+ mesures), mention retouche éventuelle, puis la ligne de hashtags.
  const descFinale = () => {
    const lignes = (a.description || '').trim().split('\n');
    let hashtags = '';
    if (lignes.length > 1 && lignes[lignes.length - 1].trim().startsWith('#')) hashtags = lignes.pop().trim();
    const blocs = [lignes.join('\n').trim()];
    if (s.mesures.trim()) blocs[0] += `\nMesures : ${s.mesures.trim()}`;
    if (utiliseIA(annonce) && reglages.mentionIA?.trim()) blocs.push(reglages.mentionIA.trim());
    if (hashtags) blocs.push(hashtags);
    return blocs.filter(Boolean).join('\n\n');
  };
  const mesures = h('input', { type: 'text', value: s.mesures, placeholder: 'Longueur, aisselle à aisselle…' });
  mesures.addEventListener('input', () => { s.mesures = mesures.value; sauver(); });

  // Prix
  const p = a.prix;
  const prixVise = h('input', { type: 'number', inputMode: 'numeric', value: p.prix_vise, 'aria-label': 'Prix visé' });
  const prixAchat = h('input', { type: 'number', inputMode: 'decimal', value: s.prixAchat, placeholder: '—' });
  const sousPrix = h('div', { class: 'prix-sous' });
  const alerteAchat = h('div', { class: 'petit' });
  let affiche = 0;
  function majPrix() {
    const calc = calculerPrix(prixVise.value, reglages.margePct, reglages.plancherPct);
    affiche = calc.prix_affiche;
    sousPrix.textContent = `Affiché ${calc.prix_affiche} € · plancher ${calc.prix_plancher} €`;
    const achat = Number(prixAchat.value);
    alerteAchat.className = 'petit ' + (achat > 0 && calc.prix_plancher < achat ? 'alerte-texte' : 'muted');
    alerteAchat.textContent = achat > 0
      ? `Marge brute ${(calc.prix_vise - achat).toFixed(2)} €` + (calc.prix_plancher < achat ? ' · le plancher est sous le prix d\'achat' : '')
      : '';
  }
  const ligneVise = h('div', { class: 'ligne' });
  const certPrix = p.sansRecherche ? null : certitude(p, ligneVise);
  const largeur = () => { prixVise.style.width = `${Math.max(1, String(prixVise.value).length) + 0.15}ch`; };
  largeur();
  prixVise.addEventListener('input', () => { p.prix_vise = Number(prixVise.value); largeur(); majPrix(); sauver(); });
  prixVise.addEventListener('change', () => certPrix?.marquer());
  prixAchat.addEventListener('input', () => { s.prixAchat = prixAchat.value; majPrix(); sauver(); });
  majPrix();
  const refs = p.references_marche || [];
  ligneVise.append(
    h('div', { class: 'ligne-corps' },
      h('div', { class: 'ligne-label' }, p.sansRecherche ? 'Prix visé · estimation indicative' : 'Prix visé'),
      h('div', { class: 'prix-principal' }, prixVise, h('span', {}, '€')),
      sousPrix,
      certPrix ? certPrix.noeud : null,
      refs.length ? h('ul', { class: 'refs muted' }, refs.map(r => h('li', {}, `${r.description} : ${r.prix} € (${r.source})`))) : null),
    h('button', { class: 'mini texte', type: 'button', onclick: () => copier(String(affiche)) }, 'Copier'));

  // Défauts
  const lignesDefauts = a.defauts.length
    ? a.defauts.map(d => {
      const l = h('div', { class: 'ligne defaut' });
      l.append(h('div', { class: 'ligne-corps' }, h('p', {}, d.description, d.photo_index ? h('span', { class: 'muted' }, ` · photo ${d.photo_index}`) : null), certitude(d, l).noeud));
      return l;
    })
    : [h('div', { class: 'ligne' }, h('div', { class: 'ligne-corps muted' }, 'Aucun défaut détecté. Vérifie quand même la pièce.'))];

  // Photos : retouche via l'appli Gemini (1. prompt, 2. envoi), ou détourage dans l'appli.
  function blocPhotos() {
    const n = photosPourGemini(annonce).length;
    const fond = fondPourGemini(annonce);
    const etat = h('p', { class: 'muted petit' });
    const mention = h('input', { type: 'checkbox', class: 'switch', checked: !!annonce.retoucheGemini });
    mention.addEventListener('change', async () => { annonce.retoucheGemini = mention.checked; await sauverAnnonce(); });
    return h('div', { class: 'card' },
      h('p', { class: 'muted petit' }, n
        ? `${n} photo${n > 1 ? 's' : ''} du vêtement à retoucher dans Gemini, fond ${fond.nom.split(' (')[0].replace(' uni', '')}. Étiquettes et défauts restent réels.`
        : 'Aucune photo de face, de dos ou de profil.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', disabled: !n, onclick: () => { copier(promptGeminiApp(annonce)); etat.textContent = 'Prompt copié. Envoie maintenant les photos.'; } }, icone('copier', 18), 'Prompt'),
        h('button', { class: 'btn', disabled: !n, onclick: async () => {
          try {
            const ok = await envoyerAGemini(annonce);
            if (!ok) { etat.textContent = 'Partage indisponible ici : ajoute les photos dans Gemini à la main.'; return; }
            annonce.retoucheGemini = true; mention.checked = true;
            await sauverAnnonce();
            etat.textContent = 'Dans Gemini : colle le prompt, envoie, enregistre les images.';
          } catch (e) { etat.textContent = 'Envoi impossible : ' + e.message; }
        } }, icone('envoyer', 18), 'Photos')),
      etat,
      h('label', { class: 'interrupteur', style: 'display:flex;align-items:center;gap:12px;margin-top:10px' }, h('span', { style: 'flex:1;font-size:15px' }, 'Mention « photos retouchées » dans la description'), mention));
  }

  // Statut : en cours → publiée → vendue (avec le prix réellement encaissé).
  function blocStatut() {
    const st = statutDe(annonce);
    const date = t => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    if (st === 'en_cours') {
      return h('div', { class: 'card' },
        h('p', { class: 'muted petit' }, 'Une fois l\'annonce en ligne sur Vinted, range-la dans l\'historique.'),
        h('button', { class: 'btn', onclick: async () => { await marquerPubliee(annonce); toast('Annonce publiée'); aller(''); } },
          icone('ok', 18), 'Marquer comme publiée'));
    }
    if (st === 'publiee') {
      const prixVente = h('input', { type: 'number', inputMode: 'decimal', value: affiche || '', placeholder: 'Prix de vente', 'aria-label': 'Prix de vente' });
      return h('div', { class: 'card' },
        h('p', { class: 'muted petit' }, `En vente depuis le ${date(annonce.publieeLe)}. Une fois vendue, indique le prix réellement encaissé.`),
        h('div', { class: 'statut-prix' }, prixVente,
          h('button', { class: 'btn', style: 'width:auto;margin:0', onclick: async () => {
            if (!(Number(prixVente.value) > 0)) { toast('Indique le prix de vente'); return; }
            await marquerVendue(annonce, prixVente.value);
            toast('Vente enregistrée');
            aller('historique');
          } }, icone('ok', 18), 'Vendue')),
        h('p', { class: 'muted petit' }, 'Seule la photo de couverture, réduite, est gardée après la vente.'),
        h('button', { class: 'btn btn-lien', onclick: async () => {
          annonce.statut = 'en_cours'; delete annonce.publieeLe; await sauverAnnonce(); aller('');
        } }, 'Remettre en cours'));
    }
    const m = marge(annonce);
    return h('div', { class: 'card' },
      h('p', {}, h('strong', {}, `Vendue ${annonce.prixVente} €`), ` le ${date(annonce.vendueLe)}`),
      m !== null ? h('p', { class: 'petit ' + (m < 0 ? 'alerte-texte' : 'muted') }, `Marge brute : ${m >= 0 ? '+' : ''}${m.toFixed(2)} €`) : null,
      h('button', { class: 'btn btn-lien', onclick: async () => { await remettreEnVente(annonce); aller('historique'); } }, 'Annuler la vente'));
  }

  const urls = annonce.photos.map(ph => ph.url).filter(Boolean);
  app.append(
    urls.length ? h('div', { class: 'bande' }, urls.map(u => h('img', { src: u, alt: '' }))) : null,
    compteur,
    h('h2', {}, 'Texte'),
    h('div', { class: 'section' },
      h('div', { class: 'ligne' }, h('div', { class: 'ligne-corps' }, labelTitre, titre), btnCopier(() => titre.value)),
      h('div', { class: 'ligne', style: 'align-items:flex-start' },
        h('div', { class: 'ligne-corps' }, h('div', { class: 'ligne-label' }, 'Description'), desc), btnCopier(descFinale)),
      h('div', { class: 'ligne' }, h('div', { class: 'ligne-corps' }, h('div', { class: 'ligne-label' }, 'Mesures (ajoutées à la description)'), mesures))),
    h('button', { class: 'btn btn-primary', onclick: () => copier(`${titre.value}\n\n${descFinale()}`) }, icone('copier', 18), 'Copier titre et description'),
    h('h2', {}, 'Prix'),
    h('div', { class: 'section' }, ligneVise,
      h('div', { class: 'ligne' }, h('div', { class: 'ligne-corps' }, h('div', { class: 'ligne-label' }, 'Prix d\'achat (achat-revente)'), prixAchat, alerteAchat))),
    h('h2', {}, 'Détails Vinted'),
    h('div', { class: 'section' },
      detail('Catégorie', 'categorie_vinted', CATEGORIES),
      detail('Marque', 'marque'),
      detail('Taille', 'taille'),
      detail('État', 'etat', ETATS),
      detail('Couleurs', 'couleurs'),
      detail('Matière', 'matiere'),
      detail('Genre', 'genre', GENRES)),
    h('h2', {}, `Défauts · ${a.defauts.length}`),
    h('div', { class: 'section' }, lignesDefauts),
    h('h2', {}, 'Photos'),
    blocPhotos(),
    h('h2', {}, 'Statut'),
    blocStatut(),
    h('div', { class: 'liens-bas' },
      h('button', { onclick: () => aller('retouche') }, 'Détourer dans l\'appli'),
      h('button', { onclick: () => aller('photos') }, 'Modifier les photos'),
      h('button', { onclick: async () => {
        if (!confirm('Réécrire l\'annonce ? Tes corrections seront perdues.')) return;
        annonce.analyse = null;
        app.replaceChildren();
        await ecranAnalyse(app);
      } }, 'Réécrire l\'annonce'),
      h('button', { class: 'danger', onclick: async () => {
        if (!confirm('Supprimer cette annonce et ses photos ?')) return;
        await supprimerAnnonce(annonce.id);
        aller('');
      } }, 'Supprimer')),
    a.modele_utilise ? h('p', { class: 'muted petit centre' }, `Rédigé par ${a.modele_utilise}`) : null
  );
  majCompteur();
}
