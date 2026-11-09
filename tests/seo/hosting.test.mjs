// Non-régression de la configuration Firebase Hosting (firebase.json) : cache, en-têtes de sécurité,
// X-Robots-Tag sur les espaces privés, redirections, et pièges connus (voir docs/engineering/lessons-learned.md).
// Lancer : node --test tests/seo/hosting.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'firebase.json'), 'utf8'));
const h = cfg.hosting;
const headersFor = (source) => Object.fromEntries((h.headers.find((x) => x.source === source)?.headers || []).map((x) => [x.key, x.value]));

test('cleanUrls actif, trailingSlash non défini (sinon /histoires/ ou les URL propres cassent)', () => {
    assert.equal(h.cleanUrls, true);
    assert.equal(h.trailingSlash, undefined);
});

test('cache : images longues, css/js revalidés, HTML et fichiers SEO non mis en cache', () => {
    assert.match(headersFor('/images/**')['Cache-Control'], /max-age=604800/);
    // css/js non versionnés : sans revalidation, un déploiement sert le nouveau HTML avec l'ancien CSS.
    assert.equal(headersFor('**/*.@(css|js)')['Cache-Control'], 'no-cache');
    assert.equal(headersFor('**/!(*.*)')['Cache-Control'], 'no-cache');
    assert.match(headersFor('**/*.@(html|xml|txt)')['Cache-Control'], /no-cache/);
});

test('sécurité : en-têtes globaux conservés + CSP en Report-Only (jamais bloquante sans validation)', () => {
    const all = headersFor('**');
    for (const k of ['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy']) assert.ok(all[k], `${k} manquant`);
    assert.equal(all['Content-Security-Policy'], undefined, 'CSP bloquante interdite sans phase Report-Only validée');
    const csp = all['Content-Security-Policy-Report-Only'];
    for (const src of ['www.gstatic.com', 'firestore.googleapis.com', 'identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com', 'mail.loveink.site']) assert.ok(csp.includes(src), `${src} absent de la CSP`);
});

test('X-Robots-Tag noindex sur les espaces privés (défense en profondeur)', () => {
    for (const p of ['/feed', '/profil', '/messagerie', '/notifications', '/parametres', '/publier', '/mes-histoires', '/auth-action', '/histoire']) {
        const rule = h.headers.find((x) => x.source === p || (Array.isArray(x.source) ? false : x.source.includes(`${p.slice(1)}`)));
        assert.ok(rule && rule.headers.some((x) => x.key === 'X-Robots-Tag' && /noindex/.test(x.value)), `${p} sans X-Robots-Tag`);
    }
});

test('redirections : /histoires/genre(/) → /histoires/ en 301', () => {
    for (const src of ['/histoires/genre', '/histoires/genre/']) {
        const r = h.redirects.find((x) => x.source === src);
        assert.ok(r && r.destination === '/histoires/' && r.type === 301, `${src} non redirigé`);
    }
});

test('pièges : **/.* ignoré (donc pas de .well-known), robots bloque /feed (donc flux hors /feed)', () => {
    assert.ok(h.ignore.includes('**/.*'));
    const robots = readFileSync(join(ROOT, 'robots.txt'), 'utf8');
    assert.ok(robots.includes('Disallow: /feed\n'));
    const sitemap = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
    assert.ok(!/\/feed[./]/.test(sitemap));
    assert.ok(!/\.well-known/.test(sitemap));
});

test('sécurité CI : aucun fichier de credentials publiable, aucun secret JSON ni action à clé dans les workflows', () => {
    assert.ok(h.ignore.includes('**/gha-creds-*.json'), 'hosting.ignore doit exclure **/gha-creds-*.json (public = checkout)');
    const wf = join(ROOT, '.github', 'workflows');
    for (const f of ['firebase-deploy.yml', 'seo-refresh.yml']) {
        const y = readFileSync(join(wf, f), 'utf8');
        assert.ok(!/FirebaseExtended\/action-hosting-deploy/.test(y), `${f} utilise encore action-hosting-deploy`);
        assert.ok(!/secrets\.FIREBASE_SERVICE_ACCOUNT/.test(y), `${f} lit encore un secret JSON de compte de service`);
        assert.ok(/reusable-firebase-deploy\.yml@[0-9a-f]{40}/.test(y), `${f} doit appeler reusable-firebase-deploy épinglé par SHA`);
        assert.ok(/id-token:\s*write/.test(y), `${f} doit demander id-token: write (OIDC)`);
    }
});
