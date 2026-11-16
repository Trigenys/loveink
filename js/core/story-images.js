// story-images.js - Images des histoires : adaptation Love Ink du client media generique.
// Stockees dans le document histoire sous `images: [{ id, w, h, alt }]` (voir firestore.rules).
import { auth } from './firebase-config.js';
import { MEDIA_CONFIG } from './media-config.js';
import { compressToWebp, createMediaClient, MediaError, validateImages } from './media-storage.js';

let client = null;

export function getMediaClient() {
    if (!client) {
        client = createMediaClient({
            ...MEDIA_CONFIG,
            getIdToken: async (force) => (auth.currentUser ? auth.currentUser.getIdToken(Boolean(force)) : null)
        });
    }
    return client;
}

export function cleanAlt(alt) {
    return String(alt || '').replace(/\s+/g, ' ').trim().slice(0, MEDIA_CONFIG.altMaxLength);
}

// Retient uniquement les entrees conformes au schema stocke (defense en profondeur avant affichage).
export function storyImages(story) {
    const list = Array.isArray(story?.images) ? story.images : [];
    return list
        .filter((it) => it && typeof it.id === 'string' && it.id.length === 36)
        .slice(0, MEDIA_CONFIG.maxImages);
}

export function storyImageUrl(id, variant) {
    return getMediaClient().url(id, variant);
}

export function checkStoryFiles(files, { min = MEDIA_CONFIG.minImages } = {}) {
    return validateImages(files, { min, max: MEDIA_CONFIG.maxImages });
}

// Compresse puis envoie chaque image l'une apres l'autre (autorisation juste avant chaque envoi).
// En cas d'echec, les images deja envoyees sont supprimees (meilleur effort) avant de relancer l'erreur.
export async function publishStoryImages(entries, { min = MEDIA_CONFIG.minImages, onProgress } = {}) {
    const list = Array.from(entries || []).map((e) => (e && e.file ? e : { file: e, alt: '' }));
    const check = checkStoryFiles(list.map((e) => e.file), { min });
    if (!check.ok) throw new MediaError(0, 'INVALID_SELECTION', check.error);

    const media = getMediaClient();
    const done = [];
    try {
        for (let i = 0; i < list.length; i += 1) {
            onProgress?.({ index: i, total: list.length, step: 'compress' });
            const prepared = await compressToWebp(list[i].file, {
                maxDim: MEDIA_CONFIG.maxDim,
                quality: MEDIA_CONFIG.quality,
                maxBytes: MEDIA_CONFIG.maxBytes,
                variants: MEDIA_CONFIG.variants
            });
            onProgress?.({ index: i, total: list.length, step: 'upload' });
            const { id } = await media.upload({ original: prepared.blob, variants: prepared.variants });
            done.push({ id, w: prepared.width, h: prepared.height, alt: cleanAlt(list[i].alt) });
        }
    } catch (error) {
        await deleteStoryImages(done.map((d) => d.id));
        throw error;
    }
    return done;
}

// Meilleur effort : ne leve jamais, renvoie les identifiants non supprimes.
export async function deleteStoryImages(ids) {
    const unique = [...new Set((ids || []).filter(Boolean).map(String))];
    if (!unique.length) return [];
    const media = getMediaClient();
    const results = await Promise.allSettled(unique.map((id) => media.remove(id)));
    const failed = unique.filter((_, i) => results[i].status === 'rejected');
    if (failed.length) console.warn('Images non supprimees:', failed);
    return failed;
}

// Toutes ou rien du point de vue de l'appelant : la premiere erreur est relancee avec un message clair.
export async function setStoryImagesVisibility(images, visibility) {
    const ids = (images || []).map((it) => (typeof it === 'string' ? it : it?.id)).filter(Boolean);
    const media = getMediaClient();
    for (const id of ids) {
        try {
            await media.setVisibility(id, visibility);
        } catch (error) {
            const reason = error?.message || 'erreur inconnue';
            throw new MediaError(error?.status || 0, error?.code || 'VISIBILITY_FAILED',
                `Impossible de rendre les images ${visibility === 'public' ? 'publiques' : 'privees'} : ${reason}`);
        }
    }
    return ids.length;
}

const blobUrls = new Set();
let revokeWired = false;
function trackBlobUrl(src) {
    blobUrls.add(src);
    if (revokeWired) return;
    revokeWired = true;
    window.addEventListener('pagehide', () => {
        blobUrls.forEach((u) => URL.revokeObjectURL(u));
        blobUrls.clear();
    });
}

function srcsetFor(media, image) {
    const parts = MEDIA_CONFIG.variants
        .filter((size) => size < image.w)
        .map((size) => `${media.url(image.id, size)} ${size}w`);
    parts.push(`${media.url(image.id)} ${image.w}w`);
    return parts.join(', ');
}

// Galerie : publiques -> URLs directes + srcset ; privees -> URLs blob authentifiees (revoquees au pagehide).
export async function renderGallery(container, images, { isPublic = true, sizes = '(max-width: 760px) 100vw, 720px' } = {}) {
    if (!container) return 0;
    const list = storyImages({ images });
    container.replaceChildren();
    container.hidden = list.length === 0;
    if (!list.length) return 0;

    const media = getMediaClient();
    container.classList.add('story-gallery');
    container.dataset.count = String(list.length);

    const jobs = list.map(async (image, index) => {
        const figure = document.createElement('figure');
        figure.className = 'story-gallery-item';
        const img = document.createElement('img');
        img.alt = image.alt || `Illustration ${index + 1} de l'histoire`;
        if (Number.isInteger(image.w) && Number.isInteger(image.h)) {
            img.width = image.w;
            img.height = image.h;
        }
        img.loading = index === 0 ? 'eager' : 'lazy';
        img.decoding = 'async';
        figure.appendChild(img);
        container.appendChild(figure);

        try {
            if (isPublic) {
                img.srcset = srcsetFor(media, image);
                img.sizes = sizes;
                img.src = media.url(image.id, 800);
            } else {
                const src = await media.resolveSrc(image.id, { isPublic: false, variant: 800 });
                trackBlobUrl(src);
                img.src = src;
            }
            return true;
        } catch (error) {
            console.warn('Image indisponible:', image.id, error?.message || error);
            figure.remove();
            return false;
        }
    });
    const shown = (await Promise.all(jobs)).filter(Boolean).length;
    container.dataset.count = String(shown);
    if (!shown) container.hidden = true;
    return shown;
}
