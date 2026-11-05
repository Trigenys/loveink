'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { rewriteActionLink } = require('./link');

test('rewriteActionLink : origine et chemin remplacés, query conservée', () => {
    const raw = 'https://love-ink.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=abc&apiKey=k&continueUrl=https%3A%2F%2Flove-ink.web.app%2Ffeed.html&lang=fr';
    const out = new URL(rewriteActionLink(raw, 'https://love-ink.web.app/auth-action.html'));
    assert.strictEqual(out.origin + out.pathname, 'https://love-ink.web.app/auth-action.html');
    assert.strictEqual(out.searchParams.get('mode'), 'verifyEmail');
    assert.strictEqual(out.searchParams.get('oobCode'), 'abc');
    assert.strictEqual(out.searchParams.get('continueUrl'), 'https://love-ink.web.app/feed.html');
});
