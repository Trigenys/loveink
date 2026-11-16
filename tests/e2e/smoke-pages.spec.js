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

    test('mot de passe oublie: la carte tourne vers sa propre page puis la lettre envoyee', async ({ page }) => {
        // Le mailer est simule : aucun e-mail reel n'est envoye.
        await page.route('**/v1/auth/password-reset', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
        await page.goto('/login.html');
        await page.fill('#email', 'smoke-reset@example.com');
        await page.click('#forgotBtn');
        await expect(page.locator('#viewForgot')).toBeVisible();
        await expect(page.locator('#viewLogin')).toBeHidden();
        await expect(page).toHaveURL(/#mot-de-passe-oublie$/);
        await expect(page.locator('#resetEmail')).toHaveValue('smoke-reset@example.com');
        await page.click('#resetBtn');
        await expect(page.locator('#viewSent')).toBeVisible();
        await expect(page.locator('#sentEmail')).toHaveText('smoke-reset@example.com');
        await page.click('#viewSent [data-view="login"]');
        await expect(page.locator('#viewLogin')).toBeVisible();
        await expect(page.locator('#email')).toHaveValue('smoke-reset@example.com');
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
