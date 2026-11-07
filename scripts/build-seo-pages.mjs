#!/usr/bin/env node
// Génère des pages HTML statiques pour les histoires publiées (lisibles sans compte ni JavaScript,
// donc indexables par les moteurs et les crawlers IA), une page par genre, une page par auteur,
// les guides d'écriture (/ressources/), un index, le sitemap, le flux Atom, la section « Histoires »
// de llms.txt, llms-full.txt et le bloc « dernières histoires » de index.html.
// Source : Firestore REST (lecture publique des histoires `statut == "publie"`, aucune clé secrète).
// Textes éditoriaux : data/genres.json (pages de genre) et data/ressources.json (guides), versionnés.
// Idempotent : n'écrit un fichier que si son contenu change ; supprime les pages générées devenues orphelines.
// Usage : node scripts/build-seo-pages.mjs [--base https://loveink.site] [--project love-ink] [--dry-run]
//         [--fixture tests/seo/fixtures/stories.json] [--allow-shrink] [--out <dossier>]
// Garde-fou : si la source renvoie 0 histoire alors que des pages existent, ou si plus de la moitié des
// pages d'histoires seraient supprimées, le script s'arrête (code 2) sauf `--allow-shrink`.
// Vie privée : seul le pseudonyme public (`auteur`) est publié ; `auteurId` (uid) sert uniquement à
// regrouper les histoires d'un même auteur et n'apparaît dans aucune sortie ; un `auteur` qui ressemble
// à une adresse e-mail est remplacé par « Auteur inconnu ».
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'Love Ink';
// Pages statiques du sitemap hors pages générées. `/register` en est exclu : page de conversion sans
// contenu éditorial (elle reste indexable et accessible, simplement non promue).
const STATIC_URLS = ['/'];
const FEED_PATH = '/histoires/flux.xml'; // jamais sous /feed : robots.txt bloque ce préfixe.
const GUIDES_PATH = '/ressources/';
const PARENT_ORG_ID = 'https://www.trigenys.com/#org';
const UNKNOWN_AUTHOR = 'Auteur inconnu';
// Signatures qui ne désignent pas une personne : pas de page auteur.
const NON_PERSON = new Set(['', 'anonyme', 'auteur inconnu', 'inconnu']);
const LATEST_MARK = ['<!-- seo:latest:start -->', '<!-- seo:latest:end -->'];
const LLMS_MARK = ['<!-- llms:histoires:start -->', '<!-- llms:histoires:end -->'];
// Dossiers entièrement possédés par le générateur (les .html orphelins y sont supprimés).
export const OWNED_DIRS = ['histoires', 'histoires/genre', 'histoires/auteur', 'ressources'];

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
export const publicName = (v) => { const s = String(v ?? '').replace(/\s+/g, ' ').trim(); return !s || s.includes('@') ? UNKNOWN_AUTHOR : s.slice(0, 60); };
export const normalize = (f, id) => ({ id, ...f, auteur: publicName(f.auteur), likes: Number(f.likes) || 0, date: toIso(f.date), dateModified: toIso(f.dateModification || f.updatedAt || f.date) });

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
const guidePath = (g) => `${GUIDES_PATH}${slug(g.slug)}`;
const clip = (t, n) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s\S*$/, '') + '…' : s; };
const excerpt = (story, n = 155) => clip(story.extrait || story.contenu, n);
const paragraphs = (t) => String(t || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('\n');
// Texte éditorial : échappé, puis liens internes `[texte](/chemin)` et `**gras**` uniquement.
const plainText = (t) => String(t || '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1');
const inline = (t) => esc(t).replace(/\[([^\]]+)\]\((\/[^)\s"]*)\)/g, '<a href="$2">$1</a>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
export const wordCount = (t) => (String(t || '').match(/[\p{L}\p{N}'’-]+/gu) || []).length;
const readingMinutes = (t) => Math.max(1, Math.round(wordCount(t) / 200));
const fmtDate = (iso) => iso ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(iso)) : '';
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
const latest = (list) => list.map((s) => s.dateModified || s.date).filter(Boolean).sort().pop() || null;
const maxDate = (...d) => d.filter(Boolean).map((x) => new Date(x).toISOString()).sort().pop() || null;
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
export const isPerson = (name) => !NON_PERSON.has(String(name || '').trim().toLowerCase());

// Regroupe les histoires par auteur (uid si présent, sinon pseudonyme) et attribue un slug lisible et
// unique tiré du pseudonyme. Homonymes : suffixe -2, -3… par ordre de première publication (stable).
export function groupAuthors(stories) {
    const groups = new Map();
    for (const s of stories) {
        if (!isPerson(s.auteur)) continue;
        // Sans uid : clé = pseudonyme normalisé (pas le slug, qui confondrait deux noms non latins).
        const key = s.auteurId ? `uid:${s.auteurId}` : `name:${s.auteur.normalize('NFC').toLowerCase()}`;
        const g = groups.get(key) || { key, stories: [] };
        g.stories.push(s);
        groups.set(key, g);
    }
    const first = (g) => g.stories.map((s) => s.date || '').filter(Boolean).sort()[0] || '9999';
    const ordered = [...groups.values()].sort((a, b) => first(a).localeCompare(first(b)) || a.key.localeCompare(b.key));
    const used = new Set();
    const byStory = new Map();
    const authors = [];
    for (const g of ordered) {
        // Pseudonyme le plus récent (le champ est un instantané à la publication).
        const recent = [...g.stories].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
        // Pseudonyme sans caractère latin : slug neutre « auteur » (le repli « divers » de slug() est réservé aux genres).
        const latin = /[a-z0-9]/i.test(recent.auteur.normalize('NFD').replace(/[̀-ͯ]/g, ''));
        const base = latin ? slug(recent.auteur).slice(0, 60).replace(/-$/, '') : 'auteur';
        let s = base;
        for (let i = 2; used.has(s); i++) s = `${base}-${i}`;
        used.add(s);
        const author = { name: recent.auteur, slug: s, path: `/histoires/auteur/${s}`, stories: g.stories };
        authors.push(author);
        for (const st of g.stories) byStory.set(st.id, author);
    }
    return { authors, byStory };
}

// Rend chaque valeur unique : les doublons passent au niveau de variante suivant jusqu'à disparition.
export function uniqueBy(items, variant, maxLevel = 2) {
    const level = new Map(items.map((x) => [x.id, 0]));
    for (let pass = 0; pass <= maxLevel; pass++) {
        const values = new Map();
        for (const x of items) { const v = variant(x, level.get(x.id)); values.set(v, [...(values.get(v) || []), x]); }
        const dups = [...values.values()].filter((l) => l.length > 1).flat();
        if (!dups.length) break;
        for (const x of dups) level.set(x.id, Math.min(maxLevel, level.get(x.id) + 1));
    }
    return new Map(items.map((x) => [x.id, variant(x, level.get(x.id))]));
}

export function createRenderer({ base = 'https://loveink.site', genres = {}, guides = [], year = new Date().getUTCFullYear(), authorOf = () => null, metaOf = null } = {}) {
    const BASE = String(base).replace(/\/$/, '');
    const OG_IMG = `${BASE}/images/og-love-ink.jpg`;
    const ORG = { '@type': 'Organization', '@id': `${BASE}/#organization`, name: SITE, url: `${BASE}/`, logo: { '@type': 'ImageObject', url: OG_IMG, width: 1200, height: 630 }, parentOrganization: { '@id': PARENT_ORG_ID } };
    const WEBSITE = { '@type': 'WebSite', '@id': `${BASE}/#website`, name: SITE, url: `${BASE}/` };
    const crumbs = (items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${BASE}${path}` })) });
    const itemList = (stories) => ({ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: stories.map((s, i) => ({ '@type': 'ListItem', position: i + 1, url: `${BASE}${storyPath(s)}`, name: s.titre || 'Sans titre' })) });
    const faqLd = (faq) => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((q) => ({ '@type': 'Question', name: q.q, acceptedAnswer: { '@type': 'Answer', text: plainText(q.a) } })) });
    const faqHtml = (faq) => faq?.length ? `        <section class="sp-faq"><h2>Questions fréquentes</h2>\n${faq.map((q) => `            <details><summary>${esc(q.q)}</summary><p>${inline(q.a)}</p></details>`).join('\n')}\n        </section>` : '';
    const guidesFor = (genre) => guides.filter((g) => (g.genres || []).includes(genre));
    const guideLinks = (list) => list.length ? `        <section class="sp-list sp-related"><h2>Pour aller plus loin</h2><ul class="sp-links">\n${list.map((g) => `            <li><a href="${guidePath(g)}">${esc(g.h1 || g.title)}</a></li>`).join('\n')}\n        </ul></section>` : '';

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
    <header class="sp-header"><a class="sp-brand" href="/">Love Ink</a><nav><a href="/histoires/">Histoires</a><a href="${GUIDES_PATH}">Guides</a><a href="/login">Connexion</a><a class="sp-cta" href="/register">Créer un compte</a></nav></header>
    <main class="sp-main">
${body}
    </main>
    <footer class="sp-footer"><p>© ${year} Love Ink – L'encre des cœurs · <a href="${GUIDES_PATH}">Guides d'écriture</a> · <a href="/conditions">Conditions</a> · <a href="/confidentialite">Confidentialité</a> · <a href="${FEED_PATH}">Flux Atom</a></p><p class="li-made-by">Made <em>by</em> <a href="https://trigenys.com" rel="noopener">Trigenys Group</a></p></footer>
</body>
</html>
`;
    }

    const card = (s) => `            <li class="sp-card"><a href="${storyPath(s)}"><h3>${esc(s.titre || 'Sans titre')}</h3><p class="sp-meta">${esc(s.auteur || UNKNOWN_AUTHOR)} · ${esc(s.categorie || 'Divers')} · ${readingMinutes(s.contenu)} min</p><p>${esc(excerpt(s, 120))}</p></a></li>`;

    // Variantes de title / description d'une histoire (niveau 0 = forme courte ; niveaux suivants = désambiguïsation).
    function storyMeta(s, level = 0) {
        const titre = s.titre || 'Sans titre';
        const genre = s.categorie || 'Divers';
        const date = fmtDate(s.date);
        const qualifier = level === 0 ? '' : level === 1 && date ? ` (${date})` : ` (${[date, s.id.slice(0, 6)].filter(Boolean).join(', ')})`;
        const title = `${titre}${qualifier} – histoire d'amour par ${s.auteur || 'un auteur Love Ink'} | Love Ink`;
        const ex = excerpt(s, 150);
        const description = level === 0 && ex.length >= 70 ? ex : clip(`${titre}${qualifier}, ${genre.toLowerCase()} par ${s.auteur || 'un auteur Love Ink'}, à lire gratuitement sur Love Ink. ${ex}`, 160);
        return { title, description };
    }

    function storyPage(s) {
        const path = storyPath(s);
        const genre = s.categorie || 'Divers';
        const author = authorOf(s);
        const { title, description } = metaOf?.(s) || storyMeta(s);
        const byline = author ? `<a href="${author.path}" rel="author">${esc(s.auteur)}</a>` : esc(s.auteur || UNKNOWN_AUTHOR);
        const body = `        <article class="sp-story">
            <p class="sp-kicker"><a href="/histoires/">Histoires</a> › <a href="${genrePath(genre)}">${esc(genre)}</a></p>
            <h1>${esc(s.titre || 'Sans titre')}</h1>
            <p class="sp-meta">Par ${byline}${s.date ? ` · <time datetime="${s.date}">${fmtDate(s.date)}</time>` : ''} · ${readingMinutes(s.contenu)} min de lecture</p>
            <div class="sp-content">
${paragraphs(s.contenu)}
            </div>
            <aside class="sp-react"><p>Cette histoire vous a touché ? Réagissez, commentez et suivez l'auteur sur Love Ink.</p><a class="sp-cta" href="/histoire?id=${esc(s.id)}">Lire dans l'application</a> <a class="sp-link" href="/register">Créer un compte gratuit</a></aside>
        </article>`;
        const article = {
            '@context': 'https://schema.org', '@type': 'Article', additionalType: 'https://schema.org/ShortStory', '@id': `${BASE}${path}#article`,
            headline: s.titre || 'Sans titre', description, url: `${BASE}${path}`,
            author: { '@type': 'Person', name: s.auteur || UNKNOWN_AUTHOR, ...(author ? { '@id': `${BASE}${author.path}#person`, url: `${BASE}${author.path}` } : {}) },
            datePublished: s.date || undefined, dateModified: s.dateModified || s.date || undefined,
            articleSection: genre, genre, wordCount: wordCount(s.contenu), timeRequired: `PT${readingMinutes(s.contenu)}M`, isAccessibleForFree: true,
            inLanguage: 'fr', mainEntityOfPage: `${BASE}${path}`, image: OG_IMG, isPartOf: WEBSITE, publisher: ORG,
        };
        const meta = [s.date && `<meta property="article:published_time" content="${s.date}">`, (s.dateModified || s.date) && `<meta property="article:modified_time" content="${s.dateModified || s.date}">`, `<meta property="article:section" content="${esc(genre)}">`, `<meta property="article:author" content="${esc(s.auteur || UNKNOWN_AUTHOR)}">`].filter(Boolean).map((m) => `    ${m}\n`).join('');
        const jsonLd = [article, crumbs([['Accueil', '/'], ['Histoires', '/histoires/'], [genre, genrePath(genre)], [s.titre || 'Sans titre', path]])];
        return { path, html: page({ title, description, path, body, jsonLd, type: 'article', meta }), lastmod: s.dateModified || s.date };
    }

    function genrePage(name, stories) {
        const path = genrePath(name);
        const g = genres[name] || {};
        const title = `${name} : histoires d'amour à lire gratuitement | Love Ink`;
        const description = g.description || `${plural(stories.length, 'histoire')} d'amour « ${name} » à lire gratuitement en français sur Love Ink, écrites par la communauté.`;
        const intro = g.intro ? paragraphs(g.intro) : `<p class="sp-lead">${esc(description)}</p>`;
        const best = stories.filter((s) => s.likes > 0).sort((a, b) => b.likes - a.likes || (b.date || '').localeCompare(a.date || '')).slice(0, 3);
        const bestHtml = stories.length > 1 && best.length ? `        <section class="sp-list"><h2>Les plus appréciées</h2><ul>\n${best.map(card).join('\n')}\n        </ul></section>\n` : '';
        const listHtml = stories.length
            ? `        <section class="sp-list"><h2>Toutes les histoires « ${esc(name)} »</h2><ul>\n${stories.map(card).join('\n')}\n        </ul></section>`
            : `        <section class="sp-list"><h2>Toutes les histoires « ${esc(name)} »</h2><p class="sp-lead">Les premières histoires de ce genre arrivent bientôt. <a href="/register">Écrivez la première</a> : chaque texte est relu avec bienveillance avant publication.</p></section>`;
        const body = `        <section><p class="sp-kicker"><a href="/histoires/">Histoires</a> › Genre</p><h1>${esc(name)}</h1><div class="sp-intro">${intro}</div></section>
${bestHtml}${listHtml}
${guideLinks(guidesFor(name))}
${faqHtml(g.faq)}`;
        const jsonLd = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description, url: `${BASE}${path}`, inLanguage: 'fr', isPartOf: WEBSITE, mainEntity: itemList(stories) }, crumbs([['Accueil', '/'], ['Histoires', '/histoires/'], [name, path]])];
        if (g.faq?.length) jsonLd.push(faqLd(g.faq));
        return { path, html: page({ title, description, path, body, jsonLd }), lastmod: maxDate(latest(stories), g.updated) };
    }

    function authorPage(a) {
        const path = a.path;
        const stories = a.stories;
        const genresList = [...new Set(stories.map((s) => s.categorie || 'Divers'))];
        const title = `${a.name} : histoires d'amour publiées sur Love Ink`;
        const description = clip(`${plural(stories.length, 'histoire')} d'amour de ${a.name} à lire gratuitement sur Love Ink (${genresList.join(', ').toLowerCase()}), relues avant publication.`, 160);
        const body = `        <section class="sp-list"><p class="sp-kicker"><a href="/histoires/">Histoires</a> › Auteur</p><h1>${esc(a.name)}</h1>
        <p class="sp-lead">${esc(plural(stories.length, 'histoire publiée'))} sur Love Ink · Genres : ${genresList.map((g) => `<a href="${genrePath(g)}">${esc(g)}</a>`).join(', ')}.</p>
        <ul>
${stories.map(card).join('\n')}
        </ul></section>`;
        const url = `${BASE}${path}`;
        const jsonLd = [
            { '@context': 'https://schema.org', '@type': 'ProfilePage', name: title, description, url, inLanguage: 'fr', isPartOf: WEBSITE, dateModified: latest(stories) || undefined, mainEntity: { '@type': 'Person', '@id': `${url}#person`, name: a.name, url } },
            itemList(stories),
            crumbs([['Accueil', '/'], ['Histoires', '/histoires/'], [a.name, path]]),
        ];
        return { path, html: page({ title, description, path, body, jsonLd, type: 'profile' }), lastmod: latest(stories) };
    }

    function guidePage(gd, byGenre) {
        const path = guidePath(gd);
        const url = `${BASE}${path}`;
        const fromGenre = gd.storiesFrom ? (byGenre.get(gd.storiesFrom) || []).slice(0, 6) : [];
        const section = (sc) => [
            `        <section class="sp-guide-section">`,
            sc.h2 && `            <h2>${esc(sc.h2)}</h2>`,
            ...(sc.p || []).map((p) => `            <p>${inline(p)}</p>`),
            sc.ul?.length && `            <ul>\n${sc.ul.map((li) => `                <li>${inline(li)}</li>`).join('\n')}\n            </ul>`,
            sc.ol?.length && `            <ol>\n${sc.ol.map((li) => `                <li>${inline(li)}</li>`).join('\n')}\n            </ol>`,
            ...(sc.examples || []).map((ex) => `            <figure class="sp-example">${ex.title ? `<figcaption>${esc(ex.title)}</figcaption>` : ''}<blockquote>${ex.text.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('')}</blockquote></figure>`),
            `        </section>`,
        ].filter(Boolean).join('\n');
        const storiesHtml = gd.storiesFrom ? (fromGenre.length
            ? `        <section class="sp-list"><h2>${esc(gd.storiesTitle || `À lire : « ${gd.storiesFrom} »`)}</h2><ul>\n${fromGenre.map(card).join('\n')}\n        </ul><p><a href="${genrePath(gd.storiesFrom)}">Toutes les histoires « ${esc(gd.storiesFrom)} »</a></p></section>`
            : `        <section class="sp-list"><h2>${esc(gd.storiesTitle || `À lire : « ${gd.storiesFrom} »`)}</h2><p class="sp-lead">Les premiers textes de la communauté arrivent bientôt sur la page <a href="${genrePath(gd.storiesFrom)}">${esc(gd.storiesFrom)}</a>.</p></section>`) : '';
        const genreLinks = (gd.genres || []).length ? `        <section class="sp-list sp-related"><h2>Genres liés</h2><ul class="sp-links">\n${gd.genres.map((g) => `            <li><a href="${genrePath(g)}">${esc(g)}</a></li>`).join('\n')}\n        </ul></section>` : '';
        const others = guides.filter((x) => x.slug !== gd.slug);
        const body = `        <article class="sp-guide"><p class="sp-kicker"><a href="${GUIDES_PATH}">Guides</a> › Écriture</p><h1>${esc(gd.h1 || gd.title)}</h1>
        <p class="sp-lead">${inline(gd.lead)}</p>
${(gd.sections || []).map(section).join('\n')}
        </article>
${storiesHtml}
${genreLinks}
${faqHtml(gd.faq)}
        <aside class="sp-react"><p>Envie de partager votre texte ? Sur Love Ink, chaque histoire est relue avec bienveillance avant publication.</p><a class="sp-cta" href="/register">Publier mon histoire</a>${others.length ? ` <a class="sp-link" href="${guidePath(others[0])}">${esc(others[0].h1 || others[0].title)}</a>` : ''}</aside>`;
        const jsonLd = [
            { '@context': 'https://schema.org', '@type': 'Article', '@id': `${url}#article`, headline: gd.h1 || gd.title, description: gd.description, url, mainEntityOfPage: url, inLanguage: 'fr', wordCount: wordCount(JSON.stringify(gd.sections || [])), datePublished: gd.published || gd.updated, dateModified: gd.updated, author: ORG, publisher: ORG, isPartOf: WEBSITE, image: OG_IMG, isAccessibleForFree: true },
            crumbs([['Accueil', '/'], ['Guides', GUIDES_PATH], [gd.h1 || gd.title, path]]),
        ];
        if (gd.faq?.length) jsonLd.push(faqLd(gd.faq));
        return { path, html: page({ title: gd.title, description: gd.description, path, body, jsonLd, type: 'article' }), lastmod: maxDate(gd.updated, latest(fromGenre)) };
    }

    function guidesIndex() {
        const path = GUIDES_PATH;
        const title = "Guides d'écriture : lettres et histoires d'amour | Love Ink";
        const description = "Guides gratuits pour écrire une lettre ou une histoire d'amour en français : méthode, exemples, idées et conseils de la communauté Love Ink.";
        const body = `        <section class="sp-list"><p class="sp-kicker"><a href="/">Accueil</a> › Guides</p><h1>Guides d'écriture</h1><p class="sp-lead">${esc(description)}</p>
        <ul>
${guides.map((g) => `            <li class="sp-card"><a href="${guidePath(g)}"><h3>${esc(g.h1 || g.title)}</h3><p>${esc(g.description)}</p></a></li>`).join('\n')}
        </ul></section>`;
        const jsonLd = [
            { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description, url: `${BASE}${path}`, inLanguage: 'fr', isPartOf: WEBSITE, mainEntity: { '@type': 'ItemList', itemListElement: guides.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: `${BASE}${guidePath(g)}`, name: g.h1 || g.title })) } },
            crumbs([['Accueil', '/'], ['Guides', path]]),
        ];
        return { path, html: page({ title, description, path, body, jsonLd }), lastmod: maxDate(...guides.map((g) => g.updated)) };
    }

    function indexPage(byGenre, stories, allGenres = [...byGenre.keys()]) {
        const path = '/histoires/';
        const title = "Toutes les histoires d'amour à lire gratuitement | Love Ink";
        const description = `${plural(stories.length, 'histoire')} d'amour en français, écrites par la communauté Love Ink et relues avant publication. Lecture gratuite, sans compte.`;
        const sections = [...byGenre.entries()].map(([g, list]) => `        <section class="sp-list"><h2><a href="${genrePath(g)}">${esc(g)}</a></h2><ul>\n${list.slice(0, 6).map(card).join('\n')}\n        </ul></section>`).join('\n');
        const genreNav = allGenres.length ? `        <p class="sp-lead">Par genre : ${allGenres.map((g) => `<a href="${genrePath(g)}">${esc(g)}</a>`).join(' · ')}</p>\n` : '';
        const guidesNav = guides.length ? `        <p class="sp-lead">Guides : ${guides.map((g) => `<a href="${guidePath(g)}">${esc(g.h1 || g.title)}</a>`).join(' · ')}</p>\n` : '';
        const body = `        <p class="sp-kicker"><a href="/">Accueil</a> › Bibliothèque</p><h1>Histoires d'amour à lire</h1><p class="sp-lead">${esc(description)}</p>
${genreNav}${sections || '        <p class="sp-lead">Les premières histoires arrivent bientôt. <a href="/register">Écrivez la vôtre.</a></p>'}
${guidesNav}`;
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
    <author><name>${esc(s.auteur || UNKNOWN_AUTHOR)}</name></author>
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
        const guidesHtml = guides.length ? `\n                <p class="lp-latest__genres">Guides : ${guides.map((g) => `<a href="${guidePath(g).slice(1)}">${esc(g.h1 || g.title)}</a>`).join(' · ')}</p>` : '';
        if (!stories.length) return `${LATEST_MARK[0]}\n                <p class="lp-lead">Les premières histoires arrivent. <a href="histoires/">Voir la bibliothèque</a> ou <a href="register.html">écrire la vôtre</a>.</p>${guidesHtml}\n                ${LATEST_MARK[1]}`;
        const items = stories.slice(0, 6).map((s) => `                    <li><a href="${storyPath(s).slice(1)}"><strong>${esc(s.titre || 'Sans titre')}</strong><span>${esc(s.auteur || UNKNOWN_AUTHOR)} · ${esc(s.categorie || 'Divers')} · ${readingMinutes(s.contenu)} min</span></a></li>`).join('\n');
        const genresHtml = [...byGenre.keys()].map((g) => `<a href="${genrePath(g).slice(1)}">${esc(g)}</a>`).join(' · ');
        return `${LATEST_MARK[0]}\n                <ul class="lp-latest">\n${items}\n                </ul>\n                <p class="lp-latest__genres">Par genre : ${genresHtml}</p>${guidesHtml}\n                ${LATEST_MARK[1]}`;
    }

    function llmsSection(byGenre, stories, allGenres = [...byGenre.keys()], authors = []) {
        const lines = [`## Histoires publiées`, `- [Bibliothèque](${BASE}/histoires/) : toutes les histoires, lisibles sans compte`, `- [Flux Atom](${BASE}${FEED_PATH})`];
        if (allGenres.length) lines.push('', '### Genres', ...allGenres.map((g) => { const n = (byGenre.get(g) || []).length; return `- [${g}](${BASE}${genrePath(g)}) : ${n ? plural(n, 'histoire') : 'premières histoires à venir'}`; }));
        if (stories.length) lines.push('', '### Dernières histoires', ...stories.slice(0, 20).map((s) => `- [${s.titre || 'Sans titre'}](${BASE}${storyPath(s)}) — ${s.auteur || UNKNOWN_AUTHOR}, ${s.categorie || 'Divers'}`));
        if (authors.length) lines.push('', '### Auteurs', ...authors.slice(0, 20).map((a) => `- [${a.name}](${BASE}${a.path}) : ${plural(a.stories.length, 'histoire')}`));
        if (guides.length) lines.push('', "### Guides d'écriture", `- [Tous les guides](${BASE}${GUIDES_PATH})`, ...guides.map((g) => `- [${g.h1 || g.title}](${BASE}${guidePath(g)}) : ${g.description}`));
        return `${LLMS_MARK[0]}\n${lines.join('\n')}\n${LLMS_MARK[1]}`;
    }

    function llmsFull(byGenre, stories, llmsTxt) {
        const manual = llmsTxt.replace(new RegExp(`${LLMS_MARK[0]}[\\s\\S]*?${LLMS_MARK[1]}\\n?`), '').trim();
        const items = stories.map((s) => `### ${s.titre || 'Sans titre'}\n- URL : ${BASE}${storyPath(s)}\n- Auteur : ${s.auteur || UNKNOWN_AUTHOR} · Genre : ${s.categorie || 'Divers'}${s.date ? ` · Publié le ${s.date.slice(0, 10)}` : ''} · ${readingMinutes(s.contenu)} min\n\n${excerpt(s, 400)}`);
        const guideItems = guides.map((g) => `### ${g.h1 || g.title}\n- URL : ${BASE}${guidePath(g)}\n\n${g.description}${(g.sections || []).length ? `\n\nSections : ${g.sections.map((x) => x.h2).filter(Boolean).join(' ; ')}.` : ''}`);
        return `${manual}\n\n## Histoires publiées (extraits)\n\nLe texte intégral de chaque histoire est sur sa page (${BASE}/histoires/). Les droits restent aux autrices et auteurs.\n\n${items.join('\n\n') || 'Aucune histoire publiée pour le moment.'}\n${guideItems.length ? `\n## Guides d'écriture\n\n${guideItems.join('\n\n')}\n` : ''}`;
    }

    return { page, card, storyMeta, storyPage, genrePage, authorPage, guidePage, guidesIndex, indexPage, sitemap, atom, latestBlock, llmsSection, llmsFull, BASE, FEED_PATH };
}

