// Client generique du stockage media (js/core/media-storage.js) : helpers purs + flux HTTP avec un fetch simule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    createMediaClient, fitWithin, mediaPath, parseError, validateImages, MediaError, messageForError
} from '../../js/core/media-storage.js';

const ORIGIN = 'https://storage.example.test';
const ID = '11111111-2222-4333-8444-555555555555';

function res(status, body) {
    const text = body === undefined ? '' : JSON.stringify(body);
    return new Response(status === 204 ? null : text, { status, headers: { 'Content-Type': 'application/json' } });
}

// fetch simule : `routes` est une liste de reponses consommees dans l'ordre ; chaque appel est journalise.
function fakeFetch(routes) {
    const calls = [];
    const queue = [...routes];
    const fn = async (url, init = {}) => {
        calls.push({ url, method: init.method || 'GET', headers: init.headers || {}, body: init.body });
        const next = queue.shift();
        if (!next) throw new Error(`appel inattendu: ${init.method} ${url}`);
        return typeof next === 'function' ? next(url, init) : next;
    };
    fn.calls = calls;
    fn.remaining = () => queue.length;
    return fn;
}

function client(fetchImpl, tokens = { false: 'id-1', true: 'id-2' }) {
    const asked = [];
    const c = createMediaClient({
        origin: ORIGIN, tenant: 'demo', folder: 'stories', maxBytes: 1000,
        getIdToken: async (force) => { asked.push(force); return tokens[force]; },
        fetchImpl
    });
    c.asked = asked;
    return c;
}

const grant = (n = 1) => ({
    mediaId: ID, uploadUrl: `/v1/uploads/${ID}-${n}`, mediaUrl: `/v1/media/demo/${ID}`, token: `up-${n}`, visibility: 'private'
});
const webp = (size = 10) => new Blob([new Uint8Array(size)], { type: 'image/webp' });

test('fitWithin : borne le plus grand cote sans agrandir', () => {
    assert.deepEqual(fitWithin(4000, 3000, 1600), { width: 1600, height: 1200 });
    assert.deepEqual(fitWithin(3000, 4000, 1600), { width: 1200, height: 1600 });
    assert.deepEqual(fitWithin(800, 600, 1600), { width: 800, height: 600 });
    assert.deepEqual(fitWithin(1600, 1600, 1600), { width: 1600, height: 1600 });
    assert.deepEqual(fitWithin(10000, 1, 1600), { width: 1600, height: 1 });
});

test('mediaPath : chemin encode avec variante optionnelle', () => {
    assert.equal(mediaPath('demo', ID), `/v1/media/demo/${ID}`);
    assert.equal(mediaPath('demo', ID, 320), `/v1/media/demo/${ID}/w320`);
    assert.equal(mediaPath('demo', ID, 'w800'), `/v1/media/demo/${ID}/w800`);
    assert.equal(mediaPath('demo', 'a/b'), '/v1/media/demo/a%2Fb');
    assert.throws(() => mediaPath('demo', ID, 'big'), TypeError);
});

test('parseError : code du corps JSON sinon HTTP_<status>', () => {
    assert.deepEqual(parseError(429, { error: 'PENDING_LIMIT_REACHED' }), { status: 429, code: 'PENDING_LIMIT_REACHED' });
    assert.deepEqual(parseError(409, '{"error":"TOKEN_ALREADY_USED"}'), { status: 409, code: 'TOKEN_ALREADY_USED' });
    assert.deepEqual(parseError(500, 'oops'), { status: 500, code: 'HTTP_500' });
    assert.deepEqual(parseError(502, null), { status: 502, code: 'HTTP_502' });
});

test('validateImages : nombre et type', () => {
    const img = { type: 'image/jpeg', name: 'a.jpg' };
    assert.equal(validateImages([], { min: 1, max: 4 }).ok, false);
    assert.equal(validateImages([img], { min: 1, max: 4 }).ok, true);
    assert.equal(validateImages([img, img, img, img], { min: 1, max: 4 }).ok, true);
    assert.match(validateImages([img, img, img, img, img], { min: 1, max: 4 }).error, /4 images maximum/);
    assert.match(validateImages([img, { type: 'application/pdf', name: 'x.pdf' }], { max: 4 }).error, /x\.pdf/);
    assert.equal(validateImages([], { min: 0, max: 4 }).ok, true);
});

