// media-storage.js - Client generique du service de stockage media (Worker HTTP).
// Aucune donnee produit ici : origine, tenant, dossier et limites sont injectes par l'appelant.
// Contrat du service :
//   POST   /v1/uploads/authorize            (Bearer ID token) -> { mediaId, uploadUrl, mediaUrl, token }
//   PUT    <uploadUrl>[/w<size>]            (Bearer upload token, corps binaire)
//   GET    /v1/media/<tenant>/<id>[/w<size>]  (public, ou Bearer ID token si prive)
//   POST   /v1/media/<tenant>/<id>/visibility { visibility }
//   DELETE /v1/media/<tenant>/<id>          (204, idempotent)

export class MediaError extends Error {
    constructor(status, code, message) {
        super(message || messageForError(code, status));
        this.name = 'MediaError';
        this.status = status;
        this.code = code;
    }
}

const MESSAGES = {
    NOT_SIGNED_IN: 'Vous devez etre connecte pour envoyer des images.',
    NETWORK: "Service d'images injoignable. Verifiez votre connexion puis reessayez.",
    TOKEN_ALREADY_USED: "Autorisation d'envoi deja utilisee. Reessayez.",
    PENDING_LIMIT_REACHED: "Trop d'images en attente de moderation (20 maximum). Attendez la validation de vos histoires avant d'en ajouter d'autres.",
    TOO_LARGE: 'Image trop lourde, meme apres compression (1,5 Mo maximum).',
    DECODE_FAILED: "Format d'image non pris en charge par ce navigateur (HEIC par exemple). Utilisez une photo JPEG, PNG ou WebP.",
    WEBP_UNSUPPORTED: "Ce navigateur ne sait pas convertir les images en WebP. Mettez-le a jour ou utilisez Chrome, Edge ou Firefox."
};

export function messageForError(code, status) {
    if (code && MESSAGES[code]) return MESSAGES[code];
    if (status === 401) return 'Session expiree : reconnectez-vous puis reessayez.';
    if (status === 403 || status === 404) return 'Image introuvable ou acces refuse.';
    if (status === 413) return MESSAGES.TOO_LARGE;
    if (status === 429) return 'Trop de demandes envoyees. Patientez un instant puis reessayez.';
    return `Erreur du service d'images (${code || `HTTP ${status}`}).`;
}

// Dimensions bornees par `max` sur le plus grand cote, ratio conserve, jamais agrandies.
export function fitWithin(w, h, max) {
    const width = Math.max(1, Math.round(Number(w) || 0));
    const height = Math.max(1, Math.round(Number(h) || 0));
    const limit = Math.max(1, Math.round(Number(max) || 0));
    if (width <= limit && height <= limit) return { width, height };
    const scale = limit / Math.max(width, height);
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale))
    };
}

function normalizeVariant(variant) {
    if (variant === undefined || variant === null || variant === '') return '';
    const n = Number(String(variant).replace(/^w/i, ''));
    if (!Number.isInteger(n) || n <= 0) throw new TypeError(`Variante invalide: ${variant}`);
    return `w${n}`;
}

export function mediaPath(tenant, id, variant) {
    const v = normalizeVariant(variant);
    return `/v1/media/${encodeURIComponent(tenant)}/${encodeURIComponent(id)}${v ? `/${v}` : ''}`;
}

export function parseError(status, body) {
    let data = body;
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { data = null; }
    }
    const code = data && typeof data === 'object' && typeof data.error === 'string' && data.error
        ? data.error
        : `HTTP_${status}`;
    return { status, code };
}

