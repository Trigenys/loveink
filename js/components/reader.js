// reader.js - mode lecture immersif (histoire.html).
// Ecoute l'evenement "li:story-rendered" emis apres chaque rendu de l'histoire ; idempotent.
import { firebaseAPI } from '../core/firebase-data.js';

const PREFS_KEY = 'loveInk_reader';
const POS_PREFIX = 'loveInk_pos_';
const WORDS_PER_MIN = 230;
const SCALES = [0.88, 1, 1.12, 1.26, 1.4];
const LEADINGS = { serre: 1.6, normal: 1.85, aere: 2.1 };
const THEMES = [
    { id: 'auto', label: 'Auto', swatch: 'linear-gradient(135deg,#fdf8f5 50%,#1b1515 50%)' },
    { id: 'rose', label: 'Rose', swatch: '#fdf8f5' },
    { id: 'sepia', label: 'Sepia', swatch: '#f4ead7' },
    { id: 'nuit', label: 'Nuit', swatch: '#1b1515' }
];

const store = {
    get(key, fallback) {
        try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* stockage indisponible : reglage non memorise */ }
    },
    remove(key) {
        try { localStorage.removeItem(key); } catch { /* idem */ }
    }
};

const prefs = Object.assign({ scale: 1, leading: 'normal', theme: 'auto', font: 'serif' }, store.get(PREFS_KEY, {}));
const page = document.querySelector('.story-page');
let storyId = null;
let story = null;
let totalMinutes = 0;
let resumeOffered = false;
let suggestionsFor = null;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function applyPrefs() {
    if (!page) return;
    const idx = Math.max(0, Math.min(SCALES.length - 1, SCALES.indexOf(prefs.scale) === -1 ? 1 : SCALES.indexOf(prefs.scale)));
    page.style.setProperty('--rd-scale', SCALES[idx]);
    page.style.setProperty('--rd-leading', LEADINGS[prefs.leading] || LEADINGS.normal);
    if (prefs.theme === 'auto') page.removeAttribute('data-reader-theme');
    else page.setAttribute('data-reader-theme', prefs.theme);
    page.setAttribute('data-reader-font', prefs.font === 'sans' ? 'sans' : 'serif');
    document.querySelectorAll('.li-reader-panel [data-pref]').forEach((btn) => {
        const [key, value] = btn.dataset.pref.split(':');
        btn.setAttribute('aria-pressed', String(String(prefs[key]) === value));
    });
}

function savePrefs() {
    store.set(PREFS_KEY, prefs);
    applyPrefs();
}

function contentEl() {
    return document.querySelector('.story-page .story-content');
}

// Progression dans le texte (0 a 1), mesuree sur le bloc de contenu et non sur toute la page.
function readingRatio() {
    const el = contentEl();
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const span = rect.height - window.innerHeight * 0.6;
    if (span <= 0) return rect.top < window.innerHeight ? 1 : 0;
    return Math.max(0, Math.min(1, (window.innerHeight * 0.4 - rect.top) / span));
}