test('upload : authorize puis PUT original et variantes, URLs relatives prefixees', async () => {
    const f = fakeFetch([res(201, grant()), res(201, {}), res(201, {}), res(201, {})]);
    const c = client(f);
    const out = await c.upload({ original: webp(), variants: { 320: webp(), 800: webp() } });
    assert.equal(out.id, ID);
    assert.equal(out.url, `${ORIGIN}/v1/media/demo/${ID}`);
    assert.deepEqual(out.variants, [320, 800]);

    const [auth, put, v320, v800] = f.calls;
    assert.equal(auth.url, `${ORIGIN}/v1/uploads/authorize`);
    assert.equal(auth.method, 'POST');
    assert.equal(auth.headers.Authorization, 'Bearer id-1');
    assert.deepEqual(JSON.parse(auth.body), { tenant: 'demo', folder: 'stories', contentType: 'image/webp', maxBytes: 1000 });
    assert.equal(put.url, `${ORIGIN}/v1/uploads/${ID}-1`);
    assert.equal(put.method, 'PUT');
    assert.equal(put.headers.Authorization, 'Bearer up-1');
    assert.equal(put.headers['Content-Type'], 'image/webp');
    assert.equal(v320.url, `${ORIGIN}/v1/uploads/${ID}-1/w320`);
    assert.equal(v800.url, `${ORIGIN}/v1/uploads/${ID}-1/w800`);
    assert.equal(v800.headers.Authorization, 'Bearer up-1');
});

test('upload : echec d\'une variante non bloquant', async () => {
    const f = fakeFetch([res(201, grant()), res(201, {}), res(500, { error: 'BOOM' }), () => { throw new TypeError('reseau'); }]);
    const out = await client(f).upload({ original: webp(), variants: { 320: webp(), 800: webp() } });
    assert.equal(out.id, ID);
    assert.deepEqual(out.variants, []);
});

test('upload : 401 sur authorize -> un seul nouvel essai avec token rafraichi', async () => {
    const f = fakeFetch([res(401, { error: 'INVALID_TOKEN' }), res(201, grant()), res(201, {})]);
    const c = client(f);
    await c.upload({ original: webp() });
    assert.deepEqual(c.asked, [false, true]);
    assert.equal(f.calls[1].headers.Authorization, 'Bearer id-2');
});

test('upload : 401 persistant -> erreur claire sans boucle', async () => {
    const f = fakeFetch([res(401, { error: 'INVALID_TOKEN' }), res(401, { error: 'INVALID_TOKEN' })]);
    await assert.rejects(client(f).upload({ original: webp() }), (e) => e instanceof MediaError && e.status === 401 && /reconnectez-vous/.test(e.message));
    assert.equal(f.calls.length, 2);
});

test('upload : 409 TOKEN_ALREADY_USED -> nouvelle autorisation unique', async () => {
    const f = fakeFetch([res(201, grant(1)), res(409, { error: 'TOKEN_ALREADY_USED' }), res(201, grant(2)), res(201, {})]);
    await client(f).upload({ original: webp() });
    assert.equal(f.calls[2].url, `${ORIGIN}/v1/uploads/authorize`);
    assert.equal(f.calls[3].headers.Authorization, 'Bearer up-2');
    assert.equal(f.calls[3].url, `${ORIGIN}/v1/uploads/${ID}-2`);
});

test('upload : 409 repete -> erreur, pas de troisieme autorisation', async () => {
    const f = fakeFetch([res(201, grant(1)), res(409, { error: 'TOKEN_ALREADY_USED' }), res(201, grant(2)), res(409, { error: 'TOKEN_ALREADY_USED' })]);
    await assert.rejects(client(f).upload({ original: webp() }), (e) => e.code === 'TOKEN_ALREADY_USED');
    assert.equal(f.remaining(), 0);
    assert.equal(f.calls.length, 4);
});

