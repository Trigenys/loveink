// Non-régression (issue #7) : le nom d'auteur public d'une histoire ne doit jamais
// être dérivé de l'adresse e-mail (pages /histoires/auteur/<slug>, JSON-LD, URL).
// Lancer : node --test tests/seo/author-name.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePublicAuthorName, authorNameErrorMessage } from '../../js/core/public-author.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

const USER = { email: 'jeanne.dupont@example.com', displayName: null };

test('publication sans pseudo de profil : bloquée, aucune partie de l\'e-mail renvoyée', () => {
    for (const profile of [null, undefined, {}, { pseudo: '' }, { pseudo: '   ' }]) {
        const r = resolvePublicAuthorName(profile, USER);
        assert.deepEqual(r, { ok: false, reason: 'missing' });
        assert.ok(!JSON.stringify(r).includes('jeanne'), 'aucune donnée de l\'e-mail ne doit sortir');
    }
});

test('le nom affiché Firebase Auth seul ne suffit pas : seul le pseudo du profil compte', () => {
    const r = resolvePublicAuthorName({}, { ...USER, displayName: 'Jeanne Dupont' });
    assert.equal(r.ok, false);
});

test('pseudo reprenant l\'e-mail ou son identifiant : refusé', () => {
    for (const pseudo of ['jeanne.dupont', 'Jeanne.Dupont', ' jeanne.dupont ', 'jeanne.dupont@example.com', 'x@y']) {
        assert.deepEqual(resolvePublicAuthorName({ pseudo }, USER), { ok: false, reason: 'email' }, pseudo);
    }
});

test('pseudo de profil valide : utilisé tel quel (trim)', () => {
    assert.deepEqual(resolvePublicAuthorName({ pseudo: '  Plume du Soir ' }, USER), { ok: true, auteur: 'Plume du Soir' });
    assert.deepEqual(resolvePublicAuthorName({ pseudo: 'Jeanne' }, USER), { ok: true, auteur: 'Jeanne' });
    assert.deepEqual(resolvePublicAuthorName({ pseudo: 'Plume' }, { email: null }), { ok: true, auteur: 'Plume' });
});

test('messages d\'erreur clairs et orientés vers les paramètres', () => {
    assert.match(authorNameErrorMessage('missing'), /pseudonyme/);
    assert.match(authorNameErrorMessage('email'), /e-mail/);
});

test('publier.html : nom d\'auteur résolu par resolvePublicAuthorName, jamais depuis l\'e-mail', () => {
    const html = read('publier.html');
    assert.ok(!/email\s*(\?\.|\.)\s*split\s*\(\s*['"]@/.test(html), 'publier.html ne doit pas découper l\'e-mail');
    assert.match(html, /import\s*\{[^}]*resolvePublicAuthorName[^}]*\}\s*from\s*'\.\/js\/core\/public-author\.js'/);
    assert.match(html, /const auteur = authorName\.auteur;/);
    assert.match(html, /publierHistoire\(titre, categorie, contenuTexte, auteur,/);
});

test('parametres.html : le pseudo pré-rempli n\'est jamais dérivé de l\'e-mail', () => {
    assert.ok(!/email\s*(\?\.|\.)\s*split\s*\(\s*['"]@/.test(read('parametres.html')));
});