// Verifie la liste choisie par l'utilisateur : nombre et type MIME image/*.
export function validateImages(list, { min = 0, max = Infinity } = {}) {
    const items = Array.isArray(list) ? list : Array.from(list || []);
    if (items.length < min) {
        return { ok: false, error: min === 1 ? 'Ajoutez au moins une image.' : `Ajoutez au moins ${min} images.` };
    }
    if (items.length > max) {
        return { ok: false, error: `${max} images maximum.` };
    }
    const invalid = items.find((f) => !f || !/^image\//i.test(String(f.type || '')));
    if (invalid) {
        return { ok: false, error: `Fichier non image refuse${invalid?.name ? ` : ${invalid.name}` : ''}.` };
    }
    return { ok: true, error: '' };
}

async function readJson(res) {
    try { return await res.json(); } catch { return null; }
}

async function toMediaError(res) {
    const { status, code } = parseError(res.status, await readJson(res));
    return new MediaError(status, code);
}

export function createMediaClient({ origin, tenant, folder, maxBytes, getIdToken, fetchImpl } = {}) {
    if (!origin || !tenant) throw new TypeError('createMediaClient: origin et tenant requis');
    if (typeof getIdToken !== 'function') throw new TypeError('createMediaClient: getIdToken requis');
    const base = String(origin).replace(/\/+$/, '');
    const doFetch = fetchImpl || ((...args) => fetch(...args));
    const abs = (path) => (/^https?:\/\//i.test(path) ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`);

    async function send(url, init) {
        try {
            return await doFetch(url, init);
        } catch {
            throw new MediaError(0, 'NETWORK');
        }
    }

    async function bearer(force) {
        const token = await getIdToken(Boolean(force));
        if (!token) throw new MediaError(401, 'NOT_SIGNED_IN');
        return `Bearer ${token}`;
    }

    // Appel authentifie par ID token ; un 401 provoque un unique nouvel essai avec un token rafraichi.
    async function withIdToken(url, init = {}) {
        const call = async (force) => send(url, { ...init, headers: { ...(init.headers || {}), Authorization: await bearer(force) } });
        const res = await call(false);
        return res.status === 401 ? call(true) : res;
    }

    function url(id, variant) {
        return `${base}${mediaPath(tenant, id, variant)}`;
    }

    async function authorize(contentType) {
        const res = await withIdToken(`${base}/v1/uploads/authorize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenant, folder, contentType, maxBytes })
        });
        if (!res.ok) throw await toMediaError(res);
        const grant = await readJson(res);
        if (!grant?.mediaId || !grant?.uploadUrl || !grant?.token) throw new MediaError(res.status, 'BAD_GRANT');
        return { ...grant, uploadUrl: abs(grant.uploadUrl), mediaUrl: grant.mediaUrl ? abs(grant.mediaUrl) : url(grant.mediaId) };
    }

    function put(target, token, blob, contentType) {
        return send(target, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
            body: blob
        });
    }

    // Autorise juste avant l'envoi (jeton valable 3 minutes), puis original et variantes.
    // Un 409 (jeton deja consomme) ou 401 (jeton expire) declenche une seule nouvelle autorisation.
    async function upload({ original, variants = {} } = {}) {
        if (!original) throw new TypeError('upload: original requis');
        const contentType = original.type || 'application/octet-stream';
        if (maxBytes && original.size > maxBytes) throw new MediaError(413, 'TOO_LARGE');

        let grant = await authorize(contentType);
        let res = await put(grant.uploadUrl, grant.token, original, contentType);
        if (res.status === 409 || res.status === 401) {
            grant = await authorize(contentType);
            res = await put(grant.uploadUrl, grant.token, original, contentType);
        }
        if (!res.ok) throw await toMediaError(res);

        const sent = [];
        for (const [size, blob] of Object.entries(variants || {})) {
            if (!blob) continue;
            try {
                const r = await put(`${grant.uploadUrl}/${normalizeVariant(size)}`, grant.token, blob, blob.type || contentType);
                if (r.ok) sent.push(Number(size));
            } catch {
                // Variante facultative : le service retombe sur l'original.
            }
        }
        return { id: grant.mediaId, url: grant.mediaUrl, variants: sent };
    }

    // Public : URL directe. Prive : telechargement authentifie puis URL blob (a revoquer par l'appelant).
    async function resolveSrc(id, { isPublic = false, variant } = {}) {
        const target = url(id, variant);
        if (isPublic) return target;
        const res = await withIdToken(target, { method: 'GET' });
        if (!res.ok) throw await toMediaError(res);
        const blob = await res.blob();
        return URL.createObjectURL(blob);
    }

    async function setVisibility(id, visibility) {
        if (!['public', 'private'].includes(visibility)) throw new TypeError(`Visibilite invalide: ${visibility}`);
        const res = await withIdToken(`${url(id)}/visibility`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visibility })
        });
        if (!res.ok) throw await toMediaError(res);
        return true;
    }

    // Idempotent : une image deja absente (404) compte comme supprimee.
    async function remove(id) {
        const res = await withIdToken(url(id), { method: 'DELETE' });
        if (res.ok || res.status === 404) return true;
        throw await toMediaError(res);
    }

    return { url, authorize, upload, resolveSrc, setVisibility, remove };
}

// ---- Navigateur uniquement : decodage + redimensionnement + encodage WebP ----

function canvasToBlob(canvas, type, quality) {
    if (typeof canvas.convertToBlob === 'function') return canvas.convertToBlob({ type, quality });
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function makeCanvas(width, height) {
    if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

async function encode(bitmap, width, height, quality) {
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, 'image/webp', quality);
    if (!blob || blob.type !== 'image/webp') throw new MediaError(0, 'WEBP_UNSUPPORTED');
    return blob;
}

// Retourne { blob, width, height, variants: { 320: Blob, 800: Blob } } ; les variantes plus larges
// que l'original sont omises (le service retombe sur l'original).
export async function compressToWebp(file, { maxDim = 1600, quality = 0.82, maxBytes = Infinity, variants = [], minQuality = 0.4 } = {}) {
    let bitmap;
    try {
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
        throw new MediaError(0, 'DECODE_FAILED');
    }
    try {
        const { width, height } = fitWithin(bitmap.width, bitmap.height, maxDim);
        let q = quality;
        let blob = await encode(bitmap, width, height, q);
        while (blob.size > maxBytes && q - 0.1 >= minQuality - 1e-9) {
            q = Math.round((q - 0.1) * 100) / 100;
            blob = await encode(bitmap, width, height, q);
        }
        if (blob.size > maxBytes) throw new MediaError(413, 'TOO_LARGE');

        const out = {};
        for (const size of variants) {
            if (size >= width) continue;
            const h = Math.max(1, Math.round(height * (size / width)));
            out[size] = await encode(bitmap, size, h, q);
        }
        return { blob, width, height, variants: out };
    } finally {
        bitmap.close?.();
    }
}
