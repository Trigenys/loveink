// Histoires en plusieurs chapitres : logique pure (sans Firebase), partagée par le wizard,
// la page de lecture, le fil et le profil. Testée par tests/seo/series.test.mjs.
//
// Modèle : chaque chapitre est un document `histoires` portant `serieId` + `chapitre` ;
// `series/{serieId}` (serieId = id de l'histoire d'origine, chapitre 1) porte titre, genre,
// couverture, statut (`en_cours` | `terminee`) et `dernierChapitre`.

export const SERIE_STATUTS = Object.freeze(['en_cours', 'terminee']);

export function chapterTitle(n) {
    return `Chapitre ${n}`;
}

export function isChapter(story) {
    return Boolean(story && typeof story.serieId === 'string' && story.serieId && Number.isInteger(story.chapitre));
}

// Chapitres triés par numéro (les trous laissés par un chapitre rejeté sont tolérés).
export function sortChapters(chapters = []) {
    return chapters
        .filter((c) => c && Number.isInteger(c.chapitre))
        .slice()
        .sort((a, b) => a.chapitre - b.chapitre);
}

// Position d'un chapitre parmi les chapitres visibles : rang (1-based) et non numéro,
// pour que le lecteur ne voie jamais de trou.
export function chapterPosition(chapters, storyId) {
    const list = sortChapters(chapters);
    const index = list.findIndex((c) => c.id === storyId);
    if (index < 0) return null;
    return {
        position: index + 1,
        total: list.length,
        prev: list[index - 1] || null,
        next: list[index + 1] || null,
        chapters: list
    };
}

export function serieStatutLabel(statut) {
    return statut === 'terminee' ? 'terminée' : 'en cours';
}

// « 3 chapitres · en cours »
export function serieBadge(count, statut) {
    const n = Math.max(0, Number(count) || 0);
    return `${n} chapitre${n > 1 ? 's' : ''} · ${serieStatutLabel(statut)}`;
}

// Fil : une seule carte par série, à la place de son chapitre le plus récent.
// L'ordre d'entrée (date décroissante) est conservé ; les histoires seules ne bougent pas.
export function collapseSeries(stories = []) {
    const seen = new Set();
    const out = [];
    for (const story of stories) {
        if (!isChapter(story)) {
            out.push(story);
            continue;
        }
        if (seen.has(story.serieId)) continue;
        seen.add(story.serieId);
        out.push(story);
    }
    return out;
}

// Choix proposés par « Un nouveau chapitre de… » : séries de l'auteur, puis ses histoires
// publiées qui ne sont pas encore en série. `prochain` = numéro du chapitre à écrire.
export function suiteChoices(stories = [], series = []) {
    const fromSeries = series
        .filter((s) => s && s.id)
        .map((s) => ({
            kind: 'serie',
            id: s.id,
            titre: String(s.titre || ''),
            genre: String(s.genre || ''),
            prochain: (Number(s.dernierChapitre) || 1) + 1,
            statut: s.statut || 'en_cours'
        }));
    const serieIds = new Set(fromSeries.map((s) => s.id));
    const fromStories = stories
        .filter((h) => h && h.id && h.statut === 'publie' && !h.serieId && !serieIds.has(h.id))
        .map((h) => ({
            kind: 'histoire',
            id: h.id,
            titre: String(h.titre || ''),
            genre: String(h.categorie || ''),
            prochain: 2,
            statut: 'en_cours'
        }));
    return [...fromSeries, ...fromStories];
}

