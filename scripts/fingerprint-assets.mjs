// Versionnement des css/js pour Firebase Hosting, exécuté en CI (build_command) sur le checkout à déployer.
// css/ et js/ ne sont pas versionnés dans les sources : servis en cache long, un déploiement mélangerait
// nouveau HTML et anciens styles. On copie donc css/ et js/ sous _v/<hash du contenu>/ (cache immutable,
// voir firebase.json) et on fait pointer les pages HTML vers cette copie. Les imports relatifs entre modules
// restent valides puisque l'arborescence est copiée telle quelle. Les fichiers d'origine restent servis
// (no-cache) pour les pages déjà en cache chez les visiteurs. Sources et développement local inchangés.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ASSET_DIRS = ['css', 'js'];
export const VERSION_DIR = '_v';
const SKIP_DIRS = new Set(['node_modules', 'server', 'functions', 'tests', 'scripts', 'docs', 'tasks', 'data',
    'test-results', 'playwright-report', VERSION_DIR]);

const toPosix = (p) => p.split(sep).join('/');

function walk(dir, keep) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = join(dir, e.name);
        if (e.isDirectory()) return e.name.startsWith('.') || SKIP_DIRS.has(e.name) ? [] : walk(p, keep);
        return keep(e.name) ? [p] : [];
    });
}

// Empreinte stable : chemins triés + contenus, indépendante de l'OS (fins de ligne normalisées).
export function assetHash(files) {
    const h = createHash('sha256');
    for (const { path, content } of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
        h.update(path).update('\0').update(String(content).replace(/\r\n/g, '\n')).update('\0');
    }
    return h.digest('hex').slice(0, 12);
}

// Réécrit une référence si elle désigne un fichier de css/ ou js/ à la racine du site ; sinon null.
export function versionedRef(ref, pageDir, prefix) {
    if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(ref)) return null;
    const abs = ref.startsWith('/') ? posix.normalize(ref) : posix.normalize(posix.join('/', pageDir, ref));
    const top = abs.split('/')[1];
    return ASSET_DIRS.includes(top) && /\.(css|js)$/.test(abs.split(/[?#]/)[0]) ? `${prefix}${abs}` : null;
}

// href/src des balises et spécifieurs de modules (import ... from '...', import('...')) des scripts inline.
export function rewriteHtml(html, pageDir, prefix) {
    const swap = (whole, head, q, ref) => {
        const v = versionedRef(ref, pageDir, prefix);
        return v ? `${head}${q}${v}${q}` : whole;
    };
    return html
        .replace(/(\s(?:href|src)=)(["'])([^"']+)\2/g, swap)
        .replace(/(\bfrom\s*|\bimport\s*\(\s*)(["'])([^"']+)\2/g, swap);
}

export function fingerprint(root) {
    const assets = ASSET_DIRS.filter((d) => existsSync(join(root, d)))
        .flatMap((d) => walk(join(root, d), (n) => /\.(css|js)$/.test(n)))
        .map((p) => ({ path: toPosix(relative(root, p)), content: readFileSync(p, 'utf8') }));
    const hash = assetHash(assets);
    const prefix = `/${VERSION_DIR}/${hash}`;
    for (const d of ASSET_DIRS) if (existsSync(join(root, d))) cpSync(join(root, d), join(root, VERSION_DIR, hash, d), { recursive: true });
    let changed = 0;
    for (const page of walk(root, (n) => n.endsWith('.html'))) {
        const pageDir = toPosix(relative(root, join(page, '..')));
        const before = readFileSync(page, 'utf8');
        const after = rewriteHtml(before, pageDir, prefix);
        if (after !== before) { writeFileSync(page, after); changed++; }
    }
    return { hash, prefix, assets: assets.length, pages: changed };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const r = fingerprint(process.cwd());
    console.log(`fingerprint-assets : ${r.assets} fichiers css/js sous ${r.prefix}, ${r.pages} pages réécrites`);
}
