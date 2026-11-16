// Plan d'amorçage admin (scripts/lib/admin-bootstrap-plan.mjs) : écarts minimaux, idempotence, refus des entrées invalides.
// Lancer : node --test tests/seo/admin-bootstrap.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planAdminBootstrap, planContactBackfill, validateInputs } from '../../scripts/lib/admin-bootstrap-plan.mjs';
import { parseArgs } from '../../scripts/admin-bootstrap.mjs';

const authUser = { uid: 'u1', email: 'jennifer@trigenys.com', displayName: '' };
const desired = { pseudo: 'Law Admin' };

test('profil inscrit sans rôle : rôle admin, pseudo, displayName et contact privé à écrire', () => {
    const plan = planAdminBootstrap({ authUser, profile: { pseudo: 'jennifer' }, contact: null }, desired);
    assert.equal(plan.converged, false);
    assert.deepEqual(plan.profileUpdate, { role: 'admin', roleUpdatedBy: 'admin_bootstrap', roleUpdateSource: 'admin_bootstrap', pseudo: 'Law Admin' });
    assert.deepEqual(plan.authUpdate, { displayName: 'Law Admin' });
    assert.deepEqual(plan.contactWrite, { uid: 'u1', email: 'jennifer@trigenys.com' });
    assert.equal(plan.profileCreate, null);
});

test('état convergé : plan vide (second passage = zéro écriture)', () => {
    const plan = planAdminBootstrap({
        authUser: { ...authUser, displayName: 'Law Admin' },
        profile: { pseudo: 'Law Admin', role: 'admin', roleUpdatedBy: 'x' },
        contact: { uid: 'u1', email: 'jennifer@trigenys.com' }
    }, desired);
    assert.equal(plan.converged, true);
    assert.deepEqual(plan.changes, []);
    assert.equal(plan.profileUpdate, null);
    assert.equal(plan.authUpdate, null);
    assert.equal(plan.contactWrite, null);
});

test('déjà admin : ne réécrit ni le rôle ni sa traçabilité, seulement le pseudo', () => {
    const plan = planAdminBootstrap({
        authUser: { ...authUser, displayName: 'Law Admin' },
        profile: { pseudo: 'Ancien', role: 'admin' },
        contact: { uid: 'u1', email: 'jennifer@trigenys.com' }
    }, desired);
    assert.deepEqual(plan.profileUpdate, { pseudo: 'Law Admin' });
});

test('profil absent : profil minimal créé, jamais de compte Auth', () => {
    const plan = planAdminBootstrap({ authUser, profile: null, contact: null }, desired);
    assert.equal(plan.profileCreate.role, 'admin');
    assert.equal(plan.profileCreate.pseudo, 'Law Admin');
    assert.equal(plan.profileCreate.statut, 'actif');
    assert.equal(plan.profileUpdate, null);
});

test('compte Auth requis', () => {
    assert.throws(() => planAdminBootstrap({ authUser: null, profile: null, contact: null }, desired));
});

test('rattrapage des e-mails : seuls les comptes absents ou divergents', () => {
    const contacts = new Map([
        ['u-a', { uid: 'u-a', email: 'a@x.test' }],
        ['u-b', { uid: 'u-b', email: 'old@x.test' }]
    ]);
    const plan = planContactBackfill([
        { uid: 'u-a', email: 'a@x.test' },
        { uid: 'u-b', email: 'b@x.test' },
        { uid: 'u-c', email: 'c@x.test' },
        { uid: 'u-d', email: '' }
    ], contacts);
    assert.deepEqual(plan, [
        { uid: 'u-b', email: 'b@x.test', from: 'old@x.test' },
        { uid: 'u-c', email: 'c@x.test', from: null }
    ]);
});

test('arguments : plan par défaut, --apply explicite, e-mail normalisé, entrées invalides refusées', () => {
    const args = parseArgs(['--email', ' Jennifer@Trigenys.com ', '--pseudo', 'Law Admin'], {});
    assert.equal(args.apply, false);
    assert.equal(args.email, 'jennifer@trigenys.com');
    assert.equal(args.project, 'love-ink');
    assert.equal(parseArgs(['--email', 'a@b.co', '--pseudo', 'X', '--apply', '--project', 'demo-x'], {}).apply, true);
    assert.throws(() => parseArgs(['--email', 'pas-un-mail', '--pseudo', 'X'], {}), /e-mail valide/);
    assert.throws(() => parseArgs(['--email', 'a@b.co'], {}), /pseudo/);
    assert.throws(() => parseArgs(['--email', 'a@b.co', '--pseudo', 'X', '--password', 'y'], {}), /Option inconnue/);
    assert.equal(validateInputs({ email: 'a@b.co', pseudo: 'x'.repeat(41) }).length, 1);
});
