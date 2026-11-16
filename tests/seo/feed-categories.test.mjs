// Tuiles « Explorez par catégorie » du fil : libellés, compteurs, cache de session, intégrité des données.
// Lancer : node --test tests/seo/feed-categories.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, countLabel, ledeText, categoryForQuery, loadCategoryCounts } from '../../js/components/feed-categories.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function memoryStorage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), data };
}
const allCounts = (n = 1) => Object.fromEntries(CATEGORIES.map((c) => [c.nom, n]));

test('countLabel : inconnu, zéro, singulier, pluriel', () => {
    assert.equal(countLabel(null), '');
    assert.equal(countLabel(undefined), '');
    assert.equal(countLabel(-1), '');
    assert.equal(countLabel(0), 'À écrire');
    assert.equal(countLabel(1), '1 histoire');
    assert.equal(countLabel(12), '12 histoires');
});

test('ledeText : sans compteurs, total nul, puis total publié', () => {
    assert.match(ledeText(null), /^8 genres à explorer\./);
    assert.match(ledeText(Object.fromEntries(CATEGORIES.map((c) => [c.nom, 0]))), /^8 genres à explorer\./, 'pas de « 0 histoire publiée »');
    assert.match(ledeText({ 'Premier amour': 14, Rencontres: 9, 'Amour magique': null }), /^8 genres, 23 histoires publiées\./);
    assert.match(ledeText({ 'Amour magique': 1 }), /1 histoire publiée\./);
});

test('categoryForQuery : correspondance exacte sur la clé, insensible à la casse et aux accents', () => {
    assert.equal(categoryForQuery('premier amour')?.nom, 'Premier amour');
    assert.equal(categoryForQuery("Poésie d'amour")?.nom, "Poésie d'amour");
    assert.equal(categoryForQuery('  POESIE D\'AMOUR ')?.nom, "Poésie d'amour", 'la clé stockée porte l\'accent');
    assert.equal(categoryForQuery('amour'), null);
    assert.equal(categoryForQuery(''), null);
});

test('loadCategoryCounts : met en cache un résultat complet et le relit dans le TTL', async () => {
    const storage = memoryStorage();
    let calls = 0;
    const fetchCounts = async (noms) => { calls += 1; return Object.fromEntries(noms.map((n) => [n, 2])); };
    const first = await loadCategoryCounts(fetchCounts, { storage, now: 1_000 });
    const second = await loadCategoryCounts(fetchCounts, { storage, now: 1_000 + 9 * 60_000 });
    assert.equal(calls, 1);
    assert.deepEqual(second, first);
    await loadCategoryCounts(fetchCounts, { storage, now: 1_000 + 11 * 60_000 });
    assert.equal(calls, 2, 'cache expiré au-delà de 10 min');
});

test('loadCategoryCounts : ne met pas en cache un résultat partiel, tolère un cache illisible', async () => {
    const storage = memoryStorage({ loveInk_catCounts: '{pas du json' });
    const partial = { ...allCounts(), Rencontres: null };
    const counts = await loadCategoryCounts(async () => partial, { storage, now: 5 });
    assert.equal(counts.Rencontres, null);
    assert.equal(storage.getItem('loveInk_catCounts'), '{pas du json');
    assert.deepEqual(await loadCategoryCounts(async () => null, { storage: null }), {});
});

test('loadCategoryCounts : ignore un cache qui ne couvre pas la liste actuelle des genres', async () => {
    const stale = allCounts(3);
    delete stale["Poésie d'amour"];
    const storage = memoryStorage({ loveInk_catCounts: JSON.stringify({ at: 0, counts: { ...stale, 'Ancien genre': 2 } }) });
    let calls = 0;
    const counts = await loadCategoryCounts(async (noms) => { calls += 1; return Object.fromEntries(noms.map((n) => [n, 0])); }, { storage, now: 60_000 });
    assert.equal(calls, 1, 'cache incomplet : recompté');
    assert.equal(counts["Poésie d'amour"], 0);
});

test('données : genres uniques, chacun avec icône et visuel distinct présent', () => {
    assert.equal(new Set(CATEGORIES.map((c) => c.nom)).size, CATEGORIES.length);
    for (const c of CATEGORIES) {
        assert.ok(c.label && c.icon, `${c.nom} : libellé et icône requis`);
        assert.ok(c.image, `${c.nom} : visuel requis`);
        assert.ok(existsSync(join(ROOT, c.image)), `${c.image} absent`);
    }
    assert.equal(new Set(CATEGORIES.map((c) => c.image)).size, CATEGORIES.length, 'un visuel distinct par genre');
});

test('contrat : genres du fil = options de publier.html = clés de data/genres.json', () => {
    const decode = (v) => v.replaceAll('&#39;', "'").replaceAll('&apos;', "'").replaceAll('&amp;', '&');
    const publier = readFileSync(join(ROOT, 'publier.html'), 'utf8');
    const options = [...publier.matchAll(/<option value="([^"]+)"/g)].map((m) => decode(m[1]));
    const editorial = Object.keys(JSON.parse(readFileSync(join(ROOT, 'data/genres.json'), 'utf8'))).filter((k) => !k.startsWith('_'));
    const feed = CATEGORIES.map((c) => c.nom).sort();
    assert.equal(feed.length, 8);
    assert.deepEqual([...options].sort(), feed, 'publier.html et le fil divergent');
    assert.deepEqual([...editorial].sort(), feed, 'data/genres.json et le fil divergent');
});

test('feed.html : section, grille et ancre des histoires conservées', () => {
    const html = readFileSync(join(ROOT, 'feed.html'), 'utf8');
    for (const marker of ['id="categoriesGrid"', 'id="storiesSection"', 'id="categoriesLede"', 'css/feed-categories.css', "from './js/components/feed-categories.js'"]) {
        assert.ok(html.includes(marker), `marqueur manquant : ${marker}`);
    }
});
