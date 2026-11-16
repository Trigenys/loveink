// publish-wizard.js - Parcours « Écrire une histoire » en étapes (publier.html).
// Deux couches : des fonctions pures (validation, brouillon, comptages, raccourcis clavier),
// testées sous Node (tests/seo/publish-wizard.test.mjs), et un contrôleur DOM `mountPublishWizard`
// qui ne connaît ni Firebase ni le stockage d'images : la page lui fournit l'état et le rendu d'aperçu.

export const STEPS = Object.freeze([
    Object.freeze({ id: 'categorie', label: 'Genre' }),
    Object.freeze({ id: 'titre', label: 'Titre' }),
    Object.freeze({ id: 'texte', label: 'Texte' }),
    Object.freeze({ id: 'images', label: 'Images' }),
    Object.freeze({ id: 'apercu', label: 'Aperçu' })
]);

// Limites alignées sur firestore.rules (histoires) : ne jamais laisser saisir plus que ce que la règle accepte.
export const LIMITS = Object.freeze({ titre: 140, categorie: 80, contenu: 200000 });

const WORDS_PER_MINUTE = 230;
const DRAFT_PREFIX = 'loveInk_publishDraft:';
const DRAFT_VERSION = 1;
const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function countWords(text) {
    const words = String(text || '').trim().match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
    return words ? words.length : 0;
}

export function readingMinutes(text) {
    const words = countWords(text);
    return words ? Math.max(1, Math.round(words / WORDS_PER_MINUTE)) : 0;
}

export function textStats(text) {
    const value = String(text || '');
    const words = countWords(value);
    const minutes = readingMinutes(value);
    const chars = value.length;
    const parts = [
        `${words} mot${words > 1 ? 's' : ''}`,
        `${chars} caractère${chars > 1 ? 's' : ''}`
    ];
    if (minutes) parts.push(`≈ ${minutes} min de lecture`);
    return { words, chars, minutes, label: parts.join(' · ') };
}

// Même découpage que histoire.html (renderStoryContent) : paragraphes sur ligne vide, lignes conservées.
export function storyParagraphs(text) {
    const value = String(text || '').trim();
    if (!value) return [];
    return value.split(/\n{2,}/).map((p) => p.split('\n'));
}

// Validation d'une étape. `state` = { categorie, titre, contenu, imagesCount } ; `minImages` = 0 en modération
// et à partir du chapitre 2 ; `titreOptional` : titre vide accepté (un chapitre devient « Chapitre N »).
export function validateStep(stepId, state = {}, { minImages = 1, titreOptional = false } = {}) {
    const ok = { ok: true, error: '' };
    switch (stepId) {
    case 'categorie':
        return String(state.categorie || '').trim() ? ok : { ok: false, error: 'Choisissez le genre de votre histoire.' };
    case 'titre': {
        const titre = String(state.titre || '').trim();
        if (!titre) return titreOptional ? ok : { ok: false, error: 'Donnez un titre à votre histoire.' };
        if (titre.length > LIMITS.titre) return { ok: false, error: `Le titre dépasse ${LIMITS.titre} caractères.` };
        return ok;
    }
    case 'texte': {
        const contenu = String(state.contenu || '').trim();
        if (!contenu) return { ok: false, error: 'Écrivez votre histoire avant de continuer.' };
        if (contenu.length > LIMITS.contenu) return { ok: false, error: 'Votre histoire est trop longue pour être publiée en une fois.' };
        return ok;
    }
    case 'images': {
        const n = Number(state.imagesCount) || 0;
        if (n < minImages) return { ok: false, error: `Ajoutez au moins ${minImages} image${minImages > 1 ? 's' : ''}.` };
        return ok;
    }
    default:
        return ok;
    }
}

// Index de la première étape invalide avant `upTo` (exclu), ou -1 si tout est valide.
// `options.skip` : identifiants d'étapes sautées (ex. le genre, hérité pour un chapitre), jamais validées.
export function firstInvalidStep(state, options, upTo = STEPS.length) {
    const skip = new Set(options?.skip || []);
    for (let i = 0; i < Math.min(upTo, STEPS.length); i += 1) {
        if (skip.has(STEPS[i].id)) continue;
        if (!validateStep(STEPS[i].id, state, options).ok) return i;
    }
    return -1;
}

// ---------- Brouillon local (texte seulement : un fichier image ne se sérialise pas) ----------

export function draftKey(uid) {
    const id = String(uid || '').trim();
    return id ? `${DRAFT_PREFIX}${id}` : '';
}

// `suite` (optionnel) : id de la série ou de l'histoire dont le brouillon est le chapitre suivant.
// Absent pour une histoire seule : le format v1 reste identique pour les brouillons existants.
const SUITE_MAX = 128;

export function serializeDraft(state = {}, step = 0, now = Date.now()) {
    const suite = String(state.suite || '').slice(0, SUITE_MAX);
    return JSON.stringify({
        v: DRAFT_VERSION,
        ...(suite ? { suite } : {}),
        categorie: String(state.categorie || '').slice(0, LIMITS.categorie),
        titre: String(state.titre || '').slice(0, LIMITS.titre),
        contenu: String(state.contenu || '').slice(0, LIMITS.contenu),
        step: Math.max(0, Math.min(STEPS.length - 1, Number(step) || 0)),
        savedAt: now
    });
}

