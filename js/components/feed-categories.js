// feed-categories.js - Tuiles « Explorez par catégorie » du fil (feed.html).
// Données et rendu séparés : `nom` est la valeur exacte du champ `categorie` des histoires
// (utilisée pour la recherche et le comptage) ; `label` (facultatif) n'est que l'affichage.
// Contrat : la liste des `nom` est identique aux options de publier.html et aux clés de
// data/genres.json (pages /histoires/genre/*) ; le test de non-régression le vérifie.
// Les fonctions pures sont testées sous Node (tests/seo/feed-categories.test.mjs).

export const CATEGORIES = Object.freeze([
    { nom: 'Premier amour', icon: 'fa-heart', image: 'images/landing/cat-premier-amour.webp' },
    { nom: 'Rencontres', icon: 'fa-user-group', image: 'images/landing/cat-seconde-chance.webp' },
    { nom: 'Amour heureux', icon: 'fa-smile', image: 'images/landing/cat-heureux.webp' },
    { nom: 'Aventure estivale', icon: 'fa-sun', image: 'images/landing/cat-estivale.webp' },
    { nom: 'Amour magique', icon: 'fa-wand-magic-sparkles', image: 'images/landing/cat-magique.webp' },
    { nom: 'Histoires tristes', icon: 'fa-cloud-rain', image: 'images/landing/cat-tristes.webp' },
    { nom: "Lettres d'amour", icon: 'fa-envelope', image: 'images/landing/cat-lettres.webp' },
    { nom: "Poésie d'amour", icon: 'fa-feather', image: 'images/landing/cat-poesie.webp' }
].map((c) => Object.freeze({ label: c.nom, ...c })));

const COUNT_CACHE_KEY = 'loveInk_catCounts';
const COUNT_CACHE_TTL_MS = 10 * 60 * 1000;

const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

// Libellé du compteur : null/indéfini = inconnu (rien d'affiché).
export function countLabel(n) {
    if (!Number.isFinite(n) || n < 0) return '';
    if (n === 0) return 'À écrire';
    return `${n} histoire${n > 1 ? 's' : ''}`;
}

// Phrase d'introduction : total publié quand il est connu et non nul.
export function ledeText(counts, categories = CATEGORIES) {
    const values = categories.map((c) => counts?.[c.nom]).filter(Number.isFinite);
    const genres = `${categories.length} genres`;
    const total = values.reduce((a, b) => a + b, 0);
    if (!total) return `${genres} à explorer. Choisissez-en un pour filtrer les histoires.`;
    return `${genres}, ${total} histoire${total > 1 ? 's' : ''} publiée${total > 1 ? 's' : ''}. Choisissez un genre pour filtrer.`;
}

// Catégorie correspondant exactement à la recherche (insensible à la casse et aux accents), sinon null.
const fold = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

export function categoryForQuery(query, categories = CATEGORIES) {
    const q = fold(query);
    if (!q) return null;
    return categories.find((c) => fold(c.nom) === q || fold(c.label) === q) || null;
}

function tileHtml(cat) {
    const name = escapeHtml(cat.label);
    if (cat.image) {
        return `
            <img class="cat-photo" src="${escapeHtml(cat.image)}" alt="" width="320" height="400" loading="lazy" decoding="async">
            <span class="cat-shade" aria-hidden="true"></span>
            <span class="cat-text">
                <span class="cat-name">${name}</span>
                <span class="cat-count" data-count></span>
            </span>
            <span class="cat-go" aria-hidden="true"><i class="fas fa-arrow-right"></i></span>`;
    }
    return `
        <span class="cat-icon" aria-hidden="true"><i class="fas ${escapeHtml(cat.icon)}"></i></span>
        <span class="cat-text">
            <span class="cat-name">${name}</span>
            <span class="cat-count" data-count></span>
        </span>
        <span class="cat-go" aria-hidden="true"><i class="fas fa-arrow-right"></i></span>`;
}

// Rend les tuiles dans `root` : la grille illustrée (genres avec visuel) puis, s'il en reste, la liste compacte.
// `onSelect(cat)` est appelé au clic ; le lien garde l'ancre #storiesSection (sans JS, il défile).
export function renderCategoryTiles(root, { onSelect, categories = CATEGORIES } = {}) {
    root.innerHTML = '';
    const lists = {
        spot: Object.assign(document.createElement('ul'), { className: 'li-cats__spot' }),
        list: Object.assign(document.createElement('ul'), { className: 'li-cats__list' })
    };
    categories.forEach((cat, idx) => {
        const item = document.createElement('li');
        const card = document.createElement('a');
        card.href = '#storiesSection';
        card.className = `cat-card animate${cat.image ? ' cat-card--photo' : ''}`;
        card.style.animationDelay = `${Math.min(idx, 12) * 0.035}s`;
        card.dataset.categorie = cat.nom;
        card.innerHTML = tileHtml(cat);
        card.addEventListener('click', () => onSelect?.(cat));
        item.appendChild(card);
        (cat.image ? lists.spot : lists.list).appendChild(item);
    });
    root.append(...Object.values(lists).filter((ul) => ul.children.length));
}

export function applyCategoryCounts(root, counts, ledeEl) {
    root.querySelectorAll('.cat-card').forEach((card) => {
        const n = counts?.[card.dataset.categorie];
        const label = countLabel(n);
        const slot = card.querySelector('[data-count]');
        slot.textContent = label;
        card.classList.toggle('is-empty', n === 0);
        card.setAttribute('aria-label', label ? `${card.querySelector('.cat-name').textContent} — ${label}` : card.querySelector('.cat-name').textContent);
    });
    if (ledeEl) ledeEl.textContent = ledeText(counts);
}

export function markActiveCategory(root, query) {
    const active = categoryForQuery(query);
    root.querySelectorAll('.cat-card').forEach((card) => {
        if (active && card.dataset.categorie === active.nom) card.setAttribute('aria-current', 'true');
        else card.removeAttribute('aria-current');
    });
    return active;
}

// Compteurs mis en cache de session (10 min) : une requête d'agrégation par genre et par visite sinon.
// Un cache qui ne couvre pas tous les genres actuels (liste modifiée) est ignoré.
export async function loadCategoryCounts(fetchCounts, { storage = globalThis.sessionStorage, now = Date.now() } = {}) {
    try {
        const cached = JSON.parse(storage?.getItem(COUNT_CACHE_KEY) || 'null');
        const covers = cached?.counts && CATEGORIES.every((c) => Number.isFinite(cached.counts[c.nom]));
        if (covers && now - cached.at < COUNT_CACHE_TTL_MS) return cached.counts;
    } catch { /* cache illisible : on recompte */ }
    const counts = await fetchCounts(CATEGORIES.map((c) => c.nom));
    const complete = counts && CATEGORIES.every((c) => Number.isFinite(counts[c.nom]));
    if (complete) {
        try { storage?.setItem(COUNT_CACHE_KEY, JSON.stringify({ at: now, counts })); } catch { /* quota/privé */ }
    }
    return counts || {};
}