// Écritures d'un nouveau chapitre, décrites sans Firebase (appliquées en un seul batch).
// - base : l'histoire d'origine `{ id, titre, categorie, images, auteurId, serieId? }` quand la série
//   n'existe pas encore, sinon `null` ;
// - serie : le document série existant `{ id, genre, dernierChapitre }`, sinon `null`.
// Le titre vide devient « Chapitre N » (les règles exigent un titre non vide).
export function planChapter({ base = null, serie = null, titre = '', dernier = false } = {}) {
    const statut = dernier ? 'terminee' : 'en_cours';
    if (serie) {
        const chapitre = (Number(serie.dernierChapitre) || 1) + 1;
        return {
            serieId: serie.id,
            chapitre,
            genre: String(serie.genre || ''),
            titre: String(titre || '').trim() || chapterTitle(chapitre),
            createSerie: null,
            updateSerie: { dernierChapitre: chapitre, statut },
            attachFirst: null
        };
    }
    if (!base || !base.id) throw new Error('chapitre sans histoire ni série de rattachement');
    if (base.serieId) throw new Error('cette histoire appartient déjà à une série');
    const images = Array.isArray(base.images) ? base.images : [];
    return {
        serieId: base.id,
        chapitre: 2,
        genre: String(base.categorie || ''),
        titre: String(titre || '').trim() || chapterTitle(2),
        createSerie: {
            titre: String(base.titre || ''),
            auteurId: base.auteurId,
            genre: String(base.categorie || ''),
            couverture: images.length ? images[0] : null,
            statut,
            dernierChapitre: 2
        },
        updateSerie: null,
        attachFirst: { serieId: base.id, chapitre: 1 }
    };
}

// Navigation de lecture d'un chapitre : libellé « Chapitre N sur M », sommaire, précédent/suivant
// et message de fin (« La suite arrive bientôt » tant que la série est en cours).
export function readerNav({ chapters = [], storyId, story = null, serie = null } = {}) {
    const pos = chapterPosition(chapters, storyId);
    const terminee = serie?.statut === 'terminee';
    if (!pos) {
        // Chapitre non encore publié (relecture auteur ou modération) : numéro seul.
        const n = Number.isInteger(story?.chapitre) ? story.chapitre : null;
        return n ? { label: chapterTitle(n), sommaire: [], prev: null, next: null, ending: null } : null;
    }
    return {
        label: `Chapitre ${pos.position} sur ${pos.total}`,
        sommaire: pos.chapters.map((c, i) => ({
            id: c.id,
            titre: String(c.titre || '') || chapterTitle(i + 1),
            rang: i + 1,
            current: c.id === storyId
        })),
        prev: pos.prev ? { id: pos.prev.id, titre: String(pos.prev.titre || '') } : null,
        next: pos.next ? { id: pos.next.id, titre: String(pos.next.titre || '') } : null,
        ending: pos.next ? null : (terminee ? 'Fin de la série' : 'La suite arrive bientôt')
    };
}

// Fil : une carte par série (titre et couverture de la série, extrait et lien du premier chapitre
// publié, badge « N chapitres · en cours »), à la place de son chapitre le plus récent.
// `api` est injecté ({ getSerie, getChapitresSerie }) ; en cas d'échec la carte du chapitre reste.
export async function feedEntries(stories = [], api = {}) {
    const collapsed = collapseSeries(stories);
    if (typeof api.getSerie !== 'function' || typeof api.getChapitresSerie !== 'function') return collapsed;
    return Promise.all(collapsed.map(async (story) => {
        if (!isChapter(story)) return story;
        try {
            const [serie, chapters] = await Promise.all([api.getSerie(story.serieId), api.getChapitresSerie(story.serieId)]);
            const list = sortChapters(chapters || []);
            const first = list[0] || story;
            const count = list.length || 1;
            return {
                ...story,
                id: first.id,
                titre: String(serie?.titre || first.titre || story.titre || ''),
                categorie: String(serie?.genre || story.categorie || ''),
                images: serie?.couverture ? [serie.couverture] : (first.images || story.images || []),
                extrait: first.extrait || first.contenu || story.extrait || story.contenu || '',
                serie: { id: story.serieId, count, statut: serie?.statut || 'en_cours', badge: serieBadge(count, serie?.statut) }
            };
        } catch {
            return story;
        }
    }));
}
