// Pages statiques des histoires en chapitres : rel prev/next, position, page de série, sitemap.
// Fixture séparée : les compteurs des autres tests du générateur restent inchangés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, normalize, storyPath, seriePath, groupSeries, OWNED_DIRS, main } from '../../scripts/build-seo-pages.mjs';

const BASE = 'https://loveink.test';
const TEXT = 'Un paragraphe qui raconte une rencontre au bord de la mer. '.repeat(20);
const raw = [
    { id: 's1', serieId: 's1', chapitre: 1, titre: 'Nos étés', categorie: 'Rencontres', auteur: 'Plume', auteurId: 'u1', contenu: TEXT, date: '2026-07-01T10:00:00Z' },
    { id: 's1c2', serieId: 's1', chapitre: 2, titre: 'Chapitre 2', categorie: 'Rencontres', auteur: 'Plume', auteurId: 'u1', contenu: TEXT, date: '2026-07-08T10:00:00Z' },
    // Chapitre 3 rejeté (absent) : le 4 devient la 3e position, sans trou visible.
    { id: 's1c4', serieId: 's1', chapitre: 4, titre: 'Le retour', categorie: 'Rencontres', auteur: 'Plume', auteurId: 'u1', contenu: TEXT, date: '2026-07-22T10:00:00Z' },
    // Série d'un seul chapitre publié : reste une histoire ordinaire.
    { id: 'lone', serieId: 'lone', chapitre: 1, titre: 'Seule', categorie: 'Amour heureux', auteur: 'Lou', auteurId: 'u2', contenu: TEXT, date: '2026-07-05T10:00:00Z' },
    { id: 'solo', titre: 'Le quai de la gare', categorie: 'Amour heureux', auteur: 'Lou', auteurId: 'u2', contenu: TEXT, date: '2026-07-03T10:00:00Z' },
];
const stories = raw.map((s) => normalize(s, s.id));
const SERIES = [{ id: 's1', titre: 'Nos étés', genre: 'Rencontres', statut: 'en_cours' }, { id: 'lone', titre: 'Seule', genre: 'Amour heureux', statut: 'en_cours' }];
const out = build(stories, { base: BASE, series: SERIES, year: 2026 });
const pageOf = (id) => out.files.get(`${storyPath(stories.find((s) => s.id === id)).slice(1)}.html`);
const jsonLd = (html) => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

test('groupSeries : séries de 2 chapitres publiés ou plus, triées, sans trou', () => {
    const groups = groupSeries(stories, SERIES);
    assert.deepEqual([...groups.keys()], ['s1']);
    assert.deepEqual(groups.get('s1').chapters.map((c) => c.id), ['s1', 's1c2', 's1c4']);
    assert.equal(groups.get('s1').path, '/histoires/serie/nos-etes-s1');
    assert.equal(seriePath({ id: 'x', titre: 'Été à Paris !' }), '/histoires/serie/ete-a-paris-x');
});

test('page de chapitre : position, lien vers la série, rel prev/next (head et corps)', () => {
    const mid = pageOf('s1c2');
    assert.match(mid, /<h1>Nos étés – Chapitre 2<\/h1>/);
    assert.match(mid, /Chapitre 2 sur 3 · <a href="\/histoires\/serie\/nos-etes-s1">Nos étés<\/a>/);
    assert.ok(mid.includes(`<link rel="prev" href="${BASE}${storyPath(stories[0])}">`));
    assert.ok(mid.includes(`<link rel="next" href="${BASE}${storyPath(stories[2])}">`));
    assert.match(mid, /<a rel="next" href="[^"]+">Chapitre 4 : Le retour →<\/a>/);
    assert.match(mid, /<title>Nos étés – Chapitre 2/);

    const first = pageOf('s1');
    assert.ok(!first.includes('rel="prev"'));
    assert.match(first, /<h1>Nos étés – Chapitre 1<\/h1>/);
    const last = pageOf('s1c4');
    assert.ok(!last.includes('<link rel="next"'));
    assert.match(last, /<span>La suite arrive bientôt<\/span>/);
});

test('page de chapitre : Article isPartOf CreativeWorkSeries + position, fil d\'Ariane avec la série', () => {
    const [article, crumbs] = jsonLd(pageOf('s1c4'));
    assert.equal(article.position, 3);
    assert.equal(article.headline, 'Nos étés – Chapitre 4 : Le retour');
    const serie = article.isPartOf.find((x) => x['@type'] === 'CreativeWorkSeries');
    assert.equal(serie.url, `${BASE}/histoires/serie/nos-etes-s1`);
    assert.deepEqual(crumbs.itemListElement.map((x) => x.name), ['Accueil', 'Histoires', 'Rencontres', 'Nos étés', 'Nos étés – Chapitre 4 : Le retour']);
});

test('page de série : sommaire, CreativeWorkSeries hasPart, sitemap', () => {
    const html = out.files.get('histoires/serie/nos-etes-s1.html');
    assert.ok(html, 'page de série générée');
    assert.match(html, /<h1>Nos étés<\/h1>/);
    assert.match(html, /3 chapitres · série en cours/);
    assert.equal((html.match(/<li><a href="\/histoires\//g) || []).length, 3);
    const [ld] = jsonLd(html);
    assert.equal(ld['@type'], 'CreativeWorkSeries');
    assert.deepEqual(ld.hasPart.map((p) => p.position), [1, 2, 3]);
    assert.ok(out.files.get('sitemap.xml').includes(`${BASE}/histoires/serie/nos-etes-s1</loc>`));
    assert.ok(OWNED_DIRS.includes('histoires/serie'));
});

test('série terminée : « Fin de la série » sur le dernier chapitre', () => {
    const done = build(stories, { base: BASE, series: [{ ...SERIES[0], statut: 'terminee' }], year: 2026 });
    const last = done.files.get(`${storyPath(stories[2]).slice(1)}.html`);
    assert.match(last, /<span>Fin de la série<\/span>/);
    assert.match(done.files.get('histoires/serie/nos-etes-s1.html'), /série terminée/);
});

test('non-régression : histoire seule et chapitre 1 isolé inchangés ; sans documents series, repli sur le chapitre 1', () => {
    const plain = build(stories.map(({ serieId, chapitre, ...s }) => s), { base: BASE, year: 2026 });
    for (const id of ['solo', 'lone']) {
        const path = `${storyPath(stories.find((s) => s.id === id)).slice(1)}.html`;
        assert.equal(out.files.get(path), plain.files.get(path), `${id} identique`);
    }
    const fallback = build(stories, { base: BASE, year: 2026 });
    assert.ok(fallback.files.get('histoires/serie/nos-etes-s1.html'));
});

test('main --series-fixture : écrit la page de série, idempotent au second passage', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'li-series-'));
    mkdirSync(join(dir, 'histoires'), { recursive: true });
    const fx = join(dir, 'stories.json');
    const sx = join(dir, 'series.json');
    writeFileSync(fx, JSON.stringify(raw));
    writeFileSync(sx, JSON.stringify(SERIES));
    const args = ['--fixture', fx, '--series-fixture', sx, '--base', BASE, '--out', dir];
    assert.equal(await main(args), 0);
    const file = join(dir, 'histoires/serie/nos-etes-s1.html');
    assert.ok(existsSync(file));
    const before = readFileSync(file, 'utf8');
    assert.equal(await main(args), 0);
    assert.equal(readFileSync(file, 'utf8'), before);
});
