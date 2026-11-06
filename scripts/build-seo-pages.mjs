#!/usr/bin/env node
// Génère des pages HTML statiques pour les histoires publiées (lisibles sans compte ni JavaScript,
// donc indexables par les moteurs et les crawlers IA), une page par genre, un index, et le sitemap.
// Source : Firestore REST (lecture publique des histoires `statut == "publie"`, aucune clé secrète).
// Idempotent : n'écrit un fichier que si son contenu change ; supprime les pages d'histoires retirées.
// Usage : node scripts/build-seo-pages.mjs [--base https://loveink.site] [--project love-ink] [--dry-run]
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : []).filter(Boolean));
const BASE = String(args.base || process.env.SITE_BASE_URL || 'https://loveink.site').replace(/\/$/, '');
const PROJECT = String(args.project || process.env.FIREBASE_PROJECT || 'love-ink');
const DRY = args['dry-run'] === true;
const OUT = join(ROOT, 'histoires');
const SITE = 'Love Ink';
const OG_IMG = `${BASE}/images/og-love-ink.jpg`;
const STATIC_URLS = ['/', '/register', '/histoires/'];

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
async function fetchPublished() {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`;
    const body = { structuredQuery: { from: [{ collectionId: 'histoires' }], where: { fieldFilter: { field: { fieldPath: 'statut' }, op: 'EQUAL', value: { stringValue: 'publie' } } }, limit: 1000 } };
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`Firestore ${r.status} : ${(await r.text()).slice(0, 200)}`);
    const rows = await r.json();
    if (rows[0]?.error) throw new Error(`Firestore : ${rows[0].error.message}`);
    return rows.filter((x) => x.document).map((x) => {
        const f = Object.fromEntries(Object.entries(x.document.fields || {}).map(([k, v]) => [k, decode(v)]));
        return { id: x.document.name.split('/').pop(), ...f, date: toIso(f.date) };
    });
}
const toIso = (d) => { const t = d ? new Date(d) : null; return t && !Number.isNaN(t) ? t.toISOString() : null; };

// --- Rendu --------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = (s) => String(s || 'divers').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'divers';
const excerpt = (story, n = 155) => { const t = String(story.extrait || story.contenu || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s\S*$/, '') + '…' : t; };
const paragraphs = (t) => String(t || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('\n');
const fmtDate = (iso) => iso ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(iso)) : '';
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

function page({ title, description, path, body, jsonLd, type = 'website' }) {
    const url = `${BASE}${path}`;
    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}">
    <link rel="canonical" href="${url}">
    <meta property="og:type" content="${type}">
    <meta property="og:site_name" content="${SITE}">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:url" content="${url}">
    <meta property="og:image" content="${OG_IMG}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:locale" content="fr_FR">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=20260325-brand3">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500&family=Pinyon+Script&display=swap">
    <link rel="stylesheet" href="/css/story-page.css">
    ${jsonLd ? ld(jsonLd) : ''}
</head>
<body>
    <header class="sp-header"><a class="sp-brand" href="/">Love Ink</a><nav><a href="/histoires/">Histoires</a><a href="/login">Connexion</a><a class="sp-cta" href="/register">Créer un compte</a></nav></header>
    <main class="sp-main">
${body}
    </main>
    <footer class="sp-footer"><p>© ${new Date().getUTCFullYear()} Love Ink – L'encre des cœurs · <a href="/conditions">Conditions</a> · <a href="/confidentialite">Confidentialité</a></p><p class="li-made-by">Made <em>by</em> <a href="https://trigenys.com" rel="noopener">Trigenys Group</a></p></footer>
</body>
</html>
`;
}

const card = (s) => `            <li class="sp-card"><a href="/histoires/${s.id}"><h3>${esc(s.titre || 'Sans titre')}</h3><p class="sp-meta">${esc(s.auteur || 'Auteur inconnu')} · ${esc(s.categorie || 'Divers')}</p><p>${esc(excerpt(s, 120))}</p></a></li>`;

function storyPage(s) {
    const path = `/histoires/${s.id}`;
    const title = `${s.titre || 'Sans titre'} – histoire d'amour par ${s.auteur || 'un auteur Love Ink'} | Love Ink`;
    const body = `        <article class="sp-story">
            <p class="sp-kicker"><a href="/histoires/genre/${slug(s.categorie)}">${esc(s.categorie || 'Divers')}</a></p>
            <h1>${esc(s.titre || 'Sans titre')}</h1>
            <p class="sp-meta">Par ${esc(s.auteur || 'Auteur inconnu')}${s.date ? ` · <time datetime="${s.date}">${fmtDate(s.date)}</time>` : ''}</p>
            <div class="sp-content">
${paragraphs(s.contenu)}
            </div>
            <aside class="sp-react"><p>Cette histoire vous a touché ? Réagissez, commentez et suivez l'auteur sur Love Ink.</p><a class="sp-cta" href="/histoire.html?id=${esc(s.id)}">Lire dans l'application</a> <a class="sp-link" href="/register">Créer un compte gratuit</a></aside>
        </article>`;
    const jsonLd = {
        '@context': 'https://schema.org', '@type': 'Article', headline: s.titre || 'Sans titre', description: excerpt(s),
        author: { '@type': 'Person', name: s.auteur || 'Auteur inconnu' }, datePublished: s.date || undefined, articleSection: s.categorie || undefined,
        inLanguage: 'fr', mainEntityOfPage: `${BASE}${path}`, image: OG_IMG,
        publisher: { '@type': 'Organization', name: SITE, url: `${BASE}/` },
    };
    return { path, html: page({ title, description: excerpt(s), path, body, jsonLd, type: 'article' }), lastmod: s.date };
}

