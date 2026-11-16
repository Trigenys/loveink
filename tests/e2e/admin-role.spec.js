// Rôle admin sur émulateurs : le premier admin est posé hors application (ici par l'API d'administration de
// l'émulateur, en production à la main dans la console Firebase), puis l'admin attribue un rôle depuis le profil.
const { test, expect } = require('@playwright/test');
const { makeUser, registerWithUi, loginWithUi, logoutFromNav, waitForAuthReady } = require('./helpers/app');

const FIRESTORE_EMULATOR = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const PROJECT_ID = 'demo-love-ink';
const docUrl = (uid) => `http://${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/utilisateurs/${uid}`;
// "Bearer owner" contourne les règles : réservé à l'émulateur, équivalent de la console Firebase.
const OWNER = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };

async function setRoleAsOwner(request, uid, role) {
    const response = await request.patch(`${docUrl(uid)}?updateMask.fieldPaths=role`, {
        headers: OWNER,
        data: { fields: { role: { stringValue: role } } }
    });
    expect(response.ok(), await response.text()).toBeTruthy();
}

async function readUserDoc(request, uid) {
    const response = await request.get(docUrl(uid), { headers: OWNER });
    expect(response.ok()).toBeTruthy();
    const { fields = {} } = await response.json();
    return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, Object.values(value)[0]]));
}

test.describe('Love Ink - rôle admin (émulateurs)', () => {
    test.skip(process.env.E2E_ALLOW_PROD === '1', 'Écrit des rôles via l’API de l’émulateur : jamais contre la production.');

    test('un admin attribue un rôle depuis le profil, sans pouvoir modifier le sien', async ({ page, request }) => {
        const cible = await registerWithUi(page, makeUser('e2e-cible'));
        expect(cible.uid).toBeTruthy();
        await logoutFromNav(page);

        const admin = await registerWithUi(page, makeUser('e2e-admin'));
        expect(admin.uid).toBeTruthy();
        await setRoleAsOwner(request, admin.uid, 'admin');
        await logoutFromNav(page);
        await loginWithUi(page, admin);

        await page.goto('/profil.html?tab=moderation');
        await waitForAuthReady(page);
        const section = page.locator('#adminComptesSection');
        await expect(section).toBeVisible({ timeout: 30000 });

        const moi = section.locator('.admin-compte', { hasText: '(vous)' });
        await expect(moi.locator('.admin-role-select')).toBeDisabled();

        await page.fill('#adminComptesFiltre', cible.uid.toLowerCase());
        const ligne = section.locator('.admin-compte:not([hidden])', { hasText: cible.uid });
        await expect(ligne).toHaveCount(1);
        await ligne.locator('.admin-role-select').selectOption('moderateur');
        await ligne.locator('.admin-role-apply').click();

        await expect.poll(async () => (await readUserDoc(request, cible.uid)).role, { timeout: 20000 }).toBe('moderateur');
        const apres = await readUserDoc(request, cible.uid);
        expect(apres.roleUpdatedBy).toBe(admin.uid);
        expect(apres.roleUpdateSource).toBe('admin_panel');
        expect((await readUserDoc(request, admin.uid)).role).toBe('admin');
    });
});
