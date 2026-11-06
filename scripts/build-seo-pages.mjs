#!/usr/bin/env node
// Génère des pages HTML statiques pour les histoires publiées (lisibles sans compte ni JavaScript,
// donc indexables par les moteurs et les crawlers IA), une page par genre, un index, le sitemap,
// le flux Atom, la section « Histoires » de llms.txt, llms-full.txt et le bloc « dernières histoires »
// de index.html.
// Source : Firestore REST (lecture publique des histoires `statut == "publie"`, aucune clé secrète).
// Idempotent : n'écrit un fichier que si son contenu change ; supprime les pages d'histoires retirées.
// Usage : node scripts/build-seo-pages.mjs [--base https://loveink.site] [--project love-ink] [--dry-run]
//         [--fixture tests/seo/fixtures/stories.json] [--allow-shrink] [--out <dossier>]
// Garde-fou : si la source renvoie 0 histoire alors que des pages existent, ou si plus de la moitié des
// pages d'histoires seraient supprimées, le script s'arrête (code 2) sauf `--allow-shrink`.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'Love Ink';
const STATIC_URLS = ['/', '/register', '/histoires/'];
const FEED_PATH = '/histoires/flux.xml'; // jamais sous /feed : robots.txt bloque ce préfixe.
const LATEST_MARK = ['<!-- seo:latest:start -->', '<!-- seo:latest:end -->'];
const LLMS_MARK = ['<!-- llms:histoires:start -->', '<!-- llms:histoires:end -->'];

export function parseArgs(argv) {
    return Object.fromEntries(argv.map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : []).filter(Boolean));
}

// --- Firestore REST -----------------------------------------------------
const decode = (v) => {
    if (v == null) return null;
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return v.doubleValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('timestampValue' in v) return v.timestampValue;
    if ('nullValue' in v) return null;
    if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, decode(x)]));
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
    return null;
};
const toIso = (d) => { const t = d ? new Date(d) : null; return t && !Number.isNaN(t) ? t.toISOString() : null; };
export const normalize = (f, id) => ({ id, ...f, date: toIso(f.date), dateModified: toIso(f.dateModification || f.updatedAt || f.date) });