test('upload : 429 PENDING_LIMIT_REACHED -> message francais explicite', async () => {
    const f = fakeFetch([res(429, { error: 'PENDING_LIMIT_REACHED' })]);
    await assert.rejects(client(f).upload({ original: webp() }), (e) => e.status === 429 && /20 maximum/.test(e.message));
});

test('upload : fichier trop lourd refuse avant tout appel reseau', async () => {
    const f = fakeFetch([]);
    await assert.rejects(client(f).upload({ original: webp(2000) }), (e) => e.code === 'TOO_LARGE');
    assert.equal(f.calls.length, 0);
});

test('upload : reseau indisponible -> MediaError NETWORK', async () => {
    const f = fakeFetch([() => { throw new TypeError('Failed to fetch'); }]);
    await assert.rejects(client(f).upload({ original: webp() }), (e) => e.code === 'NETWORK');
});

test('upload : utilisateur deconnecte -> NOT_SIGNED_IN', async () => {
    const f = fakeFetch([]);
    await assert.rejects(client(f, {}).upload({ original: webp() }), (e) => e.code === 'NOT_SIGNED_IN');
});

test('remove : 204 et 404 acceptes, 403 rejete', async () => {
    const f = fakeFetch([res(204), res(404, { error: 'NOT_FOUND' }), res(403, { error: 'FORBIDDEN' })]);
    const c = client(f);
    assert.equal(await c.remove(ID), true);
    assert.equal(await c.remove(ID), true);
    await assert.rejects(c.remove(ID), (e) => e.status === 403);
    assert.equal(f.calls[0].method, 'DELETE');
    assert.equal(f.calls[0].url, `${ORIGIN}/v1/media/demo/${ID}`);
});

test('setVisibility : POST JSON, erreur propagee', async () => {
    const f = fakeFetch([res(200, { visibility: 'public' }), res(403, { error: 'FORBIDDEN' })]);
    const c = client(f);
    assert.equal(await c.setVisibility(ID, 'public'), true);
    assert.equal(f.calls[0].url, `${ORIGIN}/v1/media/demo/${ID}/visibility`);
    assert.deepEqual(JSON.parse(f.calls[0].body), { visibility: 'public' });
    await assert.rejects(c.setVisibility(ID, 'public'), (e) => e.status === 403);
    await assert.rejects(c.setVisibility(ID, 'secret'), TypeError);
});

test('resolveSrc : public -> URL directe sans appel ; prive -> blob URL authentifiee', async () => {
    const f = fakeFetch([new Response(new Blob([new Uint8Array(4)], { type: 'image/webp' }), { status: 200 })]);
    const c = client(f);
    assert.equal(await c.resolveSrc(ID, { isPublic: true, variant: 320 }), `${ORIGIN}/v1/media/demo/${ID}/w320`);
    assert.equal(f.calls.length, 0);
    const src = await c.resolveSrc(ID, { variant: 800 });
    assert.match(src, /^blob:/);
    URL.revokeObjectURL(src);
    assert.equal(f.calls[0].url, `${ORIGIN}/v1/media/demo/${ID}/w800`);
    assert.equal(f.calls[0].headers.Authorization, 'Bearer id-1');
});

test('resolveSrc : prive inaccessible -> erreur', async () => {
    const f = fakeFetch([res(404, { error: 'NOT_FOUND' })]);
    await assert.rejects(client(f).resolveSrc(ID), (e) => e.status === 404);
});

test('messageForError : repli generique lisible', () => {
    assert.match(messageForError('WHATEVER', 500), /WHATEVER/);
    assert.match(messageForError(undefined, 503), /HTTP 503/);
});

test('createMediaClient : configuration incomplete refusee', () => {
    assert.throws(() => createMediaClient({ tenant: 'x', getIdToken: () => 't' }), TypeError);
    assert.throws(() => createMediaClient({ origin: ORIGIN, tenant: 'x' }), TypeError);
});
