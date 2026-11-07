// Tests des pages ajoutées au générateur : auteurs (vie privée), guides /ressources/, genres
// éditorialisés, titres/descriptions uniques, maillage interne. Fixture locale, sans réseau.
// Lancer : node --test tests/seo/pages.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { build, normalize, main, groupAuthors, uniqueBy, publicName, wordCount } from '../../scripts/build-seo-pages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = 'https://example.test';
const fixture = JSON.parse(readFileSync(join(ROOT, 'tests/seo/fixtures/stories.json'), 'utf8')).map((s) => normalize(s, s.id));
const genres = JSON.parse(readFileSync(join(ROOT, 'data/genres.json'), 'utf8'));
const ressources = JSON.parse(readFileSync(join(ROOT, 'data/ressources.json'), 'utf8'));
const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf8');
const llmsTxt = readFileSync(join(ROOT, 'llms.txt'), 'utf8');
const out = build(fixture, { base: BASE, genres, ressources, indexHtml, llmsTxt, year: 2026 });
const file = (f) => out.files.get(f);
const ldBlocks = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const headOf = (html) => html.slice(0, html.indexOf('</head>'));
const titleOf = (html) => headOf(html).match(/<title>([^<]*)<\/title>/)[1];
const descOf = (html) => headOf(html).match(/<meta name="description" content="([^"]*)">/)[1];
const attr = (s) => s.replace(/'/g, '&#39;');
const genreNames = Object.keys(genres).filter((k) => !k.startsWith('_'));

// --- Pages auteurs, vie privée ----------------------------------------------
test("pages auteurs : ProfilePage + Person + ItemList, lien depuis l'histoire, pas de page pour « Anonyme »", () => {
    const html = file('histoires/auteur/camille-r.html');
    assert.ok(html, 'page auteur absente');
    assert.ok(headOf(html).includes(`<link rel="canonical" href="${BASE}/histoires/auteur/camille-r">`));
    const [profile, list, crumbs] = ldBlocks(html);
    assert.equal(profile['@type'], 'ProfilePage');
    assert.deepEqual(profile.mainEntity, { '@type': 'Person', '@id': `${BASE}/histoires/auteur/camille-r#person`, name: 'Camille R.', url: `${BASE}/histoires/auteur/camille-r` });
    assert.equal(list['@type'], 'ItemList');
    assert.deepEqual(list.itemListElement.map((i) => i.url), [`${BASE}/histoires/les-lettres-d-aout-abc123XYZ`]);
    assert.deepEqual(crumbs.itemListElement.map((i) => i.name), ['Accueil', 'Histoires', 'Camille R.']);
    assert.ok(file('histoires/auteur/noe.html'));
    assert.ok(file('histoires/les-lettres-d-aout-abc123XYZ.html').includes('<a href="/histoires/auteur/camille-r" rel="author">Camille R.</a>'));
    assert.ok(![...out.files.keys()].some((k) => k.includes('auteur/anonyme')), 'pas de page pour une signature anonyme');
    const sad = [...out.files.entries()].find(([k]) => k.startsWith('histoires/ce-que-le-fleuve-garde'))[1];
    assert.ok(!sad.includes('rel="author"'));
    assert.equal(ldBlocks(sad)[0].author.url, undefined);
});

test("vie privée : jamais d'uid ni d'e-mail dans les sorties, homonymes départagés, pseudo le plus récent", () => {
    assert.equal(publicName('jean.dupont@example.com'), 'Auteur inconnu');
    assert.equal(publicName('  Léa   M. '), 'Léa M.');
    assert.equal(publicName(''), 'Auteur inconnu');
    const mk = (id, auteur, auteurId, date) => normalize({ titre: `Texte ${id}`, contenu: `Un texte assez long pour avoir un extrait lisible, numéro ${id}, qui parle d'amour et de lettres.`, categorie: 'Rencontres', auteur, auteurId, date }, id);
    const stories = [
        mk('s1', 'Léa', 'uid-SECRET-A', '2026-01-01T00:00:00Z'),
        mk('s2', 'Léa', 'uid-SECRET-B', '2026-02-01T00:00:00Z'),
        mk('s3', 'Léa la plume', 'uid-SECRET-A', '2026-03-01T00:00:00Z'),
        mk('s4', 'marie.martin@example.com', 'uid-SECRET-C', '2026-04-01T00:00:00Z'),
    ];
    const res = build(stories, { base: BASE, genres, ressources, indexHtml, llmsTxt, year: 2026 });
    for (const [k, v] of res.files) {
        assert.ok(!v.includes('uid-SECRET'), `uid publié dans ${k}`);
        assert.ok(!v.includes('@example.com'), `e-mail publié dans ${k}`);
    }
    // Même uid : une seule page, au pseudonyme le plus récent. Homonymes (uid distincts) : -2 par ordre de première publication.
    assert.deepEqual(res.authors.map((a) => [a.slug, a.name, a.stories.map((s) => s.id).sort().join(',')]), [['lea-la-plume', 'Léa la plume', 's1,s3'], ['lea', 'Léa', 's2']]);
    assert.ok(res.files.has('histoires/auteur/lea-la-plume.html') && res.files.has('histoires/auteur/lea.html'));
    assert.ok(![...res.files.keys()].some((k) => k.includes('auteur-inconnu')), 'pas de page pour un auteur masqué');
    // Sans uid : regroupement par pseudonyme.
    assert.equal(groupAuthors([mk('x1', 'Sam', undefined, '2026-01-01T00:00:00Z'), mk('x2', 'Sam', undefined, '2026-05-01T00:00:00Z')]).authors.length, 1);
    const twins = groupAuthors([mk('y2', 'Sam', 'b', '2026-05-01T00:00:00Z'), mk('y1', 'Sam', 'a', '2026-01-01T00:00:00Z')]).authors;
    assert.deepEqual(twins.map((a) => [a.slug, a.stories[0].id]), [['sam', 'y1'], ['sam-2', 'y2']]);
    // Pseudonymes non latins sans uid : deux auteurs distincts, slugs neutres et uniques.
    const nonLatin = groupAuthors([mk('z1', '李华', undefined, '2026-01-01T00:00:00Z'), mk('z2', '🌹', undefined, '2026-02-01T00:00:00Z')]).authors;
    assert.deepEqual(nonLatin.map((a) => [a.slug, a.name]), [['auteur', '李华'], ['auteur-2', '🌹']]);
});

// --- Titres et descriptions uniques -------------------------------------------
test('titres et descriptions : uniques sur toutes les pages générées, désambiguïsation des homonymes', () => {
    const htmlPages = (files) => [...files.entries()].filter(([k]) => k.endsWith('.html') && k !== 'index.html');
    for (const [label, get] of [['title', titleOf], ['description', descOf]]) {
        const values = htmlPages(out.files).map(([, v]) => get(v));
        assert.equal(new Set(values).size, values.length, `${label} en double`);
    }
    const twin = (id, date) => normalize({ titre: 'Toi', contenu: 'Court.', categorie: "Poésie d'amour", auteur: 'Nina', date }, id);
    const res = build([twin('aaaaaa1', '2026-01-01T00:00:00Z'), twin('bbbbbb2', '2026-02-01T00:00:00Z'), twin('cccccc3', '2026-02-01T00:00:00Z')], { base: BASE, genres, year: 2026 });
    const pages = htmlPages(res.files).filter(([k]) => k.startsWith('histoires/toi-'));
    const titles = pages.map(([, v]) => titleOf(v));
    const descs = pages.map(([, v]) => descOf(v));
    assert.equal(new Set(titles).size, 3, titles.join(' | '));
    assert.equal(new Set(descs).size, 3, descs.join(' | '));
    for (const d of descs) assert.ok(d.length >= 50 && d.length <= 160, `description de ${d.length} caractères : ${d}`);
    assert.deepEqual([...uniqueBy([{ id: 'a' }, { id: 'b' }], (x, l) => (l ? x.id : 'même')).values()], ['a', 'b']);
});

// --- Pages de genre éditorialisées ---------------------------------------------
test("data/genres.json : intro d'environ 150 mots et au moins 2 questions de FAQ par genre", () => {
    for (const name of genreNames) {
        const g = genres[name];
        const n = wordCount(g.intro);
        assert.ok(n >= 120 && n <= 220, `intro « ${name} » : ${n} mots`);
        assert.ok(g.faq?.length >= 2, `FAQ « ${name} » : moins de 2 questions`);
        assert.match(g.updated, /^\d{4}-\d{2}-\d{2}$/);
    }
});

test('page genre : FAQ visible = FAQPage, genre vide publié, « les plus appréciées », guides liés', () => {
    const html = file('histoires/genre/lettres-d-amour.html');
    assert.ok(html, 'genre configuré sans histoire : la page doit exister');
    assert.ok(html.includes('Les premières histoires de ce genre arrivent bientôt'));
    const faq = ldBlocks(html).find((b) => b['@type'] === 'FAQPage');
    assert.equal(faq.mainEntity.length, genres["Lettres d'amour"].faq.length);
    for (const q of faq.mainEntity) {
        assert.ok(html.includes(`<summary>${attr(q.name)}</summary>`), `question absente du HTML : ${q.name}`);
        assert.ok(!/\]\(\//.test(q.acceptedAnswer.text), 'syntaxe de lien brute dans le JSON-LD');
    }
    assert.ok(html.includes('href="/ressources/comment-ecrire-une-lettre-d-amour"'));
    for (const g of genreNames) assert.ok([...out.files.entries()].some(([k, v]) => k.startsWith('histoires/genre/') && v.includes(`<h1>${attr(g)}</h1>`)), `page genre absente : ${g}`);
    const liked = ['un', 'deux', 'trois', 'quatre'].map((t, i) => normalize({ titre: `Rencontre ${t}`, contenu: 'Texte de rencontre suffisamment long pour un extrait.', categorie: 'Rencontres', auteur: 'Ana', likes: [3, 0, 12, 7][i], date: `2026-0${i + 1}-01T00:00:00Z` }, `id${i}`));
    const gp = build(liked, { base: BASE, genres, year: 2026 }).files.get('histoires/genre/rencontres.html');
    const best = gp.slice(gp.indexOf('Les plus appréciées'), gp.indexOf('Toutes les histoires'));
    assert.deepEqual([...best.matchAll(/<h3>([^<]+)<\/h3>/g)].map((m) => m[1]), ['Rencontre trois', 'Rencontre quatre', 'Rencontre un']);
});

// --- Guides (/ressources/) -----------------------------------------------------
test('guides : 3 pages + index, Article/BreadcrumbList/FAQPage, head complet, contenu substantiel', () => {
    assert.deepEqual(ressources.pages.map((g) => g.slug), ['comment-ecrire-une-lettre-d-amour', 'exemples-de-lettres-d-amour', 'idees-histoires-d-amour']);
    const idx = file('ressources/index.html');
    assert.ok(idx);
    assert.equal(ldBlocks(idx)[0]['@type'], 'CollectionPage');
    for (const g of ressources.pages) {
        const html = file(`ressources/${g.slug}.html`);
        assert.ok(html, `guide ${g.slug} absent`);
        assert.ok(idx.includes(`href="/ressources/${g.slug}"`));
        assert.ok(headOf(html).includes(`<link rel="canonical" href="${BASE}/ressources/${g.slug}">`));
        assert.ok(g.title.length >= 10 && g.title.length <= 70, `title ${g.slug} : ${g.title.length}`);
        assert.ok(g.description.length >= 50 && g.description.length <= 160, `description ${g.slug} : ${g.description.length}`);
        const [article, crumbs, faq] = ldBlocks(html);
        assert.equal(article['@type'], 'Article');
        assert.equal(article.publisher['@id'], `${BASE}/#organization`);
        assert.equal(article.publisher.parentOrganization['@id'], 'https://www.trigenys.com/#org');
        assert.equal(article.isPartOf['@id'], `${BASE}/#website`);
        assert.deepEqual(crumbs.itemListElement.map((i) => i.name), ['Accueil', 'Guides', g.h1]);
        assert.equal(faq['@type'], 'FAQPage');
        const text = html.slice(html.indexOf('<main'), html.indexOf('</main>')).replace(/<[^>]+>/g, ' ');
        assert.ok(wordCount(text) >= 500, `guide ${g.slug} trop court (${wordCount(text)} mots)`);
        assert.ok(!html.includes('**') && !/\]\(\//.test(html), `mise en forme non convertie dans ${g.slug}`);
    }
});

test('maillage interne : tout lien relatif des pages générées pointe vers une page existante', () => {
    const exists = (p) => { const f = p === '/' ? 'index.html' : p.endsWith('/') ? `${p.slice(1)}index.html` : `${p.slice(1)}.html`; return out.files.has(f) || existsSync(join(ROOT, f)) || existsSync(join(ROOT, p.slice(1))); };
    for (const [k, v] of out.files) {
        if (!k.endsWith('.html') || k === 'index.html') continue;
        for (const [, href] of v.matchAll(/href="(\/[^"]*)"/g)) assert.ok(exists(href.split(/[?#]/)[0]), `${k} : lien cassé ${href}`);
    }
    const lettres = file('ressources/comment-ecrire-une-lettre-d-amour.html');
    assert.ok(lettres.includes('href="/histoires/genre/lettres-d-amour"') && lettres.includes('href="/ressources/exemples-de-lettres-d-amour"'));
    assert.ok(file('histoires/index.html').includes('href="/ressources/idees-histoires-d-amour"'));
});

test('llms.txt / llms-full.txt / index.html : auteurs et guides référencés', () => {
    const txt = file('llms.txt');
    assert.ok(txt.includes(`- [Camille R.](${BASE}/histoires/auteur/camille-r) : 1 histoire`));
    assert.ok(txt.includes(`- [Tous les guides](${BASE}/ressources/)`));
    for (const g of ressources.pages) assert.ok(txt.includes(`(${BASE}/ressources/${g.slug})`), `guide ${g.slug} absent de llms.txt`);
    assert.ok(txt.includes(`- [Lettres d'amour](${BASE}/histoires/genre/lettres-d-amour) : premières histoires à venir`));
    assert.ok(file('llms-full.txt').includes("## Guides d'écriture"));
    assert.ok(file('index.html').includes('href="ressources/comment-ecrire-une-lettre-d-amour"'));
});

test('main : supprime les pages auteur et guide orphelines, préserve les fichiers non gérés', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'loveink-seo-'));
    try {
        for (const d of ['histoires/auteur', 'ressources']) mkdirSync(join(dir, d), { recursive: true });
        writeFileSync(join(dir, 'histoires/auteur/ancien-auteur.html'), '<html></html>');
        writeFileSync(join(dir, 'ressources/ancien-guide.html'), '<html></html>');
        writeFileSync(join(dir, 'ressources/note.txt'), 'non géré');
        assert.equal(await main(['--fixture', join(ROOT, 'tests/seo/fixtures/stories.json'), '--base', BASE, '--out', dir]), 0);
        assert.ok(!existsSync(join(dir, 'histoires/auteur/ancien-auteur.html')));
        assert.ok(!existsSync(join(dir, 'ressources/ancien-guide.html')));
        assert.ok(existsSync(join(dir, 'ressources/note.txt')), 'fichier non géré préservé');
        assert.ok(existsSync(join(dir, 'histoires/auteur/camille-r.html')) && existsSync(join(dir, 'ressources/idees-histoires-d-amour.html')));
        assert.ok(!readFileSync(join(dir, 'sitemap.xml'), 'utf8').includes('/register'));
    } finally { rmSync(dir, { recursive: true, force: true }); }
});