function buildToolbar() {
    if (document.querySelector('.li-reader-bar')) return;
    const bar = document.createElement('div');
    bar.className = 'li-reader-bar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Reglages de lecture');
    bar.innerHTML = `
        <span class="li-reader-bar__left" id="liTimeLeft" aria-live="off"></span>
        <button type="button" id="liFocusBtn" aria-pressed="false" title="Mode focus" aria-label="Mode focus"><i class="fas fa-expand"></i></button>
        <button type="button" id="liAaBtn" aria-expanded="false" aria-controls="liReaderPanel" title="Reglages de lecture" aria-label="Reglages de lecture">Aa</button>`;

    const panel = document.createElement('div');
    panel.className = 'li-reader-panel';
    panel.id = 'liReaderPanel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Reglages de lecture');
    panel.innerHTML = `
        <div class="li-reader-panel__row">
            <div class="li-reader-panel__label">Taille du texte</div>
            <div class="li-seg">
                <button type="button" data-step="-1" aria-label="Reduire le texte">A-</button>
                <button type="button" data-step="1" aria-label="Agrandir le texte">A+</button>
            </div>
        </div>
        <div class="li-reader-panel__row">
            <div class="li-reader-panel__label">Interligne</div>
            <div class="li-seg">
                <button type="button" data-pref="leading:serre">Serre</button>
                <button type="button" data-pref="leading:normal">Normal</button>
                <button type="button" data-pref="leading:aere">Aere</button>
            </div>
        </div>
        <div class="li-reader-panel__row">
            <div class="li-reader-panel__label">Police</div>
            <div class="li-seg">
                <button type="button" data-pref="font:serif" style="font-family:'Cormorant Garamond',serif;font-size:1rem">Garamond</button>
                <button type="button" data-pref="font:sans" style="font-family:'DM Sans',sans-serif">Sans</button>
            </div>
        </div>
        <div class="li-reader-panel__row">
            <div class="li-reader-panel__label">Ambiance</div>
            <div class="li-seg">
                ${THEMES.map((t) => `<button type="button" data-pref="theme:${t.id}"><span class="li-swatch" style="background:${t.swatch}"></span>${t.label}</button>`).join('')}
            </div>
        </div>`;

    document.body.append(panel, bar);

    const aa = bar.querySelector('#liAaBtn');
    const togglePanel = (open) => {
        panel.hidden = !open;
        aa.setAttribute('aria-expanded', String(open));
    };
    aa.addEventListener('click', () => togglePanel(panel.hidden));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !panel.hidden) { togglePanel(false); aa.focus(); }
    });
    document.addEventListener('click', (e) => {
        if (!panel.hidden && !panel.contains(e.target) && !bar.contains(e.target)) togglePanel(false);
    });

    panel.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        if (btn.dataset.step) {
            const i = SCALES.indexOf(prefs.scale) === -1 ? 1 : SCALES.indexOf(prefs.scale);
            prefs.scale = SCALES[Math.max(0, Math.min(SCALES.length - 1, i + Number(btn.dataset.step)))];
        } else if (btn.dataset.pref) {
            const [key, value] = btn.dataset.pref.split(':');
            prefs[key] = value;
        }
        savePrefs();
    });

    const focusBtn = bar.querySelector('#liFocusBtn');
    const setFocus = (on) => {
        document.documentElement.classList.toggle('li-focus', on);
        focusBtn.setAttribute('aria-pressed', String(on));
        focusBtn.innerHTML = on ? '<i class="fas fa-compress"></i>' : '<i class="fas fa-expand"></i>';
        const fs = document.fullscreenElement;
        if (on && !fs && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
        if (!on && fs && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    };
    focusBtn.addEventListener('click', () => setFocus(!document.documentElement.classList.contains('li-focus')));
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && document.documentElement.classList.contains('li-focus')) setFocus(false);
    });

    applyPrefs();
}

