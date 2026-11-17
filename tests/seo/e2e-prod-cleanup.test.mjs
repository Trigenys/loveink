// Garde-fous du nettoyage des comptes de test e2e en production (logique pure, sans Firebase).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_TEST_DOMAIN, LINKED_COLLECTIONS, canDelete, isTestEmail, specFor, validatePlan,
    validateTestDomain, verifyAccounts
} from '../../scripts/lib/e2e-test-accounts.mjs';

const D = DEFAULT_TEST_DOMAIN;
const live = (entries) => new Map(Object.entries(entries));

test('domaine de test : seul le TLD réservé .test est accepté', () => {
    assert.equal(validateTestDomain('loveink-e2e.test'), '');
    assert.equal(validateTestDomain('Sub.Loveink-E2E.test'), '');
    for (const bad of ['', 'gmail.com', 'loveink.app', 'x@loveink-e2e.test', 'test', '.test', 'loveink-e2e.test.com']) {
        assert.notEqual(validateTestDomain(bad), '', bad);
    }
});

test('e-mail de test : suffixe exact, insensible à la casse, partie locale obligatoire', () => {
    assert.ok(isTestEmail('flow.1@loveink-e2e.test', D));
    assert.ok(isTestEmail(' Flow.1@LOVEINK-E2E.TEST ', D));
    assert.ok(!isTestEmail('@loveink-e2e.test', D));
    assert.ok(!isTestEmail('flow@loveink-e2e.test.evil.com', D));
    assert.ok(!isTestEmail('flow@xloveink-e2e.test', D));
    assert.ok(!isTestEmail('', D));
    assert.ok(!isTestEmail(null, D));
});

test('comptes vérifiés en direct : un e-mail réel écarte le compte, même listé par le plan', () => {
    const plan = [{ uid: 'a' }, { uid: 'b' }, { uid: 'c' }, { uid: 'd' }, { uid: '' }];
    const { uids, refused } = verifyAccounts(plan, live({
        a: { authEmail: 'flow.a@loveink-e2e.test', profileEmail: 'flow.a@loveink-e2e.test' },
        b: { authEmail: 'vraie@gmail.com', profileEmail: 'flow.b@loveink-e2e.test' },
        c: { authEmail: null, profileEmail: 'flow.c@loveink-e2e.test', privateEmail: 'reel@gmail.com' },
        d: {}
    }), D);
    assert.deepEqual(uids, ['a']);
    assert.deepEqual(refused.map((r) => r.uid), ['b', 'c', 'd', '(vide)']);
});

test('compte Auth déjà supprimé mais profil de test restant : supprimable', () => {
    const { uids } = verifyAccounts([{ uid: 'p' }], live({ p: { authEmail: null, profileEmail: 'flow.p@loveink-e2e.test' } }), D);
    assert.deepEqual(uids, ['p']);
});

test('suppression d\'un document : seulement s\'il appartient encore à un compte de test', () => {
    const t = new Set(['t1', 't2']);
    const histoires = specFor('histoires', 'auteurId');
    assert.deepEqual(canDelete(histoires, 'h1', { auteurId: 't1' }, t), { ok: true, reason: '' });
    assert.equal(canDelete(histoires, 'h2', { auteurId: 'reel' }, t).ok, false);
    assert.equal(canDelete(histoires, 'h3', null, t).reason, 'déjà absent');

    const profils = specFor('utilisateurs', '(id)');
    assert.equal(canDelete(profils, 't1', { email: 'x' }, t).ok, true);
    assert.equal(canDelete(profils, 'reel', { email: 'x' }, t).ok, false);

    const conv = specFor('conversations', 'participants');
    assert.equal(canDelete(conv, 'c1', { participants: ['t1', 't2'] }, t).ok, true);
    assert.equal(canDelete(conv, 'c2', { participants: ['t1', 'reel'] }, t).reason, 'participant réel : conservé');
    assert.equal(canDelete(conv, 'c3', { participants: ['reel'] }, t).ok, false);

    assert.equal(canDelete(null, 'x', { a: 1 }, t).ok, false);
});

test('collections couvertes : profil et contact privé supprimés en dernier, traces conservées', () => {
    const names = LINKED_COLLECTIONS.map((s) => s.collection);
    assert.deepEqual(names.slice(-2), ['comptes_prives', 'utilisateurs']);
    for (const kept of ['sanctions', 'ops_logs']) assert.ok(!names.includes(kept), kept);
    assert.ok(Object.isFrozen(LINKED_COLLECTIONS) && Object.isFrozen(LINKED_COLLECTIONS[0]));
});

test('plan : projet, domaine et e-mails contrôlés avant toute lecture distante', () => {
    const ok = { mode: 'plan', project: 'love-ink', domain: D, accounts: [{ uid: 'a', email: 'flow.a@loveink-e2e.test' }] };
    assert.deepEqual(validatePlan(ok, { project: 'love-ink', domain: D }), []);
    assert.equal(validatePlan(ok, { project: 'autre', domain: D }).length, 1);
    assert.equal(validatePlan({ ...ok, domain: 'x.test' }, { project: 'love-ink', domain: D }).length, 1);
    assert.equal(validatePlan({ ...ok, accounts: [{ uid: 'b', email: 'vraie@gmail.com' }] }, { project: 'love-ink', domain: D }).length, 1);
    assert.equal(validatePlan({ mode: 'apply' }, { project: 'love-ink', domain: D }).length, 1);
    assert.equal(validatePlan(null, { project: 'love-ink', domain: D }).length, 1);
});
