// Historique : annonces publiées (en vente) et vendues, avec le résumé des ventes du mois.
import { h } from '../ui.js';
import { icone } from '../icones.js';
import { listerAnnonces, ouvrirAnnonce, statutDe } from '../state.js';
import { aller } from '../app.js';

let onglet = 'publiee';
const euros = n => `${Math.round(n * 100) / 100} €`.replace('.', ',');
const date = t => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

// Marge brute d'une vente (seulement si le prix d'achat a été saisi).
export const marge = a => {
  const achat = Number(a.saisie?.prixAchat);
  return achat > 0 && a.prixVente ? a.prixVente - achat : null;
};

export async function ecranHistorique(app) {
  const toutes = await listerAnnonces();
  const enVente = toutes.filter(a => statutDe(a) === 'publiee').sort((x, y) => (y.publieeLe || 0) - (x.publieeLe || 0));
  const vendues = toutes.filter(a => statutDe(a) === 'vendue').sort((x, y) => (y.vendueLe || 0) - (x.vendueLe || 0));

  const rendu = () => {
    app.replaceChildren(h('h1', { class: 'grand-titre' }, 'Historique'),
      h('div', { class: 'segments' },
        h('button', { class: onglet === 'publiee' ? 'actif' : '', onclick: () => { onglet = 'publiee'; rendu(); } }, `En vente · ${enVente.length}`),
        h('button', { class: onglet === 'vendue' ? 'actif' : '', onclick: () => { onglet = 'vendue'; rendu(); } }, `Vendues · ${vendues.length}`)));

    if (onglet === 'vendue' && vendues.length) {
      const debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0, 0, 0, 0);
      const duMois = vendues.filter(a => (a.vendueLe || 0) >= debutMois.getTime());
      const total = duMois.reduce((s, a) => s + (a.prixVente || 0), 0);
      const marges = duMois.map(marge).filter(m => m !== null);
      app.append(h('div', { class: 'card resume' },
        h('div', {}, h('div', { class: 'muted petit' }, 'Ventes ce mois'), h('strong', {}, String(duMois.length))),
        h('div', {}, h('div', { class: 'muted petit' }, 'Encaissé'), h('strong', {}, euros(total))),
        h('div', {}, h('div', { class: 'muted petit' }, 'Marge'), h('strong', {}, marges.length ? euros(marges.reduce((s, m) => s + m, 0)) : '—'))));
    }

    const liste = onglet === 'publiee' ? enVente : vendues;
    if (!liste.length) {
      app.append(h('p', { class: 'empty' }, onglet === 'publiee' ? 'Aucune annonce en vente.' : 'Aucune vente pour l\'instant.'));
      return;
    }
    const section = h('div', { class: 'section', style: 'margin-top:12px' });
    for (const a of liste) {
      const url = a.photos[0] ? URL.createObjectURL(a.photos[0].blob) : '';
      const m = marge(a);
      const sous = onglet === 'publiee'
        ? `Publiée le ${date(a.publieeLe)}`
        : `Vendue ${euros(a.prixVente || 0)} le ${date(a.vendueLe)}` + (m !== null ? ` · marge ${m >= 0 ? '+' : ''}${euros(m)}` : '');
      section.append(h('div', { class: 'annonce-item', role: 'button', onclick: async () => { await ouvrirAnnonce(a.id); aller('analyse'); } },
        url ? h('img', { src: url, alt: '' }) : h('div', { class: 'vide' }),
        h('div', { class: 'ligne-corps' },
          h('div', { class: 'titre' }, a.analyse?.titre || 'Sans titre'),
          h('div', { class: 'muted petit' + (m !== null && m < 0 ? ' alerte-texte' : '') }, sous)),
        h('span', { class: 'muted' }, icone('suite', 18))));
    }
    app.append(section);
  };
  rendu();
}