// Pagination par curseur sur __name__ (pas d'index composite requis) : aucun plafond silencieux.
export async function fetchPublished(project, pageSize = 300) {
    const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents:runQuery`;
    const out = [];
    let cursor = null;
    for (;;) {
        const structuredQuery = {
            from: [{ collectionId: 'histoires' }],
            where: { fieldFilter: { field: { fieldPath: 'statut' }, op: 'EQUAL', value: { stringValue: 'publie' } } },
            orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }],
            limit: pageSize,
            ...(cursor ? { startAt: { values: [{ referenceValue: cursor }], before: false } } : {}),
        };
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ structuredQuery }) });
        if (!r.ok) throw new Error(`Firestore ${r.status} : ${(await r.text()).slice(0, 200)}`);
        const rows = await r.json();
        if (rows[0]?.error) throw new Error(`Firestore : ${rows[0].error.message}`);
        const docs = rows.filter((x) => x.document);
        for (const x of docs) out.push(normalize(Object.fromEntries(Object.entries(x.document.fields || {}).map(([k, v]) => [k, decode(v)])), x.document.name.split('/').pop()));
        if (docs.length < pageSize) return out;
        cursor = docs[docs.length - 1].document.name;
    }
}

// --- Rendu --------------------------------------------------------------
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const slug = (s) => String(s || 'divers').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'divers';
export const storyPath = (s) => `/histoires/${slug(s.titre).slice(0, 80).replace(/-$/, '')}-${s.id}`;
const genrePath = (name) => `/histoires/genre/${slug(name)}`;
const excerpt = (story, n = 155) => { const t = String(story.extrait || story.contenu || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s\S*$/, '') + '…' : t; };
const paragraphs = (t) => String(t || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('\n');
const wordCount = (t) => (String(t || '').match(/[\p{L}\p{N}'’-]+/gu) || []).length;
const readingMinutes = (t) => Math.max(1, Math.round(wordCount(t) / 200));
const fmtDate = (iso) => iso ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(iso)) : '';
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
const latest = (list) => list.map((s) => s.dateModified || s.date).filter(Boolean).sort().pop() || null;

export function createRenderer({ base = 'https://loveink.site', genres = {}, year = new Date().getUTCFullYear() } = {}) {
    const BASE = String(base).replace(/\/$/, '');
    const OG_IMG = `${BASE}/images/og-love-ink.jpg`;
    const ORG = { '@type': 'Organization', '@id': `${BASE}/#organization`, name: SITE, url: `${BASE}/`, logo: { '@type': 'ImageObject', url: OG_IMG, width: 1200, height: 630 } };
    const WEBSITE = { '@type': 'WebSite', '@id': `${BASE}/#website`, name: SITE, url: `${BASE}/` };
    const crumbs = (items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${BASE}${path}` })) });
    const itemList = (stories) => ({ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: stories.map((s, i) => ({ '@type': 'ListItem', position: i + 1, url: `${BASE}${storyPath(s)}`, name: s.titre || 'Sans titre' })) });

    function page({ title, description, path, body, jsonLd = [], type = 'website', meta = '' }) {
        const url = `${BASE}${path}`;
        return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}">
    <meta name="robots" content="max-image-preview:large">
    <link rel="canonical" href="${url}">
    <link rel="alternate" type="application/atom+xml" title="Love Ink – dernières histoires" href="${BASE}${FEED_PATH}">
    <meta property="og:type" content="${type}">
    <meta property="og:site_name" content="${SITE}">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:url" content="${url}">
    <meta property="og:image" content="${OG_IMG}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="Une lettre manuscrite et une plume, avec le titre Love Ink, l'encre des cœurs">
    <meta property="og:locale" content="fr_FR">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(title)}">
    <meta name="twitter:description" content="${esc(description)}">
    <meta name="twitter:image" content="${OG_IMG}">
${meta}    <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=20260325-brand3">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pinyon+Script&display=swap" media="print" onload="this.media='all'">
    <link rel="stylesheet" href="/css/story-page.css">
    ${jsonLd.map(ld).join('\n    ')}
</head>
<body>
    <header class="sp-header"><a class="sp-brand" href="/">Love Ink</a><nav><a href="/histoires/">Histoires</a><a href="/login">Connexion</a><a class="sp-cta" href="/register">Créer un compte</a></nav></header>
    <main class="sp-main">
${body}
    </main>
    <footer class="sp-footer"><p>© ${year} Love Ink – L'encre des cœurs · <a href="/conditions">Conditions</a> · <a href="/confidentialite">Confidentialité</a> · <a href="${FEED_PATH}">Flux Atom</a></p><p class="li-made-by">Made <em>by</em> <a href="https://trigenys.com" rel="noopener">Trigenys Group</a></p></footer>
</body>
</html>
`;
    }

    const card = (s) => `            <li class="sp-card"><a href="${storyPath(s)}"><h3>${esc(s.titre || 'Sans titre')}</h3><p class="sp-meta">${esc(s.auteur || 'Auteur inconnu')} · ${esc(s.categorie || 'Divers')} · ${readingMinutes(s.contenu)} min</p><p>${esc(excerpt(s, 120))}</p></a></li>`;

    function storyPage(s) {
        const path = storyPath(s);
        const genre = s.categorie || 'Divers';
        const title = `${s.titre || 'Sans titre'} – histoire d'amour par ${s.auteur || 'un auteur Love Ink'} | Love Ink`;
        const body = `        <article class="sp-story">
            <p class="sp-kicker"><a href="/histoires/">Histoires</a> › <a href="${genrePath(genre)}">${esc(genre)}</a></p>
            <h1>${esc(s.titre || 'Sans titre')}</h1>
            <p class="sp-meta">Par ${esc(s.auteur || 'Auteur inconnu')}${s.date ? ` · <time datetime="${s.date}">${fmtDate(s.date)}</time>` : ''} · ${readingMinutes(s.contenu)} min de lecture</p>
            <div class="sp-content">
${paragraphs(s.contenu)}
            </div>
            <aside class="sp-react"><p>Cette histoire vous a touché ? Réagissez, commentez et suivez l'auteur sur Love Ink.</p><a class="sp-cta" href="/histoire?id=${esc(s.id)}">Lire dans l'application</a> <a class="sp-link" href="/register">Créer un compte gratuit</a></aside>
        </article>`;
        const article = {
            '@context': 'https://schema.org', '@type': 'Article', '@id': `${BASE}${path}#article`, headline: s.titre || 'Sans titre', description: excerpt(s), url: `${BASE}${path}`,
            author: { '@type': 'Person', name: s.auteur || 'Auteur inconnu' }, datePublished: s.date || undefined, dateModified: s.dateModified || s.date || undefined,
            articleSection: genre, genre, wordCount: wordCount(s.contenu), timeRequired: `PT${readingMinutes(s.contenu)}M`, isAccessibleForFree: true,
            inLanguage: 'fr', mainEntityOfPage: `${BASE}${path}`, image: OG_IMG, publisher: ORG,
        };
        const meta = [s.date && `<meta property="article:published_time" content="${s.date}">`, (s.dateModified || s.date) && `<meta property="article:modified_time" content="${s.dateModified || s.date}">`, `<meta property="article:section" content="${esc(genre)}">`, `<meta property="article:author" content="${esc(s.auteur || 'Auteur inconnu')}">`].filter(Boolean).map((m) => `    ${m}\n`).join('');
        const jsonLd = [article, crumbs([['Accueil', '/'], ['Histoires', '/histoires/'], [genre, genrePath(genre)], [s.titre || 'Sans titre', path]])];
        return { path, html: page({ title, description: excerpt(s), path, body, jsonLd, type: 'article', meta }), lastmod: s.dateModified || s.date };
    }

    function genrePage(name, stories) {
        const path = genrePath(name);
        const g = genres[name] || {};
        const title = `${name} : histoires d'amour à lire gratuitement | Love Ink`;
        const description = g.description || `${stories.length} histoire${stories.length > 1 ? 's' : ''} d'amour « ${name} » à lire gratuitement en français sur Love Ink, écrites par la communauté.`;
        const intro = g.intro ? paragraphs(g.intro) : `<p class="sp-lead">${esc(description)}</p>`;
        const faq = (g.faq || []).length ? `        <section class="sp-faq"><h2>Questions fréquentes</h2>\n${g.faq.map((q) => `            <details><summary>${esc(q.q)}</summary><p>${esc(q.a)}</p></details>`).join('\n')}\n        </section>` : '';
        const body = `        <section class="sp-list"><p class="sp-kicker"><a href="/histoires/">Histoires</a> › Genre</p><h1>${esc(name)}</h1><div class="sp-intro">${intro}</div>
        <ul>
${stories.map(card).join('\n')}
        </ul></section>
${faq}`;
        const jsonLd = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description, url: `${BASE}${path}`, inLanguage: 'fr', isPartOf: WEBSITE, mainEntity: itemList(stories) }, crumbs([['Accueil', '/'], ['Histoires', '/histoires/'], [name, path]])];
        if (faq) jsonLd.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: g.faq.map((q) => ({ '@type': 'Question', name: q.q, acceptedAnswer: { '@type': 'Answer', text: q.a } })) });
        return { path, html: page({ title, description, path, body, jsonLd }), lastmod: latest(stories) };
    }

    function indexPage(byGenre, stories) {
        const path = '/histoires/';
        const title = "Toutes les histoires d'amour à lire gratuitement | Love Ink";
        const description = `${stories.length} histoire${stories.length > 1 ? 's' : ''} d'amour en français, écrites par la communauté Love Ink et relues avant publication. Lecture gratuite, sans compte.`;
        const sections = [...byGenre.entries()].map(([g, list]) => `        <section class="sp-list"><h2><a href="${genrePath(g)}">${esc(g)}</a></h2><ul>\n${list.slice(0, 6).map(card).join('\n')}\n        </ul></section>`).join('\n');
        const body = `        <p class="sp-kicker"><a href="/">Accueil</a> › Bibliothèque</p><h1>Histoires d'amour à lire</h1><p class="sp-lead">${esc(description)}</p>
${sections || '        <p class="sp-lead">Les premières histoires arrivent bientôt. <a href="/register">Écrivez la vôtre.</a></p>'}`;
        const jsonLd = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description, url: `${BASE}${path}`, inLanguage: 'fr', isPartOf: WEBSITE, mainEntity: itemList(stories.slice(0, 50)) }, crumbs([['Accueil', '/'], ['Histoires', path]])];
        return { path, html: page({ title, description, path, body, jsonLd }), lastmod: latest(stories) };
    }

    function sitemap(entries) {
        const row = (loc, lastmod) => `  <url><loc>${esc(loc)}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ''}</url>`;
        return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map((e) => row(`${BASE}${e.path}`, e.lastmod)).join('\n')}\n</urlset>\n`;
    }

    function atom(stories) {
        const updated = latest(stories) || '1970-01-01T00:00:00.000Z';
        const entry = (s) => `  <entry>
    <title>${esc(s.titre || 'Sans titre')}</title>
    <link href="${BASE}${storyPath(s)}"/>
    <id>${BASE}${storyPath(s)}</id>
    <published>${s.date || updated}</published>
    <updated>${s.dateModified || s.date || updated}</updated>
    <author><name>${esc(s.auteur || 'Auteur inconnu')}</name></author>
    <category term="${esc(s.categorie || 'Divers')}"/>
    <summary>${esc(excerpt(s))}</summary>
  </entry>`;
        return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="fr">
  <title>Love Ink – dernières histoires d'amour</title>
  <subtitle>Histoires d'amour en français, relues avant publication.</subtitle>
  <link href="${BASE}${FEED_PATH}" rel="self"/>
  <link href="${BASE}/histoires/"/>
  <id>${BASE}/histoires/</id>
  <updated>${updated}</updated>
${stories.slice(0, 30).map(entry).join('\n')}
</feed>
`;
    }

    // Bloc « dernières histoires » de index.html, entre marqueurs : seul ce bloc est réécrit.
    function latestBlock(byGenre, stories) {
        if (!stories.length) return `${LATEST_MARK[0]}\n                <p class="lp-lead">Les premières histoires arrivent. <a href="histoires/">Voir la bibliothèque</a> ou <a href="register.html">écrire la vôtre</a>.</p>\n                ${LATEST_MARK[1]}`;
        const items = stories.slice(0, 6).map((s) => `                    <li><a href="${storyPath(s).slice(1)}"><strong>${esc(s.titre || 'Sans titre')}</strong><span>${esc(s.auteur || 'Auteur inconnu')} · ${esc(s.categorie || 'Divers')} · ${readingMinutes(s.contenu)} min</span></a></li>`).join('\n');
        const genresHtml = [...byGenre.keys()].map((g) => `<a href="${genrePath(g).slice(1)}">${esc(g)}</a>`).join(' · ');
        return `${LATEST_MARK[0]}\n                <ul class="lp-latest">\n${items}\n                </ul>\n                <p class="lp-latest__genres">Par genre : ${genresHtml}</p>\n                ${LATEST_MARK[1]}`;
    }

    function llmsSection(byGenre, stories) {
        const lines = [`## Histoires publiées`, `- [Bibliothèque](${BASE}/histoires/) : toutes les histoires, lisibles sans compte`, `- [Flux Atom](${BASE}${FEED_PATH})`];
        if (byGenre.size) lines.push('', '### Genres', ...[...byGenre.entries()].map(([g, l]) => `- [${g}](${BASE}${genrePath(g)}) : ${l.length} histoire${l.length > 1 ? 's' : ''}`));
        if (stories.length) lines.push('', '### Dernières histoires', ...stories.slice(0, 20).map((s) => `- [${s.titre || 'Sans titre'}](${BASE}${storyPath(s)}) — ${s.auteur || 'Auteur inconnu'}, ${s.categorie || 'Divers'}`));
        return `${LLMS_MARK[0]}\n${lines.join('\n')}\n${LLMS_MARK[1]}`;
    }

    function llmsFull(byGenre, stories, llmsTxt) {
        const manual = llmsTxt.replace(new RegExp(`${LLMS_MARK[0]}[\\s\\S]*?${LLMS_MARK[1]}\\n?`), '').trim();
        const items = stories.map((s) => `### ${s.titre || 'Sans titre'}\n- URL : ${BASE}${storyPath(s)}\n- Auteur : ${s.auteur || 'Auteur inconnu'} · Genre : ${s.categorie || 'Divers'}${s.date ? ` · Publié le ${s.date.slice(0, 10)}` : ''} · ${readingMinutes(s.contenu)} min\n\n${excerpt(s, 400)}`);
        return `${manual}\n\n## Histoires publiées (extraits)\n\nLe texte intégral de chaque histoire est sur sa page (${BASE}/histoires/). Les droits restent aux autrices et auteurs.\n\n${items.join('\n\n') || 'Aucune histoire publiée pour le moment.'}\n`;
    }

    return { page, card, storyPage, genrePage, indexPage, sitemap, atom, latestBlock, llmsSection, llmsFull, BASE, FEED_PATH };
}

