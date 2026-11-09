'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { sendPasswordReset } = require('./reset');

const err = (code, message = code) => Object.assign(new Error(message), { code });
const fakeAuth = ({ user = true, lookupErr, linkErr } = {}) => ({
    getUserByEmail: async () => { if (lookupErr) throw lookupErr; if (!user) throw err('auth/user-not-found'); return { uid: 'u1' }; },
    generatePasswordResetLink: async () => { if (linkErr) throw linkErr; return 'https://x/__/auth/action?oobCode=abc'; },
});

test('compte inconnu : aucun lien généré, aucun envoi, résultat "unknown"', async () => {
    const auth = fakeAuth({ user: false, linkErr: err('auth/internal-error', 'INTERNAL ASSERT FAILED: Unable to create the email action link') });
    let sent = 0;
    const r = await sendPasswordReset({ auth, deliver: async () => { sent++; }, email: 'nobody@example.com', continueUrl: 'https://a/login.html' });
    assert.strictEqual(r, 'unknown');
    assert.strictEqual(sent, 0);
});

test('compte existant : lien réécrit transmis à deliver', async () => {
    const calls = [];
    const r = await sendPasswordReset({ auth: fakeAuth(), deliver: async (...a) => { calls.push(a); }, email: 'a@b.co', continueUrl: 'https://a/login.html', toActionLink: (l) => l.replace('https://x', 'https://app') });
    assert.strictEqual(r, 'sent');
    assert.deepStrictEqual(calls, [['passwordReset', 'a@b.co', { link: 'https://app/__/auth/action?oobCode=abc' }]]);
});

test('panne Admin SDK ou Resend : l\'erreur remonte (repli 502 côté front)', async () => {
    await assert.rejects(sendPasswordReset({ auth: fakeAuth({ lookupErr: err('auth/internal-error') }), deliver: async () => {}, email: 'a@b.co', continueUrl: 'u' }));
    await assert.rejects(sendPasswordReset({ auth: fakeAuth(), deliver: async () => { throw new Error('resend 500'); }, email: 'a@b.co', continueUrl: 'u' }), /resend 500/);
});
