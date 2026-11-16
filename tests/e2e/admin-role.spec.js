// Rôle admin sur émulateurs : le premier admin est posé hors application (ici par l'API d'administration de
// l'émulateur, en production à la main dans la console Firebase), puis l'onglet Modération du profil le renvoie vers admin.html.
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

    test('le profil renvoie l’admin vers le tableau de bord pour les comptes et rôles', async ({ page, request }) => {
        const admin = await registerWithUi(page, makeUser('e2e-admin'));
        expect(admin.uid).toBeTruthy();
        await setRoleAsOwner(request, admin.uid, 'admin');
        await logoutFromNav(page);
        await loginWithUi(page, admin);

        await page.goto('/profil.html?tab=moderation');
        await waitForAuthReady(page);
        const lien = page.locator('#adminDashboardLink');
        await expect(lien).toBeVisible({ timeout: 30000 });
        await expect(lien).toHaveAttribute('href', 'admin.html');
        // La gestion des comptes vit dans admin.html (admin-dashboard.spec.js), plus dans le profil.
        await expect(page.locator('#adminComptesSection')).toHaveCount(0);

        // Une section à la fois : la file d'attente par défaut, puis le journal.
        await expect(page.locator('[data-modo-panel="file"]')).toBeVisible();
        await expect(page.locator('[data-modo-panel="journal"]')).toBeHidden();
        await page.locator('#modoSubnav [data-modo="journal"]').click();
        await expect(page.locator('[data-modo-panel="journal"]')).toBeVisible();
        await expect(page.locator('[data-modo-panel="file"]')).toBeHidden();
        expect((await readUserDoc(request, admin.uid)).role).toBe('admin');
    });
});
