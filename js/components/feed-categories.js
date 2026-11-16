// feed-categories.js - Tuiles « Explorez par catégorie » du fil (feed.html).
// Données et rendu séparés : `nom` est la valeur exacte du champ `categorie` des histoires
// (utilisée pour la recherche et le comptage) ; `label` n'est que l'affichage accentué.
// Les fonctions pures sont testées sous Node (tests/seo/feed-categories.test.mjs).

export const CATEGORIES = Object.freeze([
    { nom: 'Premier amour', icon: 'fa-heart', image: 'images/landing/cat-premier-amour.webp' },
    { nom: 'Amour des hommes illustres', icon: 'fa-crown', image: 'images/landing/cat-hommes-illustres.webp' },
    { nom: 'Amour farfelu', icon: 'fa-hat-wizard', image: 'images/landing/cat-farfelu.webp' },
    { nom: 'Amour heureux', icon: 'fa-smile', image: 'images/landing/cat-heureux.webp' },
    { nom: 'Amour magique', icon: 'fa-wand-magic-sparkles', image: 'images/landing/cat-magique.webp' },
    { nom: 'Amour virtuel', icon: 'fa-globe', image: 'images/landing/cat-distance.webp' },
    { nom: 'Aventure estivale', icon: 'fa-sun', image: 'images/landing/cat-estivale.webp' },
    { nom: 'Belles histoires', icon: 'fa-star', image: 'images/landing/cat-belles-histoires.webp' },
    { nom: "De l'amitie a l'amour", label: "De l'amitié à l'amour", icon: 'fa-handshake', image: 'images/landing/cat-amitie-amour.webp' },
    { nom: 'Histoires de couples', icon: 'fa-people-arrows', image: 'images/landing/cat-couples.webp' },
    { nom: 'Histoires tristes', icon: 'fa-cloud-rain', image: 'images/landing/cat-tristes.webp' },
    { nom: 'Interessant', label: 'Intéressant', icon: 'fa-lightbulb', image: 'images/landing/cat-interessant.webp' },
    { nom: "Lettres d'amour", icon: 'fa-envelope', image: 'images/landing/cat-lettres.webp' },
    { nom: 'Nos conseils', icon: 'fa-comment-dots', image: 'images/landing/cat-conseils.webp' },
    { nom: "Poesie d'amour", label: "Poésie d'amour", icon: 'fa-feather', image: 'images/landing/cat-poesie.webp' },
    { nom: 'Rapport occasionnel', icon: 'fa-calendar-check', image: 'images/landing/cat-occasionnel.webp' },
    { nom: 'Rencontres', icon: 'fa-user-group', image: 'images/landing/cat-seconde-chance.webp' },
    { nom: 'Divers', icon: 'fa-ellipsis', image: 'images/landing/cat-divers.webp' }
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

// Catégorie correspondant exactement à la recherche (insensible à la casse), sinon null.
export function categoryForQuery(query, categories = CATEGORIES) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return null;
    return categories.find((c) => c.nom.toLowerCase() === q || c.label.toLowerCase() === q) || null;
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

// Compteurs mis en cache de session (10 min) : 18 requêtes d'agrégation par visite sinon.
export async function loadCategoryCounts(fetchCounts, { storage = globalThis.sessionStorage, now = Date.now() } = {}) {
    try {
        const cached = JSON.parse(storage?.getItem(COUNT_CACHE_KEY) || 'null');
        if (cached && now - cached.at < COUNT_CACHE_TTL_MS && cached.counts) return cached.counts;
    } catch { /* cache illisible : on recompte */ }
    const counts = await fetchCounts(CATEGORIES.map((c) => c.nom));
    const complete = counts && CATEGORIES.every((c) => Number.isFinite(counts[c.nom]));
    if (complete) {
        try { storage?.setItem(COUNT_CACHE_KEY, JSON.stringify({ at: now, counts })); } catch { /* quota/privé */ }
    }
    return counts || {};
}
