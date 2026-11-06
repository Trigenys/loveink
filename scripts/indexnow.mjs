#!/usr/bin/env node
// Notifie IndexNow (Bing, Yandex, Seznam, Naver ; utilisé par ChatGPT search) des URL nouvelles ou
// modifiées entre deux versions du sitemap. Sans différence : aucun appel (no-op).
//
// Usage : node scripts/indexnow.mjs [--previous <ancien sitemap.xml>] [--current sitemap.xml]
//                                   [--base https://loveink.site] [--key <clé>] [--dry-run]
// La clé est lue, dans l'ordre : --key, INDEXNOW_KEY, puis le fichier <32 hex>.txt à la racine
// (clé publique par conception : https://www.indexnow.org/documentation). Jamais dans /.well-known/
// car Firebase Hosting ignore `**/.*` (voir docs/engineering/lessons-learned.md).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENDPOINT = 'https://api.indexnow.org/indexnow';

export function parseArgs(argv) {
    const out = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (!a.startsWith('--')) continue;
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('--')) out[a.slice(2)] = true;
        else { out[a.slice(2)] = next; i++; }
    }
    return out;
}

/** Map loc → lastmod ('' si absent) depuis un sitemap XML. */
export function parseSitemap(xml) {
    const map = new Map();
    for (const m of (xml || '').matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)) map.set(m[1].trim(), (m[2] || '').trim());
    return map;
}

/** URL nouvelles ou dont le lastmod a changé. L'absence d'ancien sitemap = tout est nouveau. */
export function diffUrls(previousXml, currentXml) {
    const prev = parseSitemap(previousXml);
    const cur = parseSitemap(currentXml);
    return [...cur].filter(([loc, lastmod]) => !prev.has(loc) || prev.get(loc) !== lastmod).map(([loc]) => loc);
}

export function findKey(root = ROOT) {
    const f = readdirSync(root).find((n) => /^[0-9a-f]{32}\.txt$/.test(n));
    return f ? readFileSync(join(root, f), 'utf8').trim() : null;
}

export async function main(argv = process.argv.slice(2), fetchImpl = fetch) {
    const args = parseArgs(argv);
    const base = String(args.base || process.env.SITE_BASE_URL || 'https://loveink.site').replace(/\/$/, '');
    const current = resolve(String(args.current || join(ROOT, 'sitemap.xml')));
    const previous = args.previous ? resolve(String(args.previous)) : null;
    const key = String(args.key || process.env.INDEXNOW_KEY || findKey() || '');
    if (!/^[0-9a-f]{32}$/.test(key)) { console.error('indexnow : clé absente ou invalide (--key, INDEXNOW_KEY ou <clé>.txt à la racine).'); return 1; }
    if (!existsSync(current)) { console.error(`indexnow : sitemap introuvable : ${current}`); return 1; }

    const urls = diffUrls(previous && existsSync(previous) ? readFileSync(previous, 'utf8') : '', readFileSync(current, 'utf8')).filter((u) => u.startsWith(base));
    if (!urls.length) { console.log('indexnow : aucune URL nouvelle ou modifiée, rien à notifier.'); return 0; }
    const host = new URL(base).host;
    const body = { host, key, keyLocation: `${base}/${key}.txt`, urlList: urls.slice(0, 10000) };
    console.log(`indexnow : ${urls.length} URL à notifier${args['dry-run'] ? ' (dry-run)' : ''}`);
    if (args['dry-run']) { for (const u of urls) console.log(`  ${u}`); return 0; }
    const res = await fetchImpl(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) });
    if (res.status === 200 || res.status === 202) { console.log(`indexnow : accepté (${res.status}).`); return 0; }
    console.error(`indexnow : refus ${res.status} ${await res.text().catch(() => '')}`.trim());
    return 1;
}

if (pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main().then((c) => process.exit(c)).catch((e) => { console.error(e); process.exit(1); });