// Renvoie un brouillon exploitable ou null (illisible, autre version, vide ou trop ancien).
export function parseDraft(raw, now = Date.now()) {
    if (!raw) return null;
    let data;
    try { data = JSON.parse(raw); } catch { return null; }
    if (!data || typeof data !== 'object' || data.v !== DRAFT_VERSION) return null;
    const savedAt = Number(data.savedAt);
    if (!Number.isFinite(savedAt) || now - savedAt > DRAFT_MAX_AGE_MS) return null;
    const draft = {
        categorie: typeof data.categorie === 'string' ? data.categorie.slice(0, LIMITS.categorie) : '',
        titre: typeof data.titre === 'string' ? data.titre.slice(0, LIMITS.titre) : '',
        contenu: typeof data.contenu === 'string' ? data.contenu.slice(0, LIMITS.contenu) : '',
        step: Math.max(0, Math.min(STEPS.length - 1, Math.trunc(Number(data.step) || 0))),
        savedAt
    };
    if (typeof data.suite === 'string' && data.suite) draft.suite = data.suite.slice(0, SUITE_MAX);
    return draft.categorie || draft.titre.trim() || draft.contenu.trim() ? draft : null;
}

// Accès au stockage toujours protégé : navigation privée ou stockage bloqué ne doivent rien casser.
export function loadDraft(storage, uid, now) {
    const key = draftKey(uid);
    if (!key || !storage) return null;
    try { return parseDraft(storage.getItem(key), now); } catch { return null; }
}

export function saveDraft(storage, uid, state, step, now) {
    const key = draftKey(uid);
    if (!key || !storage) return false;
    try {
        if (!String(state?.categorie || '') && !String(state?.titre || '').trim() && !String(state?.contenu || '').trim()) {
            storage.removeItem(key);
            return true;
        }
        storage.setItem(key, serializeDraft(state, step, now));
        return true;
    } catch { return false; }
}

export function clearDraft(storage, uid) {
    const key = draftKey(uid);
    if (!key || !storage) return;
    try { storage.removeItem(key); } catch { /* stockage indisponible : rien à effacer */ }
}

// ---------- Clavier ----------
// Entrée dans un champ d'une ligne ou sur un genre = suivant ; Ctrl/⌘+Entrée partout = suivant ;
// Ctrl/⌘+Maj+Entrée = précédent. Entrée seule dans le texte garde son rôle (nouvelle ligne).
export function keyIntent({ key, ctrlKey = false, metaKey = false, shiftKey = false, altKey = false, isComposing = false } = {}, target = 'other') {
    if (key !== 'Enter' || altKey || isComposing) return null;
    const mod = ctrlKey || metaKey;
    if (mod) return shiftKey ? 'prev' : 'next';
    if (shiftKey) return null;
    return target === 'field' || target === 'choice' ? 'next' : null;
}

// ---------- Contrôleur DOM ----------

