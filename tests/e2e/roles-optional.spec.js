const { test, expect } = require('@playwright/test');
const { loginWithUi, logoutFromNav } = require('./helpers/app');

const CENSEUR_EMAIL = process.env.E2E_CENSEUR_EMAIL || '';
const CENSEUR_PASSWORD = process.env.E2E_CENSEUR_PASSWORD || '';
const MODO_EMAIL = process.env.E2E_MODO_EMAIL || '';
const MODO_PASSWORD = process.env.E2E_MODO_PASSWORD || '';

test.describe('Love Ink - tests roles (optionnels)', () => {
    test('censeur: onglet moderation + sections ops visibles', async ({ page }) => {
        test.skip(!(CENSEUR_EMAIL && CENSEUR_PASSWORD), 'Definir E2E_CENSEUR_EMAIL et E2E_CENSEUR_PASSWORD pour activer ce test.');

        await loginWithUi(page, { email: CENSEUR_EMAIL, password: CENSEUR_PASSWORD });
        await page.goto('/profil.html?tab=moderation');

        await expect(page.locator('#tabModeration')).toBeVisible();
        await expect(page.locator('#panel-moderation')).toBeVisible();
        await expect(page.locator('#censeurOpsRoot')).toContainText('Historique des sanctions');
        await expect(page.locator('#censeurOpsRoot')).toContainText('Candidatures moderateur');
        await expect(page.locator('#censeurOpsRoot')).toContainText('Promotions vers censeur');
        await expect(page.locator('#censeurOpsRoot')).toContainText('Journal ops');

        await logoutFromNav(page);
    });

    test('moderateur: onglet moderation visible, sections ops censeur absentes', async ({ page }) => {
        test.skip(!(MODO_EMAIL && MODO_PASSWORD), 'Definir E2E_MODO_EMAIL et E2E_MODO_PASSWORD pour activer ce test.');

        await loginWithUi(page, { email: MODO_EMAIL, password: MODO_PASSWORD });
        await page.goto('/profil.html?tab=moderation');

        await expect(page.locator('#tabModeration')).toBeVisible();
        await expect(page.locator('#panel-moderation')).toBeVisible();
        await expect(page.locator('#censeurOpsRoot')).not.toContainText('Journal ops');
        await expect(page.locator('#moderationList')).toBeVisible();

        await logoutFromNav(page);
    });
});
