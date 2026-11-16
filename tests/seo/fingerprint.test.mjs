// Versionnement css/js (scripts/fingerprint-assets.mjs) : réécriture des pages, empreinte stable, idempotence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assetHash, fingerprint, rewriteHtml, versionedRef } from '../../scripts/fingerprint-assets.mjs';

const P = '/_v/abc';

test('versionedRef : seules les références vers css/ et js/ du site sont versionnées', () => {
    assert.equal(versionedRef('css/styles.css', '', P), '/_v/abc/css/styles.css');
    assert.equal(versionedRef('./js/core/a.js', '', P), '/_v/abc/js/core/a.js');
    assert.equal(versionedRef('/css/x.css', 'histoires/genre', P), '/_v/abc/css/x.css');
    assert.equal(versionedRef('../../js/a.js', 'histoires/genre', P), '/_v/abc/js/a.js');
    assert.equal(versionedRef('https://cdnjs.cloudflare.com/x/all.min.css', '', P), null);
    assert.equal(versionedRef('//fonts.example/x.css', '', P), null);
    assert.equal(versionedRef('favicon.svg?v=1', '', P), null);
    assert.equal(versionedRef('images/og.jpg', '', P), null);
    assert.equal(versionedRef('index.html', '', P), null);
    assert.equal(versionedRef('/_v/abc/css/x.css', '', P), null);
});

test('rewriteHtml : balises et imports de modules inline, le reste intact', () => {
    const html = `<link rel="stylesheet" href="css/a.css"><link rel="icon" href="favicon.svg">
<script src="js/core/b.js" defer></script><a href="register.html">x</a>
<script type="module">import { x } from './js/core/c.js'; const m = await import("./js/d.js");
import { y } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';</script>`;
    const out = rewriteHtml(html, '', P);
    assert.match(out, /href="\/_v\/abc\/css\/a\.css"/);
    assert.match(out, /src="\/_v\/abc\/js\/core\/b\.js"/);
    assert.match(out, /from '\/_v\/abc\/js\/core\/c\.js'/);
    assert.match(out, /import\("\/_v\/abc\/js\/d\.js"\)/);
    assert.match(out, /href="favicon\.svg"/);
    assert.match(out, /href="register\.html"/);
    assert.match(out, /from 'https:\/\/www\.gstatic\.com/);
    assert.equal(rewriteHtml(out, '', P), out, 'une seconde passe ne change rien');
});

test('assetHash : stable, indépendant de l\'ordre et des fins de ligne, sensible au contenu', () => {
    const a = [{ path: 'css/a.css', content: 'a{}\n' }, { path: 'js/b.js', content: 'b\n' }];
    const h = assetHash(a);
    assert.match(h, /^[0-9a-f]{12}$/);
    assert.equal(assetHash([...a].reverse()), h);
    assert.equal(assetHash([{ path: 'css/a.css', content: 'a{}\r\n' }, a[1]]), h);
    assert.notEqual(assetHash([{ path: 'css/a.css', content: 'a{ }\n' }, a[1]]), h);
});

test('fingerprint : copie sous _v/<hash>, réécrit les pages, idempotent', () => {
    const root = mkdtempSync(join(tmpdir(), 'li-fp-'));
    try {
        for (const d of ['css', 'js/core', 'histoires', 'tests']) mkdirSync(join(root, d), { recursive: true });
        writeFileSync(join(root, 'css/a.css'), 'a{}');
        writeFileSync(join(root, 'js/core/b.js'), "import './c.js';");
        writeFileSync(join(root, 'js/core/c.js'), '');
        writeFileSync(join(root, 'index.html'), '<link href="css/a.css"><script type="module">import "./js/core/b.js";</script>');
        writeFileSync(join(root, 'histoires/p.html'), '<link href="/css/a.css">');
        writeFileSync(join(root, 'tests/h.html'), '<link href="../css/a.css">');

        const r = fingerprint(root);
        assert.equal(r.pages, 2);
        assert.ok(existsSync(join(root, '_v', r.hash, 'js/core/c.js')), 'arborescence copiée : imports relatifs valides');
        assert.ok(existsSync(join(root, 'css/a.css')), 'fichiers d\'origine conservés');
        assert.match(readFileSync(join(root, 'index.html'), 'utf8'), new RegExp(`href="/_v/${r.hash}/css/a.css"`));
        assert.match(readFileSync(join(root, 'histoires/p.html'), 'utf8'), new RegExp(`/_v/${r.hash}/css/a.css`));
        assert.equal(readFileSync(join(root, 'tests/h.html'), 'utf8'), '<link href="../css/a.css">', 'dossiers exclus intacts');

        const again = fingerprint(root);
        assert.equal(again.hash, r.hash, 'la copie _v n\'entre pas dans l\'empreinte');
        assert.equal(again.pages, 0, 'seconde exécution sans réécriture');
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
