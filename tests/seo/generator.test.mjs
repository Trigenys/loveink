// Tests du générateur de pages SEO sur une fixture (sans réseau) : URL à slug, données structurées,
// sitemap avec lastmod, flux Atom, blocs index.html / llms.txt, idempotence, garde-fou de suppression.
// Lancer : node --test tests/seo/generator.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { build, normalize, storyPath, shrinkGuard, replaceBetween, main, groupAuthors, uniqueBy, publicName, wordCount } from '../../scripts/build-seo-pages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = 'https://example.test';
const fixture = JSON.parse(readFileSync(join(ROOT, 'tests/seo/fixtures/stories.json'), 'utf8')).map((s) => normalize(s, s.id));
const genres = JSON.parse(readFileSync(join(ROOT, 'data/genres.json'), 'utf8'));
const ressources = JSON.parse(readFileSync(join(ROOT, 'data/ressources.json'), 'utf8'));
const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf8');
const llmsTxt = readFileSync(join(ROOT, 'llms.txt'), 'utf8');
const out = build(fixture, { base: BASE, genres, ressources, indexHtml, llmsTxt, year: 2026 });
const file = (f) => out.files.get(f);
const fileForLoc = (loc) => { const p = loc.slice(BASE.length + 1); return p === '' || p.endsWith('/') ? `${p}index.html` : `${p}.html`; };
const ldBlocks = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const headOf = (html) => html.slice(0, html.indexOf('</head>'));
const titleOf = (html) => headOf(html).match(/<title>([^<]*)<\/title>/)[1];
const descOf = (html) => headOf(html).match(/<meta name="description" content="([^"]*)">/)[1];

test('URL des histoires : slug du titre + id, chemin stable', () => {
    for (const s of fixture) assert.match(storyPath(s), /^\/histoires\/[a-z0-9-]+-[A-Za-z0-9]+$/);
    assert.equal(storyPath(fixture[0]), '/histoires/les-lettres-d-aout-abc123XYZ');
});

test('page histoire : head complet (canonical, article:*, twitter, robots, atom) et lien lecture sans .html', () => {
    const html = file('histoires/les-lettres-d-aout-abc123XYZ.html');
    assert.ok(html);
    const head = html.slice(0, html.indexOf('</head>'));
    assert.ok(head.includes(`<link rel="canonical" href="${BASE}/histoires/les-lettres-d-aout-abc123XYZ">`));
    for (const m of ['article:published_time', 'article:modified_time', 'article:section', 'article:author', 'og:image:alt']) assert.ok(head.includes(`property="${m}"`), `${m} manquant`);
    for (const m of ['twitter:title', 'twitter:description', 'twitter:image']) assert.ok(head.includes(`name="${m}"`), `${m} manquant`);
    assert.ok(head.includes('<meta name="robots" content="max-image-preview:large">'));
    assert.ok(head.includes('type="application/atom+xml"'));
    assert.ok(html.includes('href="/histoire?id=abc123XYZ"'));
    assert.ok(!html.includes('histoire.html?id='));
});

test('page histoire : Article complet + BreadcrumbList, publisher aligné sur index.html', () => {
    const [article, crumbs] = ldBlocks(file('histoires/les-lettres-d-aout-abc123XYZ.html'));
    assert.equal(article['@type'], 'Article');
    assert.equal(article.datePublished, '2026-10-20T10:00:00.000Z');
    assert.equal(article.dateModified, '2026-10-22T08:30:00.000Z');
    assert.equal(article.isAccessibleForFree, true);
    assert.ok(article.wordCount > 20);
    assert.match(article.timeRequired, /^PT\d+M$/);
    assert.equal(article.genre, 'Premier amour');
    assert.equal(article.publisher['@id'], `${BASE}/#organization`);
    assert.equal(article.publisher.logo['@type'], 'ImageObject');
    assert.equal(article.author['@type'], 'Person');
    assert.equal(article.author.name, 'Camille R.');
    assert.equal(article.author.url, `${BASE}/histoires/auteur/camille-r`);
    assert.equal(article.author['@id'], `${BASE}/histoires/auteur/camille-r#person`);
    assert.equal(crumbs['@type'], 'BreadcrumbList');
    assert.deepEqual(crumbs.itemListElement.map((i) => i.name), ['Accueil', 'Histoires', 'Premier amour', "Les lettres d'août"]);
    const org = JSON.parse(indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]).find((b) => b['@type'] === 'Organization');
    assert.equal(org['@id'].replace('https://loveink.site', BASE), article.publisher['@id']);
    // Nouveaux champs : ShortStory en type additionnel, appartenance au site, rattachement au groupe Trigenys.
    assert.equal(article.additionalType, 'https://schema.org/ShortStory');
    assert.deepEqual(article.isPartOf, { '@type': 'WebSite', '@id': `${BASE}/#website`, name: 'Love Ink', url: `${BASE}/` });
    assert.equal(article.publisher.parentOrganization['@id'], 'https://www.trigenys.com/#org');
    assert.equal(org.parentOrganization['@id'], article.publisher.parentOrganization['@id'], 'index.html et pages histoire désignent le même groupe');
});