export const replaceBetween = (text, [start, end], block) => {
    const re = new RegExp(`${start}[\\s\\S]*?${end}`);
    if (!re.test(text)) throw new Error(`marqueurs ${start} … ${end} absents`);
    return text.replace(re, () => block);
};

export const fileFor = (path) => path.endsWith('/') ? `${path}index.html` : `${path}.html`;

// Construit toutes les sorties (pures) à partir des histoires : { files: Map<relFile, content>, keep: Set<file>, pages }.
export function build(stories, { base, genres, indexHtml, llmsTxt, year } = {}) {
    const r = createRenderer({ base, genres, year });
    const sorted = [...stories].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const byGenre = new Map();
    for (const s of sorted) { const g = s.categorie || 'Divers'; byGenre.set(g, [...(byGenre.get(g) || []), s]); }
    const pages = [r.indexPage(byGenre, sorted), ...[...byGenre.entries()].map(([g, l]) => r.genrePage(g, l)), ...sorted.map(r.storyPage)];
    const files = new Map(pages.map((p) => [fileFor(p.path).replace(/^\//, ''), p.html]));
    files.set('sitemap.xml', r.sitemap([...STATIC_URLS.filter((p) => p !== '/histoires/').map((path) => ({ path })), ...pages.map((p) => ({ path: p.path, lastmod: p.lastmod }))]));
    files.set(FEED_PATH.slice(1), r.atom(sorted));
    if (indexHtml != null) files.set('index.html', replaceBetween(indexHtml, LATEST_MARK, r.latestBlock(byGenre, sorted)));
    if (llmsTxt != null) {
        files.set('llms.txt', replaceBetween(llmsTxt, LLMS_MARK, r.llmsSection(byGenre, sorted)));
        files.set('llms-full.txt', r.llmsFull(byGenre, sorted, llmsTxt));
    }
    return { files, keep: new Set(pages.map((p) => fileFor(p.path))), pages, byGenre, stories: sorted };
}

// Garde-fou de suppression massive. Renvoie un message d'erreur ou null.
export function shrinkGuard(existingStoryFiles, newStoryCount, deletedCount) {
    if (existingStoryFiles > 0 && newStoryCount === 0) return `la source renvoie 0 histoire alors que ${existingStoryFiles} page(s) existent`;
    if (existingStoryFiles > 1 && deletedCount / existingStoryFiles > 0.5) return `${deletedCount} page(s) sur ${existingStoryFiles} seraient supprimées (> 50 %)`;
    return null;
}

const isStoryFile = (f) => f.endsWith('.html') && f !== 'index.html';

export async function main(argv = process.argv.slice(2)) {
    const args = parseArgs(argv);
    const base = String(args.base || process.env.SITE_BASE_URL || 'https://loveink.site');
    const project = String(args.project || process.env.FIREBASE_PROJECT || 'love-ink');
    const DRY = args['dry-run'] === true;
    const out = args.out ? resolve(String(args.out)) : ROOT;
    const readOpt = (f) => existsSync(join(out, f)) ? readFileSync(join(out, f), 'utf8') : null;
    // Config éditoriale : toujours lue depuis le dépôt (data/ n'est pas déployé ni copié dans --out).
    const genresFile = join(ROOT, 'data/genres.json');
    const genres = existsSync(genresFile) ? JSON.parse(readFileSync(genresFile, 'utf8')) : {};
    const stories = args.fixture ? JSON.parse(readFileSync(resolve(String(args.fixture)), 'utf8')).map((s) => normalize(s, s.id)) : await fetchPublished(project);
    const { files, keep, byGenre } = build(stories, { base, genres, indexHtml: readOpt('index.html'), llmsTxt: readOpt('llms.txt') });

    for (const g of byGenre.keys()) if (!genres[g]?.intro) console.warn(`avertissement : genre « ${g} » sans intro dans data/genres.json`);

    const stats = { written: 0, unchanged: 0, deleted: 0 };
    const toDelete = [];
    const dirStories = join(out, 'histoires');
    const existingStoryFiles = existsSync(dirStories) ? readdirSync(dirStories).filter(isStoryFile).length : 0;
    for (const dir of ['histoires', 'histoires/genre']) {
        if (!existsSync(join(out, dir))) continue;
        for (const f of readdirSync(join(out, dir))) if (f.endsWith('.html') && !keep.has(`/${dir}/${f}`)) toDelete.push(join(dir, f));
    }
    const guard = shrinkGuard(existingStoryFiles, stories.length, toDelete.filter((f) => !f.includes('genre')).length);
    if (guard && !args['allow-shrink']) { console.error(`build-seo-pages : arrêt, ${guard}. Relancer avec --allow-shrink si c'est voulu.`); return 2; }

    for (const [rel, content] of files) {
        const file = join(out, rel);
        if (existsSync(file) && readFileSync(file, 'utf8') === content) { stats.unchanged++; continue; }
        stats.written++;
        if (DRY) { console.log('écrirait', rel); continue; }
        mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, content);
    }
    for (const rel of toDelete) { stats.deleted++; if (!DRY) unlinkSync(join(out, rel)); }
    console.log(`histoires publiées : ${stories.length}, genres : ${byGenre.size}, fichiers écrits : ${stats.written}, inchangés : ${stats.unchanged}, supprimés : ${stats.deleted}${DRY ? ' (dry-run)' : ''}`);
    return 0;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    main().then((code) => process.exit(code)).catch((e) => { console.error('build-seo-pages :', e.message); process.exit(1); });
}
