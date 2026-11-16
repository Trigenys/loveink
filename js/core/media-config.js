// media-config.js - Configuration produit du stockage d'images des histoires.
// La logique generique (js/core/media-storage.js) ne connait rien de Love Ink : tout passe par ici.
export const MEDIA_CONFIG = Object.freeze({
    origin: 'https://trigenys-storage-api.lawrynnjennifer.workers.dev',
    tenant: 'loveink',
    folder: 'stories',
    minImages: 1,
    maxImages: 4,
    maxDim: 1600,
    quality: 0.82,
    variants: Object.freeze([320, 800]),
    maxBytes: 1500000,
    altMaxLength: 200
});
