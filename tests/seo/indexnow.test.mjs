// Tests du diff de sitemap pour IndexNow : no-op sans changement, détection des nouvelles URL et des lastmod modifiés.
// Lancer : node --test tests/seo/indexnow.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { diffUrls, parseSitemap, findKey, main } from '../../scripts/indexnow.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sm = (entries) => `<?xml version="1.0"?><urlset>${entries.map(([l, d]) => `<url><loc>${l}</loc>${d ? `<lastmod>${d}</lastmod>` : ''}</url>`).join('')}</urlset>`;

test('parseSitemap : loc + lastmod optionnel', () => {
    const m = parseSitemap(sm([['https://a/', ''], ['https://a/b', '2026-01-01']]));
    assert.deepEqual([...m], [['https://a/', ''], ['https://a/b', '2026-01-01']]);
});

test('diffUrls : identique → vide ; nouvelle URL et lastmod changé → notifiés ; suppression ignorée', () => {
    const prev = sm([['https://a/', ''], ['https://a/b', '2026-01-01'], ['https://a/old', '2025-01-01']]);
    assert.deepEqual(diffUrls(prev, prev), []);
    const cur = sm([['https://a/', ''], ['https://a/b', '2026-02-01'], ['https://a/new', '2026-02-01']]);
    assert.deepEqual(diffUrls(prev, cur), ['https://a/b', 'https://a/new']);
    assert.equal(diffUrls('', cur).length, 3, 'sans ancien sitemap, tout est nouveau');
});

test('clé IndexNow : fichier <32 hex>.txt à la racine, contenu = nom, servi (pas dans hosting.ignore)', () => {
    const key = findKey(ROOT);
    assert.match(key, /^[0-9a-f]{32}$/);
    assert.equal(readFileSync(join(ROOT, `${key}.txt`), 'utf8').trim(), key);
    const ignore = JSON.parse(readFileSync(join(ROOT, 'firebase.json'), 'utf8')).hosting.ignore;
    assert.ok(!ignore.some((p) => p === '**/*.txt' || p === '*.txt'));
});

test('main : sans clé → 1 ; dry-run sur le sitemap réel sans ancien → 0 sans appel réseau', async () => {
    const noFetch = async () => { throw new Error('appel réseau interdit en test'); };
    assert.equal(await main(['--key', 'nope'], noFetch), 1);
    assert.equal(await main(['--dry-run'], noFetch), 0);
});
