// Barre de navigation : liens, état actif, recherche, raccourci, libellé de la cloche, reprise de lecture.
// Lancer : node --test tests/seo/nav-model.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    NAV_LINKS, SEARCH_MAX, activeLinkKey, normalizeQuery, searchHref, queryFromSearch,
    isSearchShortcut, bellLabel, resumeTarget
} from '../../js/components/nav-model.js';

test('liens : pas de doublon « Accueil » (le logo mène au fil)', () => {
    assert.deepEqual(NAV_LINKS.map((l) => l.key), ['categories', 'messagerie']);
    assert.ok(NAV_LINKS.every((l) => !/accueil/i.test(l.label)));
    assert.ok(Object.isFrozen(NAV_LINKS) && Object.isFrozen(NAV_LINKS[0]));
});

test('activeLinkKey : « Catégories » seulement si la section est visée ou visible', () => {
    assert.equal(activeLinkKey('feed'), null);
    assert.equal(activeLinkKey('feed', { hash: '#categories' }), 'categories');
    assert.equal(activeLinkKey('feed', { categoriesInView: true }), 'categories');
    assert.equal(activeLinkKey('feed', { hash: '#autre' }), null);
    assert.equal(activeLinkKey('messagerie'), 'messagerie');
    assert.equal(activeLinkKey('profil'), null);
    assert.equal(activeLinkKey(undefined), null);
});

test('normalizeQuery : espaces réduits, bornée, tolère null', () => {
    assert.equal(normalizeQuery('  Premier   amour \n'), 'Premier amour');
    assert.equal(normalizeQuery(null), '');
    assert.equal(normalizeQuery(undefined), '');
    assert.equal(normalizeQuery('x'.repeat(500)).length, SEARCH_MAX);
});

test('searchHref / queryFromSearch : aller-retour sans perte', () => {
    assert.equal(searchHref(''), 'feed.html');
    assert.equal(searchHref('   '), 'feed.html');
    const href = searchHref('Été & amour #1');
    assert.equal(href, 'feed.html?q=%C3%89t%C3%A9%20%26%20amour%20%231');
    assert.equal(queryFromSearch(href.slice(href.indexOf('?'))), 'Été & amour #1');
    assert.equal(queryFromSearch(''), '');
    assert.equal(queryFromSearch('?autre=1'), '');
    assert.equal(queryFromSearch(undefined), '');
});

test('isSearchShortcut : « / » hors saisie et sans modificateur', () => {
    assert.equal(isSearchShortcut({ key: '/' }, false), true);
    assert.equal(isSearchShortcut({ key: '/' }, true), false);
    assert.equal(isSearchShortcut({ key: '/', ctrlKey: true }, false), false);
    assert.equal(isSearchShortcut({ key: '/', metaKey: true }, false), false);
    assert.equal(isSearchShortcut({ key: '/', altKey: true }, false), false);
    assert.equal(isSearchShortcut({ key: '/', isComposing: true }, false), false);
    assert.equal(isSearchShortcut({ key: 'k' }, false), false);
    assert.equal(isSearchShortcut(null, false), false);
});

test('bellLabel : nombre de non lues annoncé, accord et plafond', () => {
    assert.equal(bellLabel(0), 'Notifications');
    assert.equal(bellLabel(-3), 'Notifications');
    assert.equal(bellLabel('abc'), 'Notifications');
    assert.equal(bellLabel(1), 'Notifications, 1 non lue');
    assert.equal(bellLabel(4), 'Notifications, 4 non lues');
    assert.equal(bellLabel(250), 'Notifications, plus de 99 non lues');
});

test('resumeTarget : lecture la plus récente avec un titre, lien encodé, pourcentage borné', () => {
    assert.equal(resumeTarget([]), null);
    assert.equal(resumeTarget(null), null);
    assert.equal(resumeTarget([{ id: 'a', ratio: 0.5, meta: null }]), null);
    const target = resumeTarget([
        { id: 'sans-meta', ratio: 0.3, meta: null },
        { id: 'a b', ratio: 0.426, meta: { titre: 'Nos étés' } },
        { id: 'c', ratio: 0.9, meta: { titre: 'Plus ancienne' } }
    ]);
    assert.deepEqual(target, { href: 'histoire.html?id=a%20b', title: 'Nos étés', percent: 43 });
    assert.equal(resumeTarget([{ id: 'x', ratio: 7, meta: { titre: 'T' } }]).percent, 100);
});