export const replaceBetween = (text, [start, end], block) => {
    const re = new RegExp(`${start}[\\s\\S]*?${end}`);
    if (!re.test(text)) throw new Error(`marqueurs ${start} … ${end} absents`);
    return text.replace(re, () => block);
};

export const fileFor = (path) => path.endsWith('/') ? `${path}index.html` : `${path}.html`;
const guideList = (ressources) => (Array.isArray(ressources) ? ressources : ressources?.pages || []).filter((g) => g?.slug && g.title);

// Construit toutes les sorties (pures) à partir des histoires : { files: Map<relFile, content>, keep: Set<file>, pages }.
export function build(stories, { base, genres = {}, ressources, indexHtml, llmsTxt, year } = {}) {
    const sorted = [...stories].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const guides = guideList(ressources);
    const { authors, byStory } = groupAuthors(sorted);
    const byGenre = new Map();
    for (const s of sorted) { const g = s.categorie || 'Divers'; byGenre.set(g, [...(byGenre.get(g) || []), s]); }
    // Pages de genre : genres éditorialisés (data/genres.json, même vides) puis genres rencontrés dans les histoires.
    const allGenres = [...new Set([...Object.keys(genres).filter((g) => !g.startsWith('_') && genres[g]?.intro), ...byGenre.keys()])];
    const probe = createRenderer({ base, genres, guides, year });
    const titles = uniqueBy(sorted, (s, l) => probe.storyMeta(s, l).title);
    const descriptions = uniqueBy(sorted, (s, l) => probe.storyMeta(s, l).description);
    const r = createRenderer({ base, genres, guides, year, authorOf: (s) => byStory.get(s.id) || null, metaOf: (s) => ({ title: titles.get(s.id), description: descriptions.get(s.id) }) });
    const pages = [
        r.indexPage(byGenre, sorted, allGenres),
        ...allGenres.map((g) => r.genrePage(g, byGenre.get(g) || [])),
        ...(guides.length ? [r.guidesIndex(), ...guides.map((g) => r.guidePage(g, byGenre))] : []),
        ...authors.map(r.authorPage),
        ...sorted.map(r.storyPage),
    ];
    const files = new Map(pages.map((p) => [fileFor(p.path).replace(/^\//, ''), p.html]));
    files.set('sitemap.xml', r.sitemap([...STATIC_URLS.map((path) => ({ path })), ...pages.map((p) => ({ path: p.path, lastmod: p.lastmod }))]));
    files.set(FEED_PATH.slice(1), r.atom(sorted));
    if (indexHtml != null) files.set('index.html', replaceBetween(indexHtml, LATEST_MARK, r.latestBlock(byGenre, sorted)));
    if (llmsTxt != null) {
        files.set('llms.txt', replaceBetween(llmsTxt, LLMS_MARK, r.llmsSection(byGenre, sorted, allGenres, authors)));
        files.set('llms-full.txt', r.llmsFull(byGenre, sorted, llmsTxt));
    }
    return { files, keep: new Set(pages.map((p) => fileFor(p.path))), pages, byGenre, authors, guides, stories: sorted };
}

// Garde-fou de suppression massive. Renvoie un message d'erreur ou null.
export function shrinkGuard(existingStoryFiles, newStoryCount, deletedCount) {
    if (existingStoryFiles > 0 && newStoryCount === 0) return `la source renvoie 0 histoire alors que ${existingStoryFiles} page(s) existent`;
    if (existingStoryFiles > 1 && deletedCount / existingStoryFiles > 0.5) return `${deletedCount} page(s) sur ${existingStoryFiles} seraient supprimées (> 50 %)`;
    return null;
}

const isStoryFile = (f) => f.endsWith('.html') && f !== 'index.html';
const readJson = (f, fallback) => existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : fallback;

export async function main(argv = process.argv.slice(2)) {
    const args = parseArgs(argv);
    const base = String(args.base || process.env.SITE_BASE_URL || 'https://loveink.site');
    const project = String(args.project || process.env.FIREBASE_PROJECT || 'love-ink');
    const DRY = args['dry-run'] === true;
    const out = args.out ? resolve(String(args.out)) : ROOT;
    const readOpt = (f) => existsSync(join(out, f)) ? readFileSync(join(out, f), 'utf8') : null;
    // Config éditoriale : toujours lue depuis le dépôt (data/ n'est pas déployé ni copié dans --out).
    const genres = readJson(join(ROOT, 'data/genres.json'), {});
    const ressources = readJson(join(ROOT, 'data/ressources.json'), { pages: [] });
    const stories = args.fixture ? JSON.parse(readFileSync(resolve(String(args.fixture)), 'utf8')).map((s) => normalize(s, s.id)) : await fetchPublished(project);
    const { files, keep, byGenre } = build(stories, { base, genres, ressources, indexHtml: readOpt('index.html'), llmsTxt: readOpt('llms.txt') });

    for (const g of byGenre.keys()) if (!genres[g]?.intro) console.warn(`avertissement : genre « ${g} » sans intro dans data/genres.json`);

    const stats = { written: 0, unchanged: 0, deleted: 0 };
    const toDelete = [];
    const dirStories = join(out, 'histoires');
    const existingStoryFiles = existsSync(dirStories) ? readdirSync(dirStories).filter(isStoryFile).length : 0;
    for (const dir of OWNED_DIRS) {
        if (!existsSync(join(out, dir))) continue;
        for (const f of readdirSync(join(out, dir))) if (f.endsWith('.html') && !keep.has(`/${dir}/${f}`)) toDelete.push({ dir, rel: `${dir}/${f}` });
    }
    const guard = shrinkGuard(existingStoryFiles, stories.length, toDelete.filter((d) => d.dir === 'histoires').length);
    if (guard && !args['allow-shrink']) { console.error(`build-seo-pages : arrêt, ${guard}. Relancer avec --allow-shrink si c'est voulu.`); return 2; }

    for (const [rel, content] of files) {
        const file = join(out, rel);
        if (existsSync(file) && readFileSync(file, 'utf8') === content) { stats.unchanged++; continue; }
        stats.written++;
        if (DRY) { console.log('écrirait', rel); continue; }
        mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, content);
    }
    for (const { rel } of toDelete) { stats.deleted++; if (!DRY) unlinkSync(join(out, rel)); }
    console.log(`histoires publiées : ${stories.length}, genres : ${byGenre.size}, fichiers écrits : ${stats.written}, inchangés : ${stats.unchanged}, supprimés : ${stats.deleted}${DRY ? ' (dry-run)' : ''}`);
    return 0;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    main().then((code) => process.exit(code)).catch((e) => { console.error('build-seo-pages :', e.message); process.exit(1); });
}
