// reading-history.js - historique de lecture local (navigateur uniquement, aucune donnee envoyee).
// Contrat conserve : loveInk_pos_<id> = ratio lu (nombre). Ajout : loveInk_lus = { <id>: meta } pour afficher
// "Continuer a lire" sans requete. Les positions anterieures sans meta restent lisibles (meta = null).

export const POS_PREFIX = 'loveInk_pos_';
const META_KEY = 'loveInk_lus';
const MAX_ENTRIES = 12;
export const MIN_RATIO = 0.05;
export const DONE_RATIO = 0.97;

function read(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* stockage indisponible */ }
}
function drop(key) {
    try { localStorage.removeItem(key); } catch { /* idem */ }
}

function excerpt(text) {
    const flat = String(text || '').replace(/\s+/g, ' ').trim();
    const first = flat.match(/^.{20,180}?[.!?…](\s|$)/);
    return (first ? first[0] : flat.slice(0, 160)).trim();
}

export function recordReading(id, story, ratio) {
    if (!id) return;
    if (ratio >= DONE_RATIO) { clearReading(id); return; }
    if (ratio < MIN_RATIO) return;
    const rounded = Math.round(ratio * 1000) / 1000;
    write(POS_PREFIX + id, rounded);
    if (!story) return;
    const meta = read(META_KEY, {});
    const prev = meta[id];
    // Idempotent : pas d'ecriture si rien de visible n'a change (ratio au pourcent pres).
    if (prev && Math.round(prev.ratio * 100) === Math.round(rounded * 100)) return;
    meta[id] = {
        titre: story.titre || 'Sans titre',
        categorie: story.categorie || 'Divers',
        auteur: story.auteur || '',
        accroche: excerpt(story.contenu),
        ratio: rounded,
        t: Date.now()
    };
    const ids = Object.keys(meta).sort((a, b) => meta[b].t - meta[a].t);
    ids.slice(MAX_ENTRIES).forEach((old) => delete meta[old]);
    write(META_KEY, meta);
}

export function clearReading(id) {
    drop(POS_PREFIX + id);
    const meta = read(META_KEY, {});
    if (meta[id]) { delete meta[id]; write(META_KEY, meta); }
}

export function readingPosition(id) {
    return Number(read(POS_PREFIX + id, 0)) || 0;
}

// Lectures en cours, les plus recentes d'abord : [{ id, ratio, meta|null }].
export function listInProgress() {
    const meta = read(META_KEY, {});
    const out = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(POS_PREFIX)) continue;
            const id = key.slice(POS_PREFIX.length);
            const ratio = readingPosition(id);
            if (ratio < MIN_RATIO || ratio >= DONE_RATIO) continue;
            out.push({ id, ratio, meta: meta[id] || null });
        }
    } catch { return []; }
    return out.sort((a, b) => (b.meta?.t || 0) - (a.meta?.t || 0));
}

export { excerpt as storyHook };
