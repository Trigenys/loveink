// feed-extras.js - "A la une" et "Continuer a lire" sur feed.html.
// Ecoute "li:feed-loaded" (detail: { stories }) emis par feed.html ; rendu idempotent, blocs masques si vides.
import { firebaseAPI } from '../core/firebase-data.js';
import { listInProgress, storyHook } from '../core/reading-history.js';

const FEATURED_WINDOW_DAYS = 7;
const MAX_CONTINUE = 6;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const href = (id) => `histoire.html?id=${encodeURIComponent(id)}`;
const time = (d) => { const t = new Date(d).getTime(); return Number.isNaN(t) ? 0 : t; };
const minutes = (text) => Math.max(1, Math.round(String(text || '').trim().split(/\s+/).filter(Boolean).length / 230));

// Histoire la plus aimee parmi les recentes ; repli sur toutes les histoires chargees.
export function pickFeatured(stories, now = Date.now()) {
    const list = (stories || []).filter((s) => s && s.id && (!s.statut || s.statut === 'publie'));
    if (!list.length) return null;
    const windowMs = FEATURED_WINDOW_DAYS * 86400000;
    const recent = list.filter((s) => now - time(s.date) <= windowMs);
    const pool = recent.length ? recent : list;
    return pool.slice().sort((a, b) =>
        (Number(b.likes || 0) - Number(a.likes || 0)) ||
        (Number(b.commentaires || 0) - Number(a.commentaires || 0)) ||
        (time(b.date) - time(a.date)))[0];
}

function renderFeatured(story) {
    const box = document.getElementById('liFeatured');
    if (!box) return;
    if (!story) { box.hidden = true; box.innerHTML = ''; return; }
    if (box.dataset.storyId === story.id) { box.hidden = false; return; }
    box.dataset.storyId = story.id;
    const likes = Number(story.likes || 0);
    box.innerHTML = `
        <a class="li-featured__card" href="${href(story.id)}">
            <span class="li-featured__kicker"><span class="li-featured__eyebrow">A la une</span> · <span class="li-featured__cat">${esc(story.categorie || 'Divers')}</span></span>
            <h2 class="li-featured__title">${esc(story.titre || 'Sans titre')}</h2>
            <p class="li-featured__hook">${esc(storyHook(story.extrait || story.contenu))}</p>
            <span class="li-featured__meta">
                <span><i class="fas fa-pen-fancy" aria-hidden="true"></i> ${esc(story.auteur || 'Auteur inconnu')}</span>
                <span><i class="fas fa-book-open" aria-hidden="true"></i> ${minutes(story.contenu)} min</span>
                ${likes ? `<span><i class="fas fa-heart" aria-hidden="true"></i> ${likes}</span>` : ''}
            </span>
            <span class="li-featured__cta">Commencer la lecture <i class="fas fa-arrow-right" aria-hidden="true"></i></span>
        </a>`;
    box.hidden = false;
}

async function resolveEntries(stories) {
    const byId = new Map((stories || []).map((s) => [s.id, s]));
    const entries = listInProgress().slice(0, MAX_CONTINUE);
    const resolved = await Promise.all(entries.map(async (e) => {
        if (e.meta) return { id: e.id, ratio: e.ratio, titre: e.meta.titre, categorie: e.meta.categorie, accroche: e.meta.accroche };
        // Position enregistree avant l'ajout des metadonnees : on retrouve l'histoire.
        let s = byId.get(e.id);
        if (!s) { try { s = await firebaseAPI.getHistoireById(e.id); } catch { s = null; } }
        if (!s) return null;
        return { id: e.id, ratio: e.ratio, titre: s.titre, categorie: s.categorie, accroche: storyHook(s.contenu) };
    }));
    return resolved.filter(Boolean);
}

async function renderContinue(stories) {
    const box = document.getElementById('liContinue');
    if (!box) return;
    const entries = await resolveEntries(stories);
    if (!entries.length) { box.hidden = true; box.innerHTML = ''; return; }
    const signature = entries.map((e) => `${e.id}:${e.ratio}`).join('|');
    if (box.dataset.signature === signature) { box.hidden = false; return; }
    box.dataset.signature = signature;
    box.innerHTML = `
        <h2 class="li-continue__title">Continuer a <em>lire</em></h2>
        <div class="li-continue__row">
            ${entries.map((e) => {
                const pct = Math.round(e.ratio * 100);
                return `
                <a class="li-continue__card" href="${href(e.id)}">
                    <span class="li-continue__cat">${esc(e.categorie || 'Divers')}</span>
                    <span class="li-continue__name">${esc(e.titre || 'Sans titre')}</span>
                    <span class="li-continue__hook">${esc(e.accroche || '')}</span>
                    <span class="li-continue__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Lu a ${pct} %"><span style="--p:${pct}%"></span></span>
                    <span class="li-continue__pct">${pct} % lu</span>
                </a>`;
            }).join('')}
        </div>`;
    box.hidden = false;
}

document.addEventListener('li:feed-loaded', (event) => {
    const stories = event.detail?.stories || [];
    renderFeatured(pickFeatured(stories));
    renderContinue(stories);
});