test('page histoire : texte intégral présent dans le HTML sans JavaScript', () => {
    const html = file('histoires/les-lettres-d-aout-abc123XYZ.html');
    const story = fixture.find((s) => s.id === 'abc123XYZ');
    const firstPara = story.contenu.split(/\n{2,}/)[0].trim().split('\n')[0];
    assert.ok(html.includes(`<p>${firstPara.replace(/'/g, '&#39;')}`), 'premier paragraphe absent du HTML statique');
    const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1]);
    assert.ok(scripts.every((a) => a.includes('type="application/ld+json"')), 'seuls des blocs JSON-LD sont autorisés, aucun script exécutable');
});

test('data/genres.json : chaque catégorie de publier.html a une intro et une description (50-160 caractères)', () => {
    const options = [...readFileSync(join(ROOT, 'publier.html'), 'utf8').matchAll(/<option value="([^"]+)">/g)].map((m) => m[1]);
    assert.ok(options.length >= 5);
    for (const g of options) {
        assert.ok(genres[g]?.intro, `genre « ${g} » sans intro`);
        assert.ok(genres[g].description.length >= 50 && genres[g].description.length <= 160, `description « ${g} » hors 50-160`);
    }
});

test('page genre : intro depuis data/genres.json, ItemList, BreadcrumbList', () => {
    const html = file('histoires/genre/premier-amour.html');
    assert.ok(html.includes('Le premier amour a ce goût particulier'));
    assert.ok(html.includes(`content="${genres['Premier amour'].description}"`));
    const [coll, crumbs] = ldBlocks(html);
    assert.equal(coll['@type'], 'CollectionPage');
    assert.equal(coll.mainEntity['@type'], 'ItemList');
    assert.equal(coll.mainEntity.itemListElement.length, 1);
    assert.equal(crumbs.itemListElement.length, 3);
    // Genre sans texte dans data/genres.json : description générique, pas de plantage.
    const bare = build(fixture, { base: BASE, genres: {}, indexHtml, llmsTxt, year: 2026 });
    assert.ok(bare.files.get('histoires/genre/histoires-tristes.html').includes('1 histoire d&#39;amour « Histoires tristes »'));
});

test('index des histoires : ItemList et liens vers toutes les histoires', () => {
    const html = file('histoires/index.html');
    for (const s of fixture) assert.ok(html.includes(`href="${storyPath(s)}"`));
    assert.equal(ldBlocks(html)[0].mainEntity.itemListElement.length, 3);
});

test('sitemap : pages statiques sans lastmod, index/genres/histoires avec lastmod = date la plus récente', () => {
    const xml = file('sitemap.xml');
    assert.ok(xml.includes(`<url><loc>${BASE}/</loc></url>`));
    assert.ok(xml.includes(`<url><loc>${BASE}/histoires/</loc><lastmod>2026-11-01</lastmod></url>`));
    // Genre éditorialisé : lastmod = max(dernière histoire, révision du texte dans data/genres.json).
    assert.ok(xml.includes(`<url><loc>${BASE}/histoires/genre/premier-amour</loc><lastmod>${genres['Premier amour'].updated}</lastmod></url>`));
    assert.ok(xml.includes(`<url><loc>${BASE}/histoires/les-lettres-d-aout-abc123XYZ</loc><lastmod>2026-10-22</lastmod></url>`));
    assert.ok(!xml.includes('flux.xml'));
    const bare = build(fixture, { base: BASE, genres: {}, year: 2026 }).files.get('sitemap.xml');
    assert.ok(bare.includes(`<url><loc>${BASE}/histoires/genre/premier-amour</loc><lastmod>2026-10-22</lastmod></url>`), 'sans texte éditorial, lastmod = dernière histoire');
});

test('sitemap : /register exclu (page de conversion), auteurs et guides inclus', () => {
    const xml = file('sitemap.xml');
    assert.ok(!xml.includes('/register'), '/register ne doit pas être dans le sitemap');
    assert.ok(!xml.includes('/login'));
    assert.ok(xml.includes(`<loc>${BASE}/histoires/auteur/camille-r</loc>`));
    assert.ok(xml.includes(`<loc>${BASE}/ressources/</loc>`));
    for (const g of ressources.pages) assert.ok(xml.includes(`<loc>${BASE}/ressources/${g.slug}</loc>`), `guide ${g.slug} absent du sitemap`);
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    assert.equal(new Set(locs).size, locs.length, 'URL en double dans le sitemap');
    for (const loc of locs.filter((l) => l !== `${BASE}/`)) assert.ok(out.files.has(fileForLoc(loc)), `URL du sitemap sans page générée : ${loc}`);
});