function genrePage(name, stories) {
    const path = `/histoires/genre/${slug(name)}`;
    const title = `${name} : histoires d'amour à lire gratuitement | Love Ink`;
    const description = `${stories.length} histoire${stories.length > 1 ? 's' : ''} d'amour « ${name} » à lire gratuitement en français sur Love Ink, écrites par la communauté.`;
    const body = `        <section class="sp-list"><p class="sp-kicker">Genre</p><h1>${esc(name)}</h1><p class="sp-lead">${esc(description)}</p>
        <ul>
${stories.map(card).join('\n')}
        </ul></section>`;
    const jsonLd = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: `${BASE}${path}`, inLanguage: 'fr', isPartOf: { '@type': 'WebSite', name: SITE, url: `${BASE}/` } };
    return { path, html: page({ title, description, path, body, jsonLd }) };
}

function indexPage(byGenre, stories) {
    const path = '/histoires/';
    const title = "Toutes les histoires d'amour à lire gratuitement | Love Ink";
    const description = `${stories.length} histoire${stories.length > 1 ? 's' : ''} d'amour en français, écrites par la communauté Love Ink et relues avant publication. Lecture gratuite, sans compte.`;
    const sections = [...byGenre.entries()].map(([g, list]) => `        <section class="sp-list"><h2><a href="/histoires/genre/${slug(g)}">${esc(g)}</a></h2><ul>\n${list.slice(0, 6).map(card).join('\n')}\n        </ul></section>`).join('\n');
    const body = `        <p class="sp-kicker">Bibliothèque</p><h1>Histoires d'amour à lire</h1><p class="sp-lead">${esc(description)}</p>
${sections || '        <p class="sp-lead">Les premières histoires arrivent bientôt. <a href="/register">Écrivez la vôtre.</a></p>'}`;
    const jsonLd = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: `${BASE}${path}`, inLanguage: 'fr', isPartOf: { '@type': 'WebSite', name: SITE, url: `${BASE}/` } };
    return { path, html: page({ title, description, path, body, jsonLd }) };
}

function sitemap(entries) {
    const row = (loc, lastmod) => `  <url><loc>${esc(loc)}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ''}</url>`;
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map((e) => row(`${BASE}${e.path}`, e.lastmod)).join('\n')}\n</urlset>\n`;
}

// --- Écriture idempotente ------------------------------------------------
const stats = { written: 0, unchanged: 0, deleted: 0 };
function put(relFile, content) {
    const file = join(ROOT, relFile);
    if (existsSync(file) && readFileSync(file, 'utf8') === content) { stats.unchanged++; return; }
    stats.written++;
    if (DRY) return console.log('écrirait', relFile);
    mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, content);
}
const fileFor = (path) => path.endsWith('/') ? `${path}index.html` : `${path}.html`;

async function main() {
    const stories = (await fetchPublished()).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const byGenre = new Map();
    for (const s of stories) { const g = s.categorie || 'Divers'; byGenre.set(g, [...(byGenre.get(g) || []), s]); }

    const pages = [indexPage(byGenre, stories), ...[...byGenre.entries()].map(([g, l]) => genrePage(g, l)), ...stories.map(storyPage)];
    for (const p of pages) put(fileFor(p.path).replace(/^\//, ''), p.html);

    // Pages d'histoires retirées (dépubliées) : supprimées.
    const keep = new Set(pages.map((p) => fileFor(p.path)));
    for (const dir of ['histoires', 'histoires/genre']) {
        if (!existsSync(join(ROOT, dir))) continue;
        for (const f of readdirSync(join(ROOT, dir))) {
            if (!f.endsWith('.html') || keep.has(`/${dir}/${f}`)) continue;
            stats.deleted++; if (!DRY) unlinkSync(join(ROOT, dir, f));
        }
    }
    put('sitemap.xml', sitemap([...STATIC_URLS.map((path) => ({ path })), ...pages.filter((p) => p.path !== '/histoires/').map((p) => ({ path: p.path, lastmod: p.lastmod }))]));
    console.log(`histoires publiées : ${stories.length}, genres : ${byGenre.size}, fichiers écrits : ${stats.written}, inchangés : ${stats.unchanged}, supprimés : ${stats.deleted}${DRY ? ' (dry-run)' : ''}`);
}
main().catch((e) => { console.error('build-seo-pages :', e.message); process.exit(1); });
