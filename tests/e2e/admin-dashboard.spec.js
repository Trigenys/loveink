// Tableau de bord admin (admin.html) sur émulateurs : KPI, liste avec e-mail privé, filtre, changement de rôle
// confirmé, et refus d'accès pour un non-admin. Le premier admin est posé par l'API d'administration de l'émulateur
// (en production : scripts/admin-bootstrap.mjs, exécuté par l'utilisatrice).
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { makeUser, registerWithUi, loginWithUi, logoutFromNav, closeModalIfPresent } = require('./helpers/app');

const FIRESTORE_EMULATOR = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const PROJECT_ID = 'demo-love-ink';
const docUrl = (uid) => `http://${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/utilisateurs/${uid}`;
// "Bearer owner" contourne les règles : réservé à l'émulateur.
const OWNER = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const SHOTS = process.env.E2E_SCREENSHOT_DIR || '';

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

async function shot(page, name) {
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

test.describe('Love Ink - tableau de bord admin (émulateurs)', () => {
    test.skip(process.env.E2E_ALLOW_PROD === '1', 'Écrit des rôles via l’API de l’émulateur : jamais contre la production.');

    test('un admin voit KPI et comptes, change un rôle avec confirmation ; un non-admin est refusé', async ({ page, request }) => {
        const cible = await registerWithUi(page, makeUser('e2e-dash-cible'));
        expect(cible.uid).toBeTruthy();
        await logoutFromNav(page);

        const admin = await registerWithUi(page, makeUser('e2e-dash-admin'));
        await setRoleAsOwner(request, admin.uid, 'admin');
        await logoutFromNav(page);
        await loginWithUi(page, admin);

        await page.goto('/admin.html');
        await expect(page.locator('html[data-admin-ready="1"]')).toHaveCount(1, { timeout: 30000 });
        await expect(page.locator('#adminDashboard')).toBeVisible();
        expect(Number(await page.locator('[data-kpi="total"]').textContent())).toBeGreaterThanOrEqual(2);
        await expect(page.locator('[data-kpi="nouveaux7"]')).not.toHaveText('–');
        await expect(page.locator('#adminHistoiresStatut li')).toHaveCount(3);
        await shot(page, 'admin-dashboard');

        // Ligne de l'admin : son propre rôle n'est pas modifiable.
        await page.fill('#filtreTexte', admin.uid);
        await expect(page.locator(`tr[data-uid="${admin.uid}"] .admin-role-select`)).toBeDisabled();

        // Recherche par e-mail : l'e-mail vient de comptes_prives (lisible par les seuls admins).
        await page.fill('#filtreTexte', cible.email);
        const ligne = page.locator(`tr[data-uid="${cible.uid}"]`);
        await expect(page.locator('#adminComptesBody tr')).toHaveCount(1);
        await expect(ligne).toContainText(cible.email);
        await expect(ligne.locator('.admin-histoires')).toHaveText('0');

        // Annulation : aucune écriture.
        await ligne.locator('.admin-role-select').selectOption('moderateur');
        await ligne.locator('.admin-role-apply').click();
        await page.locator('.li-modale-btn-secondary').click();
        await expect(ligne.locator('.admin-role-select')).toHaveValue('user');
        expect((await readUserDoc(request, cible.uid)).role || 'user').toBe('user');

        // Confirmation : rôle écrit par l'admin, avec traçabilité.
        await ligne.locator('.admin-role-select').selectOption('moderateur');
        await ligne.locator('.admin-role-apply').click();
        await shot(page, 'admin-role-confirm');
        await page.locator('.li-modale-btn-primary').click();
        await expect.poll(async () => (await readUserDoc(request, cible.uid)).role, { timeout: 20000 }).toBe('moderateur');
        const apres = await readUserDoc(request, cible.uid);
        expect(apres.roleUpdatedBy).toBe(admin.uid);
        expect(apres.roleUpdateSource).toBe('admin_dashboard');
        await expect(page.locator('.li-modale-btn-primary')).toBeVisible();
        await closeModalIfPresent(page);

        // Filtre par rôle : la cible apparaît parmi les modérateurs.
        await page.fill('#filtreTexte', '');
        await page.selectOption('#filtreRole', 'moderateur');
        await expect(page.locator(`tr[data-uid="${cible.uid}"]`)).toHaveCount(1);

        // Un non-admin (même modérateur) est refusé et aucune donnée n'est chargée.
        await logoutFromNav(page);
        await loginWithUi(page, cible);
        await page.goto('/admin.html');
        await expect(page.locator('html[data-admin-ready="denied"]')).toHaveCount(1, { timeout: 30000 });
        await expect(page.locator('#adminDenied')).toBeVisible();
        await expect(page.locator('#adminDashboard')).toBeHidden();
        await shot(page, 'admin-denied');
    });
});
