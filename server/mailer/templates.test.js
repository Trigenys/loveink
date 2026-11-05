'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { templates } = require('./templates');
const { esc } = require('./templates/layout');

const ctx = { brandName: 'Love Ink', appBaseUrl: 'https://example.test', logoUrl: '', link: 'https://example.test/auth-action.html?mode=verifyEmail&oobCode=abc' };

test('verification : sujet, lien et pseudo échappé', () => {
    const m = templates.verification({ ...ctx, pseudo: '<b>Lee</b>' });
    assert.match(m.subject, /Confirmez votre adresse/);
    assert.ok(m.html.includes(esc(ctx.link)));
    assert.ok(m.text.includes(ctx.link));
    assert.ok(!m.html.includes('<b>Lee</b>'));
    assert.ok(m.html.includes('&lt;b&gt;Lee&lt;/b&gt;'));
});

test('passwordReset : sujet et lien', () => {
    const m = templates.passwordReset(ctx);
    assert.match(m.subject, /Réinitialisation/);
    assert.ok(m.html.includes(esc(ctx.link)) && m.text.includes(ctx.link));
    assert.ok(m.html.includes('#7a3e3e'));
});
