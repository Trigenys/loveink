// Non-régression SEO : balises head des pages publiques, noindex des pages privées,
// robots/sitemap cohérents avec les fichiers du dépôt, JSON-LD valide.
// Lancer : node --test tests/seo/seo.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const BASE = 'https://love-ink.web.app';

const PUBLIC = { 'index.html': '/', 'login.html': '/login', 'register.html': '/register', 'conditions.html': '/conditions', 'confidentialite.html': '/confidentialite', 'candidature-modo.html': '/candidature-modo' };
const PRIVATE = ['feed.html', 'profil.html', 'messagerie.html', 'notifications.html', 'parametres.html', 'publier.html', 'mes-histoires.html', 'auth-action.html', '404.html'];

const head = (html) => html.slice(0, html.indexOf('</head>'));
const attr = (html, re) => (html.match(re) || [])[1];

for (const [file, path] of Object.entries(PUBLIC)) {
    test(`${file} : canonical, description, Open Graph`, () => {
        const h = head(read(file));
        assert.equal(attr(h, /<link rel="canonical" href="([^"]+)">/), `${BASE}${path}`);
        const desc = attr(h, /<meta name="description" content="([^"]+)">/);
        assert.ok(desc && desc.length >= 50 && desc.length <= 170, `description de ${desc?.length ?? 0} caractères`);
        for (const p of ['og:title', 'og:description', 'og:url', 'og:image']) assert.ok(h.includes(`property="${p}"`), `${p} manquant`);
        assert.ok(!/name="robots" content="[^"]*noindex/.test(h), 'page publique en noindex');
        assert.ok(/<title>[^<]{10,70}<\/title>/.test(h), 'title absent ou hors 10-70 caractères');
    });
}

for (const file of PRIVATE) {
    test(`${file} : noindex`, () => {
        assert.match(head(read(file)), /<meta name="robots" content="noindex[^"]*">/);
    });
}

test('index.html : JSON-LD valide, types attendus, FAQ visible cohérente', () => {
    const html = read('index.html');
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const types = blocks.flat().map((b) => b['@type']);
    for (const t of ['Organization', 'WebSite', 'WebApplication', 'FAQPage']) assert.ok(types.includes(t), `${t} manquant`);
    const faq = blocks.flat().find((b) => b['@type'] === 'FAQPage');
    for (const q of faq.mainEntity) assert.ok(html.includes(`<summary>${q.name}</summary>`), `question absente du HTML : ${q.name}`);
});

test('robots.txt : pages privées exclues, sitemap déclaré', () => {
    const r = read('robots.txt');
    for (const p of ['/feed', '/profil', '/messagerie', '/notifications', '/parametres', '/publier', '/mes-histoires', '/auth-action']) assert.ok(r.includes(`Disallow: ${p}\n`), `${p} non exclu`);
    assert.ok(r.includes(`Sitemap: ${BASE}/sitemap.xml`));
});

test('sitemap.xml : chaque URL correspond à un fichier du dépôt et aucune page noindex', () => {
    const locs = [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    assert.ok(locs.length >= 2);
    for (const loc of locs) {
        assert.ok(loc.startsWith(BASE + '/'), loc);
        const path = loc.slice(BASE.length);
        const file = path.endsWith('/') ? `${path}index.html` : `${path}.html`;
        assert.ok(existsSync(join(ROOT, file.slice(1))), `fichier absent pour ${loc}`);
        assert.ok(!/noindex/.test(head(read(file.slice(1)))), `${loc} est en noindex`);
    }
});

test('signature : lien Trigenys sur toutes les pages signées', () => {
    for (const f of [...Object.keys(PUBLIC).filter((f) => f !== 'candidature-modo.html'), 'feed.html', 'profil.html', 'histoire.html', 'auth-action.html', '404.html']) {
        assert.ok(read(f).includes('<a href="https://trigenys.com" rel="noopener">Trigenys Group</a>'), `${f} sans lien Trigenys`);
    }
});
