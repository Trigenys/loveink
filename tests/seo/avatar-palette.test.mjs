// Avatars à initiales : couleur stable par pseudo et toujours dans la gamme du thème.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR_HUE_SPAN, AVATAR_HUE_START, getAvatarPalette } from '../../js/components/avatar-initials.js';

const hueOf = (css) => Number(/hsl\((\d+)/.exec(css)[1]);
const inThemeBand = (h) => ((h - AVATAR_HUE_START + 360) % 360) < AVATAR_HUE_SPAN;

test('getAvatarPalette : teintes limitées au thème, stables par pseudo', () => {
    for (const pseudo of ['claude_test', 'Marie', 'Jean Dupont', 'x', '', 'Ünïcødé 😊', 'a'.repeat(200)]) {
        const p = getAvatarPalette(pseudo);
        for (const k of ['background', 'color', 'border']) assert.ok(inThemeBand(hueOf(p[k])), `${pseudo} ${k} ${p[k]}`);
        assert.deepEqual(getAvatarPalette(pseudo), p);
    }
    const hues = new Set(Array.from({ length: 200 }, (_, i) => hueOf(getAvatarPalette(`user${i}`).background)));
    assert.ok(hues.size > 20, 'les pseudos restent distinguables');
});