test('flux Atom : entrées triées, liens absolus, updated', () => {
    const xml = file('histoires/flux.xml');
    assert.ok(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>'));
    assert.ok(xml.includes(`<link href="${BASE}/histoires/flux.xml" rel="self"/>`));
    assert.ok(xml.includes('<updated>2026-11-01T07:12:00.000Z</updated>'));
    const ids = [...xml.matchAll(/<id>([^<]+)<\/id>/g)].map((m) => m[1]).slice(1);
    assert.deepEqual(ids, fixture.slice().sort((a, b) => b.date.localeCompare(a.date)).map((s) => `${BASE}${storyPath(s)}`));
    assert.ok(xml.includes('<title>Café, 7 h 12</title>'));
});

test('index.html : seul le bloc entre marqueurs change, liens relatifs vers les histoires', () => {
    const html = file('index.html');
    const strip = (h) => h.replace(/<!-- seo:latest:start -->[\s\S]*?<!-- seo:latest:end -->/, '');
    assert.equal(strip(html), strip(indexHtml));
    assert.ok(html.includes('href="histoires/les-lettres-d-aout-abc123XYZ"'));
    assert.ok(html.includes('href="histoires/genre/premier-amour"'));
    assert.ok(!html.includes('href="/histoires/'), 'liens absolus interdits dans index.html (fichiers servis aussi en local)');
    assert.throws(() => replaceBetween('rien', ['<!-- a -->', '<!-- b -->'], 'x'), /marqueurs/);
});

test('llms.txt : section Histoires régénérée, partie manuelle intacte ; llms-full.txt avec extraits', () => {
    const txt = file('llms.txt');
    assert.ok(txt.includes('## Ce que l\'on y fait'));
    assert.ok(txt.includes(`- [Premier amour](${BASE}/histoires/genre/premier-amour) : 1 histoire`));
    assert.ok(txt.includes(`- [Les lettres d'août](${BASE}/histoires/les-lettres-d-aout-abc123XYZ) — Camille R., Premier amour`));
    const full = file('llms-full.txt');
    assert.ok(full.includes('## Histoires publiées (extraits)'));
    assert.ok(full.includes("### Les lettres d'août"));
    assert.ok(!full.includes('llms:histoires:start'));
});

test('idempotence : un second build sur la sortie du premier produit les mêmes fichiers', () => {
    const again = build(fixture, { base: BASE, genres, ressources, indexHtml: file('index.html'), llmsTxt: file('llms.txt'), year: 2026 });
    for (const [k, v] of out.files) assert.equal(again.files.get(k), v, `${k} diffère au second passage`);
});

test('garde-fou : 0 histoire avec pages existantes, ou > 50 % supprimées', () => {
    assert.equal(shrinkGuard(0, 0, 0), null);
    assert.equal(shrinkGuard(10, 9, 1), null);
    assert.match(shrinkGuard(5, 0, 5), /0 histoire/);
    assert.match(shrinkGuard(10, 3, 7), /> 50 %/);
    assert.equal(shrinkGuard(1, 1, 0), null);
});

test('main --fixture --out : écrit, supprime les pages retirées, s\'arrête sur suppression massive', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'loveink-seo-'));
    try {
        mkdirSync(join(dir, 'histoires'), { recursive: true });
        writeFileSync(join(dir, 'histoires', 'ancienne-page-zzz.html'), '<html></html>');
        assert.equal(await main(['--fixture', join(ROOT, 'tests/seo/fixtures/stories.json'), '--base', BASE, '--out', dir]), 0);
        assert.ok(existsSync(join(dir, 'histoires/les-lettres-d-aout-abc123XYZ.html')));
        assert.ok(!existsSync(join(dir, 'histoires/ancienne-page-zzz.html')), 'page retirée non supprimée');
        assert.ok(existsSync(join(dir, 'sitemap.xml')) && existsSync(join(dir, 'histoires/flux.xml')));
        const empty = join(dir, 'empty.json'); writeFileSync(empty, '[]');
        assert.equal(await main(['--fixture', empty, '--base', BASE, '--out', dir]), 2, 'le garde-fou doit bloquer');
        assert.equal(readdirSync(join(dir, 'histoires')).filter((f) => f.endsWith('.html') && f !== 'index.html').length, 3);
        assert.equal(await main(['--fixture', empty, '--base', BASE, '--out', dir, '--allow-shrink']), 0);
        assert.equal(readdirSync(join(dir, 'histoires')).filter((f) => f.endsWith('.html') && f !== 'index.html').length, 0);
    } finally { rmSync(dir, { recursive: true, force: true }); }
});
