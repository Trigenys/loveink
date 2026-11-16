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
    assert.match(ledeText(null), /^18 genres à explorer\./);
    assert.match(ledeText(Object.fromEntries(CATEGORIES.map((c) => [c.nom, 0]))), /^18 genres à explorer\./, 'pas de « 0 histoire publiée »');
    assert.match(ledeText({ 'Premier amour': 14, Rencontres: 9, Divers: null }), /^18 genres, 23 histoires publiées\./);
    assert.match(ledeText({ Divers: 1 }), /1 histoire publiée\./);
});

test('categoryForQuery : correspondance exacte sur la clé ou le libellé, insensible à la casse', () => {
    assert.equal(categoryForQuery('premier amour')?.nom, 'Premier amour');
    assert.equal(categoryForQuery("De l'amitié à l'amour")?.nom, "De l'amitie a l'amour");
    assert.equal(categoryForQuery('  POESIE D\'AMOUR ')?.nom, "Poesie d'amour");
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
    const partial = { ...allCounts(), Divers: null };
    const counts = await loadCategoryCounts(async () => partial, { storage, now: 5 });
    assert.equal(counts.Divers, null);
    assert.equal(storage.getItem('loveInk_catCounts'), '{pas du json');
    assert.deepEqual(await loadCategoryCounts(async () => null, { storage: null }), {});
});

test('données : 18 genres, clés uniques, icônes et visuels présents', () => {
    assert.equal(CATEGORIES.length, 18);
    assert.equal(new Set(CATEGORIES.map((c) => c.nom)).size, 18);
    for (const c of CATEGORIES) {
        assert.ok(c.label && c.icon, `${c.nom} : libellé et icône requis`);
        if (c.image) assert.ok(existsSync(join(ROOT, c.image)), `${c.image} absent`);
    }
    assert.ok(CATEGORIES.filter((c) => c.image).length >= 6);
});

test('feed.html : section, grille et ancre des histoires conservées', () => {
    const html = readFileSync(join(ROOT, 'feed.html'), 'utf8');
    for (const marker of ['id="categoriesGrid"', 'id="storiesSection"', 'id="categoriesLede"', 'css/feed-categories.css', "from './js/components/feed-categories.js'"]) {
        assert.ok(html.includes(marker), `marqueur manquant : ${marker}`);
    }
});