function decorateContent() {
    const el = contentEl();
    if (!el) return;
    el.querySelectorAll('p').forEach((p) => {
        if (/^\s*([*~#•·-]\s*){3,}$/.test(p.textContent) || /^\s*[❦❧✻]\s*$/.test(p.textContent)) {
            p.classList.add('li-scene');
            p.textContent = '❦';
            p.setAttribute('aria-hidden', 'true');
        }
    });

    const words = (el.textContent || '').trim().split(/\s+/).filter(Boolean).length;
    totalMinutes = Math.max(1, Math.round(words / WORDS_PER_MIN));
    const meta = document.querySelector('.story-page .story-meta');
    if (meta && !meta.querySelector('.li-readtime')) {
        const span = document.createElement('span');
        span.className = 'li-readtime';
        span.innerHTML = `<i class="fas fa-book-open"></i> ${totalMinutes} min de lecture`;
        meta.appendChild(span);
    }
}

function updateProgress() {
    const ratio = readingRatio();
    const left = document.getElementById('liTimeLeft');
    if (left) {
        const mins = Math.ceil(totalMinutes * (1 - ratio));
        left.textContent = ratio >= 0.98 ? 'Termine' : `Environ ${mins} min restantes`;
    }
    if (!storyId) return;
    if (ratio >= 0.97) store.remove(POS_PREFIX + storyId);
    else if (ratio > 0.04) store.set(POS_PREFIX + storyId, Math.round(ratio * 1000) / 1000);
}

function offerResume() {
    if (resumeOffered || !storyId) return;
    resumeOffered = true;
    const saved = Number(store.get(POS_PREFIX + storyId, 0));
    if (!(saved > 0.05 && saved < 0.97)) return;
    const box = document.createElement('div');
    box.className = 'li-resume';
    box.setAttribute('role', 'status');
    box.innerHTML = `<span>Vous en etiez a ${Math.round(saved * 100)} %</span>
        <button type="button" class="li-resume__go">Reprendre</button>
        <button type="button" class="li-resume__close" aria-label="Ignorer">Ignorer</button>`;
    document.body.appendChild(box);
    const close = () => box.remove();
    box.querySelector('.li-resume__close').addEventListener('click', close);
    box.querySelector('.li-resume__go').addEventListener('click', () => {
        const el = contentEl();
        if (el) {
            const rect = el.getBoundingClientRect();
            const span = rect.height - window.innerHeight * 0.6;
            const target = window.scrollY + rect.top - window.innerHeight * 0.4 + saved * span;
            const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            window.scrollTo({ top: Math.max(0, target), behavior: smooth ? 'smooth' : 'auto' });
        }
        close();
    });
    setTimeout(close, 12000);
}

async function renderStoryEnd() {
    const container = document.getElementById('storyContainer');
    if (!container || !story) return;
    let end = container.querySelector('.li-story-end');
    if (!end) {
        end = document.createElement('section');
        end.className = 'li-story-end';
        end.setAttribute('aria-label', "Fin de l'histoire");
        end.innerHTML = `<div class="li-story-end__mark">Fin</div>
            <p class="li-story-end__lead">Si cette histoire vous a touche, dites-le a son auteur.</p>
            <div class="li-suggest" id="liSuggest"></div>`;
        container.appendChild(end);
    }
    const grid = end.querySelector('#liSuggest');
    if (suggestionsFor === storyId && grid.dataset.html) { grid.innerHTML = grid.dataset.html; return; }
    suggestionsFor = storyId;
    try {
        const result = await firebaseAPI.getHistoires(1, 24);
        const others = (result?.histoires || []).filter((h) => h.id !== storyId);
        const same = others.filter((h) => h.categorie && h.categorie === story.categorie);
        const picks = [...same, ...others.filter((h) => !same.includes(h))].slice(0, 3);
        if (!picks.length) return;
        const html = `<p class="li-story-end__lead" style="grid-column:1/-1;margin:0 0 4px;text-align:center">A lire ensuite</p>` +
            picks.map((h) => {
                const hook = String(h.contenu || '').replace(/\s+/g, ' ').trim().slice(0, 160);
                return `<a href="histoire.html?id=${encodeURIComponent(h.id)}">
                    <div class="li-suggest__cat">${esc(h.categorie || 'Histoire')}</div>
                    <div class="li-suggest__title">${esc(h.titre || 'Sans titre')}</div>
                    <div class="li-suggest__hook">${esc(hook)}</div></a>`;
            }).join('');
        grid.dataset.html = html;
        grid.innerHTML = html;
    } catch (error) {
        console.warn('Suggestions indisponibles:', error);
    }
}

let ticking = false;
window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; updateProgress(); });
}, { passive: true });

document.addEventListener('li:story-rendered', (event) => {
    story = event.detail?.story || null;
    storyId = event.detail?.storyId || null;
    if (!story) return;
    buildToolbar();
    decorateContent();
    updateProgress();
    offerResume();
    renderStoryEnd();
});
