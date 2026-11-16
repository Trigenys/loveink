// Calculs du tableau de bord admin (js/core/admin-metrics.js) : normalisation, KPI, filtres, tri.
// Lancer : node --test tests/seo/admin-metrics.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMillis, lastActivityMs, toAccountRow, computeAccountKpis, filterRows, sortRows } from '../../js/core/admin-metrics.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 16, 12);
const ts = (ms) => ({ toMillis: () => ms });

const rows = [
    toAccountRow({ id: 'a', pseudo: 'Alice', email: 'alice@x.test', role: 'admin', dateInscription: ts(NOW - 2 * DAY), lastSeen: ts(NOW - DAY), nbHistoires: 3 }),
    toAccountRow({ id: 'b', pseudo: 'bob', dateInscription: ts(NOW - 20 * DAY), lastHeartbeat: ts(NOW - 10 * DAY), nbHistoires: 0 }),
    toAccountRow({ id: 'c', pseudo: 'Chloé', role: 'censeur', statut: 'suspendu', dateInscription: ts(NOW - 90 * DAY), lastSeen: ts(NOW - 60 * DAY) }),
    toAccountRow({ id: 'd', role: 'inconnu', dateInscription: null })
];

test('toMillis accepte Timestamp, {seconds}, Date, nombre et ISO ; null sinon', () => {
    assert.equal(toMillis(ts(5)), 5);
    assert.equal(toMillis({ toDate: () => new Date(7) }), 7);
    assert.equal(toMillis({ seconds: 2 }), 2000);
    assert.equal(toMillis(new Date(9)), 9);
    assert.equal(toMillis(11), 11);
    assert.equal(toMillis('1970-01-01T00:00:01Z'), 1000);
    for (const v of [null, undefined, '', 'pas une date', NaN]) assert.equal(toMillis(v), null);
});

test('dernière activité = le plus récent de lastSeen et lastHeartbeat', () => {
    assert.equal(lastActivityMs({ lastSeen: ts(10), lastHeartbeat: ts(20) }), 20);
    assert.equal(lastActivityMs({}), null);
});

test('toAccountRow : rôle inconnu ou absent -> user, statut par défaut actif, histoires inconnues -> null', () => {
    assert.equal(rows[3].role, 'user');
    assert.equal(rows[1].role, 'user');
    assert.equal(rows[3].statut, 'actif');
    assert.equal(rows[2].nbHistoires, null);
    assert.equal(rows[0].uid, 'a');
});

test('KPI : totaux, actifs/nouveaux 7 et 30 jours, répartition par rôle et statut', () => {
    const k = computeAccountKpis(rows, NOW);
    assert.equal(k.total, 4);
    assert.equal(k.actifs7, 1);
    assert.equal(k.actifs30, 2);
    assert.equal(k.nouveaux7, 1);
    assert.equal(k.nouveaux30, 2);
    assert.deepEqual(k.parRole, { user: 2, moderateur: 0, censeur: 1, admin: 1 });
    assert.deepEqual(k.parStatut, { actif: 3, suspendu: 1 });
});

test('filtres : texte (pseudo, e-mail, uid), rôle, statut, activité', () => {
    const ids = (list) => list.map((r) => r.uid);
    assert.deepEqual(ids(filterRows(rows, { texte: 'ALICE@' }, NOW)), ['a']);
    assert.deepEqual(ids(filterRows(rows, { texte: 'd' }, NOW)), ['d']);
    assert.deepEqual(ids(filterRows(rows, { role: 'user' }, NOW)), ['b', 'd']);
    assert.deepEqual(ids(filterRows(rows, { statut: 'suspendu' }, NOW)), ['c']);
    assert.deepEqual(ids(filterRows(rows, { activite: '7j' }, NOW)), ['a']);
    assert.deepEqual(ids(filterRows(rows, { activite: '30j' }, NOW)), ['a', 'b']);
    assert.deepEqual(ids(filterRows(rows, { activite: 'inactif30' }, NOW)), ['c', 'd']);
    assert.equal(filterRows(rows, {}, NOW).length, 4);
});

test('tri : sens, valeurs absentes toujours en fin, rôle par rang, clé inconnue sans effet', () => {
    const ids = (list) => list.map((r) => r.uid);
    assert.deepEqual(ids(sortRows(rows, 'inscription', 'desc')), ['a', 'b', 'c', 'd']);
    assert.deepEqual(ids(sortRows(rows, 'inscription', 'asc')), ['c', 'b', 'a', 'd']);
    assert.deepEqual(ids(sortRows(rows, 'pseudo', 'asc')), ['a', 'b', 'c', 'd']);
    assert.deepEqual(ids(sortRows(rows, 'nbHistoires', 'desc')), ['a', 'b', 'c', 'd']);
    assert.deepEqual(ids(sortRows(rows, 'role', 'desc')), ['a', 'c', 'b', 'd']);
    assert.deepEqual(ids(sortRows(rows, 'inexistant')), ['a', 'b', 'c', 'd']);
});
