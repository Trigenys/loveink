// Simulation du service de stockage media : aucun envoi reel d'image pendant les tests e2e.
const { randomUUID } = require('node:crypto');

const MEDIA_ORIGIN = 'https://trigenys-storage-api.lawrynnjennifer.workers.dev';

// PNG 1x1 valide, suffisant pour createImageBitmap + encodage WebP dans Chromium.
const TINY_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    'base64'
);

async function mockMediaStorage(page) {
    const calls = [];
    await page.route(`${MEDIA_ORIGIN}/**`, async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        calls.push({ method: request.method(), path: url.pathname });
        const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
        if (request.method() === 'POST' && url.pathname === '/v1/uploads/authorize') {
            const id = randomUUID();
            return route.fulfill({
                status: 201,
                headers: cors,
                contentType: 'application/json',
                body: JSON.stringify({ mediaId: id, uploadUrl: `/v1/uploads/${id}`, mediaUrl: `/v1/media/loveink/${id}`, token: 'mock', visibility: 'private' })
            });
        }
        if (request.method() === 'PUT') return route.fulfill({ status: 201, headers: cors, contentType: 'application/json', body: '{}' });
        if (request.method() === 'DELETE') return route.fulfill({ status: 204, headers: cors });
        if (request.method() === 'GET') return route.fulfill({ status: 200, headers: cors, contentType: 'image/png', body: TINY_PNG });
        return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '{}' });
    });
    return calls;
}

function tinyImageFile(name = 'photo-e2e.png') {
    return { name, mimeType: 'image/png', buffer: TINY_PNG };
}

module.exports = { MEDIA_ORIGIN, mockMediaStorage, tinyImageFile };
