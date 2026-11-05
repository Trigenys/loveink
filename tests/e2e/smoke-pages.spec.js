const { test, expect } = require('@playwright/test');
const { makeUser, registerWithUi, ensureFeedLoaded } = require('./helpers/app');

test.describe('Love Ink - smoke global pages', () => {
    test('pages publiques: index/login/register chargent', async ({ page }) => {
        await page.goto('/index.html');
        await expect(page.locator('.lp-hero')).toBeVisible();
        await expect(page.locator('.logo-custom .logo-text')).toContainText('Love Ink');

        await page.goto('/login.html');
        await expect(page.locator('#loginForm')).toBeVisible();

        await page.goto('/register.html');
        await expect(page.locator('#registerForm')).toBeVisible();
    });

    test('pages privees principales accessibles apres connexion', async ({ page }) => {
        const user = makeUser('smoke');
        await registerWithUi(page, user, { type: 'lesdeux', bio: 'Compte smoke suite' });
        await ensureFeedLoaded(page);

        await page.goto('/profil.html');
        await expect(page.locator('#panel-histoires')).toBeVisible();

        await page.goto('/mes-histoires.html');
        await expect(page.locator('main h1')).toContainText('Mes histoires');

        await page.goto('/publier.html');
        await expect(page.locator('#publishForm')).toBeVisible();

        await page.goto('/parametres.html');
        await expect(page.locator('#saveProfileBtn')).toBeVisible();

        await page.goto('/notifications.html');
        await expect(page.locator('#notificationsList')).toBeVisible();

        await page.goto('/messagerie.html');
        await expect(page.locator('#conversationsList')).toBeVisible();
        await expect(page.locator('#chatEmpty')).toBeVisible();

        await page.goto('/candidature-modo.html');
        await expect(page.locator('#candidatureForm')).toBeVisible();
        await expect(page.locator('#fieldEmail')).toHaveValue(user.email);

        await page.goto('/histoire.html?id=e2e-introuvable');
        await expect(page.locator('#storyContainer')).toContainText(/Histoire non trouvee/i);
    });
});
