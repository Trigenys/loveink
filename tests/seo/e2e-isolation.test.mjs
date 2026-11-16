// Garde-fous d'isolation des e2e : la production n'est jamais la cible par défaut.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
    EMULATOR_PROJECT_ID,
    configForTarget,
    isLocalHost,
    resolveFirebaseTarget
} from '../../js/core/firebase-target.js';

const require = createRequire(import.meta.url);
const { DEFAULT_BASE_URL, isLocalUrl, resolveE2eBaseUrl } = require('../e2e/helpers/target-guard.js');

test('e2e : la cible par défaut est l’émulateur local', () => {
    assert.equal(resolveE2eBaseUrl({}), DEFAULT_BASE_URL);
    assert.ok(isLocalUrl(DEFAULT_BASE_URL));
});

test('e2e : un hôte distant échoue immédiatement sans E2E_ALLOW_PROD=1', () => {
    for (const url of ['https://loveink.site', 'https://love-ink--preview-x.web.app', 'http://localhost.evil.com']) {
        assert.throws(() => resolveE2eBaseUrl({ E2E_BASE_URL: url }), /E2E_ALLOW_PROD=1/, url);
        assert.throws(() => resolveE2eBaseUrl({ E2E_BASE_URL: url, E2E_ALLOW_PROD: 'true' }), /E2E_ALLOW_PROD=1/, url);
    }
    assert.equal(resolveE2eBaseUrl({ E2E_BASE_URL: 'https://loveink.site', E2E_ALLOW_PROD: '1' }), 'https://loveink.site');
});

test('e2e : les hôtes locaux sont acceptés sans dérogation', () => {
    for (const url of ['http://127.0.0.1:5000', 'http://localhost:5000', 'http://[::1]:5000', 'http://app.localhost:5000']) {
        assert.equal(resolveE2eBaseUrl({ E2E_BASE_URL: url }), url);
    }
    assert.throws(() => resolveE2eBaseUrl({ E2E_BASE_URL: 'pas une url' }), /E2E_ALLOW_PROD=1/);
});

test('client : émulateurs sur hôte local, production ailleurs', () => {
    assert.equal(resolveFirebaseTarget({ hostname: '127.0.0.1' }), 'emulators');
    assert.equal(resolveFirebaseTarget({ hostname: 'localhost' }), 'emulators');
    assert.equal(resolveFirebaseTarget({ hostname: 'loveink.site' }), 'production');
    assert.equal(resolveFirebaseTarget({ hostname: 'love-ink.web.app' }), 'production');
    assert.equal(resolveFirebaseTarget(undefined), 'production');
    assert.equal(isLocalHost('localhost.evil.com'), false);
});

test('client : la dérogation locale vers la production est explicite', () => {
    const previous = globalThis.localStorage;
    globalThis.localStorage = { getItem: (key) => (key === 'loveInk_firebaseTarget' ? 'production' : null) };
    try {
        assert.equal(resolveFirebaseTarget({ hostname: '127.0.0.1' }), 'production');
    } finally {
        globalThis.localStorage = previous;
    }
});

test('client : les émulateurs tournent sous un projet demo-* (aucune ressource réelle)', () => {
    const prod = { projectId: 'love-ink', apiKey: 'k' };
    assert.match(EMULATOR_PROJECT_ID, /^demo-/);
    assert.deepEqual(configForTarget(prod, 'emulators'), { projectId: EMULATOR_PROJECT_ID, apiKey: 'k' });
    assert.equal(configForTarget(prod, 'production'), prod);
});
