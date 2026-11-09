// Coup de coeur editorial (#14) : bloc en page d'accueil, badge sur la page histoire, idempotence.
// Lancer : node --test tests/seo/coup-de-coeur.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, normalize, storyPath, pickCoupDeCoeur } from '../../scripts/build-seo-pages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const raw = JSON.parse(readFileSync(join(ROOT, 'tests/seo/fixtures/stories.json'), 'utf8'));
const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf8');
const opts = { base: 'https://example.test', indexHtml, year: 2026 };
const [first, second] = raw;
const withPick = raw.map((s) => s.id === second.id ? { ...s, coupDeCoeur: '2026-11-02T09:00:00.000Z' } : s.id === first.id ? { ...s, coupDeCoeur: '2026-10-26T09:00:00.000Z' } : s).map((s) => normalize(s, s.id));
const latest = (html) => html.slice(html.indexOf('<!-- seo:latest:start -->'), html.indexOf('<!-- seo:latest:end -->'));

test('sans coup de coeur : accueil et page histoire inchanges (pas de bloc, pas de badge)', () => {
    const out = build(raw.map((s) => normalize(s, s.id)), opts);
    assert.ok(!out.files.get('index.html').includes('lp-pick'));
    for (const [f, html] of out.files) if (f.startsWith('histoires/') && f !== 'histoires/index.html') assert.ok(!html.includes('sp-badge'), f);
});

test('la selection la plus recente est mise en avant, une seule fois sur l accueil', () => {
    assert.equal(pickCoupDeCoeur(withPick).id, second.id);
    const block = latest(build(withPick, opts).files.get('index.html'));
    const href = storyPath(withPick.find((s) => s.id === second.id)).slice(1);
    assert.ok(block.includes('Coup de cœur de la semaine'));
    assert.equal(block.split(`href="${href}"`).length - 1, 1, 'pas de doublon avec la liste des dernieres histoires');
    assert.ok(block.indexOf('lp-pick') < block.indexOf('lp-latest"'));
});

test('badge date sur les pages des histoires selectionnees (historique conserve)', () => {
    const out = build(withPick, opts);
    for (const s of withPick.filter((x) => x.coupDeCoeur)) {
        const html = out.files.get(`${storyPath(s).slice(1)}.html`);
        assert.ok(html.includes(`<p class="sp-badge">Coup de cœur Love Ink · <time datetime="${s.coupDeCoeur}">`), s.id);
    }
});

test('idempotent : reconstruire depuis l accueil genere donne le meme fichier', () => {
    const once = build(withPick, opts).files.get('index.html');
    assert.equal(build(withPick, { ...opts, indexHtml: once }).files.get('index.html'), once);
});

test('date de selection invalide ignoree', () => {
    assert.equal(normalize({ ...first, coupDeCoeur: 'pas une date' }, first.id).coupDeCoeur, null);
});