function prefersReducedMotion() {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// root : conteneur du parcours. Attendus dans root :
//   [data-step="<id>"] (une section par étape, dans l'ordre de STEPS), [data-goto="<index>"] (repères),
//   [data-wizard-prev], [data-wizard-next], [data-wizard-final] (zone d'envoi), [data-wizard-fill],
//   [data-wizard-announce] (aria-live), [data-step-error] dans chaque section.
// options : getState() -> état ; validationOptions() -> { minImages, titreOptional, skip } ; onEnter(stepId) ; onChange(index).
// Les étapes de `skip` ne sont ni affichées, ni validées, ni comptées (repères, « Étape X sur N », progression).
export function mountPublishWizard(root, { getState, validationOptions = () => ({}), onEnter, onChange } = {}) {
    const sections = STEPS.map((s) => root.querySelector(`[data-step="${s.id}"]`));
    const markers = Array.from(root.querySelectorAll('[data-goto]'));
    const prevBtn = root.querySelector('[data-wizard-prev]');
    const nextBtn = root.querySelector('[data-wizard-next]');
    const finalZone = root.querySelector('[data-wizard-final]');
    const fill = root.querySelector('[data-wizard-fill]');
    const announce = root.querySelector('[data-wizard-announce]');
    const last = STEPS.length - 1;
    let current = 0;
    let furthest = 0;

    const errorBox = (index) => sections[index]?.querySelector('[data-step-error]');
    const skipped = () => new Set(validationOptions()?.skip || []);
    const clamp = (i) => Math.max(0, Math.min(last, i));
    const visible = () => { const skip = skipped(); return STEPS.map((s, i) => i).filter((i) => !skip.has(STEPS[i].id)); };

    // Étape affichable la plus proche dans le sens du déplacement (sinon dans l'autre sens).
    function resolve(index, direction) {
        const skip = skipped();
        const isSkipped = (i) => skip.has(STEPS[i].id);
        const step = direction === 'back' ? -1 : 1;
        for (const dir of [step, -step]) {
            for (let i = clamp(index); i >= 0 && i <= last; i += dir) if (!isSkipped(i)) return i;
        }
        return clamp(index);
    }

    function showError(index, message) {
        const box = errorBox(index);
        if (!box) return;
        box.textContent = message || '';
        box.hidden = !message;
    }

    function render() {
        const shown = visible();
        const rank = (i) => shown.indexOf(i) + 1;
        sections.forEach((section, i) => {
            if (!section) return;
            section.hidden = i !== current;
            const kicker = section.querySelector('.li-step__kicker');
            if (kicker && rank(i)) kicker.textContent = `Étape ${rank(i)} sur ${shown.length}`;
        });
        markers.forEach((marker) => {
            const i = Number(marker.dataset.goto);
            const item = marker.closest('li') || marker;
            item.hidden = !rank(i);
            const num = marker.querySelector('.li-steps__num span');
            if (num && rank(i)) num.textContent = String(rank(i));
            marker.classList.toggle('is-done', i < current);
            marker.classList.toggle('is-current', i === current);
            marker.disabled = i > furthest;
            if (i === current) marker.setAttribute('aria-current', 'step');
            else marker.removeAttribute('aria-current');
        });
        if (fill) fill.style.setProperty('--progress', String(shown.length > 1 ? (rank(current) - 1) / (shown.length - 1) : 1));
        root.style.setProperty('--li-step', String(current));
        root.dataset.currentStep = STEPS[current].id;
        if (prevBtn) prevBtn.hidden = current === shown[0];
        if (nextBtn) nextBtn.hidden = current === last;
        if (finalZone) finalZone.hidden = current !== last;
    }

    function go(index, { direction = index >= current ? 'forward' : 'back', focus = true } = {}) {
        const target = resolve(index, direction);
        if (target > current) {
            // On ne saute jamais une étape invalide : on s'arrête sur la première à corriger.
            const invalid = firstInvalidStep(getState(), validationOptions(), target);
            if (invalid !== -1 && invalid < target) {
                if (invalid !== current) go(invalid, { direction: 'back' });
                const result = validateStep(STEPS[invalid].id, getState(), validationOptions());
                showError(invalid, result.error);
                focusField(invalid);
                return false;
            }
        }
        showError(current, '');
        current = target;
        furthest = Math.max(furthest, current);
        const section = sections[current];
        render();
        if (section && !prefersReducedMotion()) {
            section.classList.remove('is-entering-forward', 'is-entering-back');
            void section.offsetWidth; // relance l'animation d'entrée
            section.classList.add(direction === 'back' ? 'is-entering-back' : 'is-entering-forward');
        }
        onEnter?.(STEPS[current].id);
        onChange?.(current);
        if (announce) {
            const shown = visible();
            announce.textContent = `Étape ${shown.indexOf(current) + 1} sur ${shown.length} : ${STEPS[current].label}`;
        }
        if (focus) {
            const top = root.getBoundingClientRect().top;
            if (top < 0) root.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
            focusField(current);
        }
        return true;
    }

    function focusField(index) {
        const section = sections[index];
        if (!section) return;
        const field = section.querySelector('[data-autofocus]:not([disabled])')
            || section.querySelector('input[type="radio"]:checked')
            || section.querySelector('h2[tabindex]');
        field?.focus({ preventScroll: true });
    }

    function next() { return go(current + 1, { direction: 'forward' }); }
    function prev() { return go(current - 1, { direction: 'back' }); }

    prevBtn?.addEventListener('click', prev);
    nextBtn?.addEventListener('click', next);
    markers.forEach((marker) => marker.addEventListener('click', () => go(Number(marker.dataset.goto))));

    sections.forEach((section) => {
        section?.addEventListener('animationend', () => section.classList.remove('is-entering-forward', 'is-entering-back'));
    });

    root.addEventListener('keydown', (event) => {
        const el = event.target;
        let target = 'other';
        if (el instanceof HTMLInputElement) {
            if (el.type === 'radio') target = 'choice';
            else if (['text', 'search', 'url', 'email'].includes(el.type)) target = 'field';
        }
        const intent = keyIntent(event, target);
        if (!intent) return;
        if (intent === 'next' && current === last) return;
        event.preventDefault();
        if (intent === 'next') next(); else prev();
    });

    // Effacer le message d'erreur dès que l'utilisateur corrige.
    root.addEventListener('input', () => showError(current, ''));
    root.addEventListener('change', () => showError(current, ''));

    render();
    return {
        get current() { return current; },
        get isLast() { return current === last; },
        go,
        next,
        prev,
        // Après restauration d'un brouillon : repères accessibles jusqu'à l'étape atteinte.
        reach(index) { furthest = Math.max(furthest, Math.min(last, index)); render(); },
        // Après un changement des étapes sautées (ex. choix « nouveau chapitre ») : quitter une étape
        // devenue sautée et redessiner repères et compteurs.
        refresh() {
            if (skipped().has(STEPS[current].id)) {
                current = resolve(current, 'forward');
                furthest = Math.max(furthest, current);
            }
            render();
            onChange?.(current);
        },
        showError
    };
}
