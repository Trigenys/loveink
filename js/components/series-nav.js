// Navigation entre chapitres sur la page de lecture (histoire.html).
// Écoute `li:story-rendered` ; ne fait rien pour une histoire seule (sans serieId).
// Idempotent : chaque rendu remplace les blocs précédents, les chapitres d'une série sont mis en cache.
import { firebaseAPI } from '../core/firebase-data.js';
import { isChapter, readerNav } from '../core/series.js';

const cache = new Map();
let renderToken = 0;

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const href = (id) => `histoire.html?id=${encodeURIComponent(id)}`;

async function loadSerie(serieId) {
    if (!cache.has(serieId)) {
        const chapters = typeof firebaseAPI.getChapitresSerie === 'function'
            ? firebaseAPI.getChapitresSerie(serieId) : Promise.resolve([]);
        const serie = typeof firebaseAPI.getSerie === 'function'
            ? firebaseAPI.getSerie(serieId) : Promise.resolve(null);
        cache.set(serieId, Promise.all([chapters, serie]).catch((error) => {
            cache.delete(serieId);
            throw error;
        }));
    }
    const [chapters, serie] = await cache.get(serieId);
    return { chapters: chapters || [], serie: serie || null };
}

function headBlock(nav, serie) {
    const box = document.createElement('nav');
    box.className = 'li-chapters';
    box.setAttribute('aria-label', 'Chapitres');
    const titre = serie?.titre ? `<span class="li-chapters__serie">${esc(serie.titre)}</span>` : '';
    const sommaire = nav.sommaire.length > 1 ? `
        <details class="li-chapters__toc">
            <summary>Sommaire</summary>
            <ol>${nav.sommaire.map((c) => c.current
                ? `<li aria-current="page"><span>${esc(c.titre)}</span></li>`
                : `<li><a href="${href(c.id)}">${esc(c.titre)}</a></li>`).join('')}</ol>
        </details>` : '';
    box.innerHTML = `<p class="li-chapters__pos">${titre}<span class="li-chapters__label">${esc(nav.label)}</span></p>${sommaire}`;
    return box;
}

function footBlock(nav) {
    if (!nav.next && !nav.prev && !nav.ending) return null;
    const box = document.createElement('nav');
    box.className = 'li-chapter-next';
    box.setAttribute('aria-label', 'Chapitre suivant');
    const prev = nav.prev
        ? `<a class="li-chapter-next__prev" href="${href(nav.prev.id)}" rel="prev"><i class="fas fa-arrow-left" aria-hidden="true"></i> Chapitre précédent</a>`
        : '';
    const next = nav.next
        ? `<a class="li-chapter-next__go" href="${href(nav.next.id)}" rel="next">Chapitre suivant <i class="fas fa-arrow-right" aria-hidden="true"></i><small>${esc(nav.next.titre)}</small></a>`
        : `<p class="li-chapter-next__soon">${esc(nav.ending || '')}</p>`;
    box.innerHTML = `${next}${prev}`;
    return box;
}

async function render(story, storyId) {
    const token = ++renderToken;
    const container = document.getElementById('storyContainer');
    if (!container) return;
    container.querySelectorAll('.li-chapters, .li-chapter-next').forEach((el) => el.remove());
    if (!isChapter(story)) return;

    let data;
    try {
        data = await loadSerie(story.serieId);
    } catch (error) {
        console.warn('Chapitres indisponibles:', error?.message || error);
        data = { chapters: [], serie: null };
    }
    if (token !== renderToken) return;
    const nav = readerNav({ chapters: data.chapters, storyId, story, serie: data.serie });
    if (!nav) return;

    const header = container.querySelector('.story-header');
    const head = headBlock(nav, data.serie);
    if (header) header.after(head); else container.prepend(head);

    const foot = footBlock(nav);
    const content = container.querySelector('.story-content');
    if (foot) {
        if (content) content.after(foot); else container.appendChild(foot);
    }
    const mark = container.querySelector('.li-story-end__mark');
    if (mark && (nav.next || (nav.ending && data.serie?.statut !== 'terminee'))) mark.textContent = 'Fin du chapitre';
}

document.addEventListener('li:story-rendered', (event) => {
    const { story, storyId } = event.detail || {};
    render(story, storyId).catch((error) => console.warn('Navigation de chapitres:', error?.message || error));
});
