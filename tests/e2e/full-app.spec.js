const { test, expect } = require('@playwright/test');
const {
    makeUser,
    closeModalIfPresent,
    readSession,
    registerWithUi,
    loginWithUi,
    logoutFromNav,
    ensureFeedLoaded,
    ensureMessagingConversationOpen,
    waitForRedirectWithModalHandling
} = require('./helpers/app');

test.describe('Love Ink - E2E global', () => {
    test('garde d auth: un visiteur est redirige des pages privees', async ({ page }) => {
        await page.goto('/feed.html');
        await page.waitForURL(/\/($|index(?:\.html)?(?:\?|$))/, { timeout: 20000 });

        await page.goto('/profil.html');
        await page.waitForURL(/\/($|index(?:\.html)?(?:\?|$))/, { timeout: 20000 });

        await page.goto('/notifications.html');
        await page.waitForURL(/\/($|index(?:\.html)?(?:\?|$))/, { timeout: 20000 });
    });

    test('parcours complet utilisateur: inscription -> feed -> publication -> profil -> parametres -> notifications -> relogin', async ({ page }) => {
        const user = makeUser('flow');
        await registerWithUi(page, user, { type: 'lesdeux', bio: 'Bio e2e initiale' });
        await ensureFeedLoaded(page);

        await page.fill('#searchInput', `nomatch-${Date.now()}`);
        await page.click('#searchBtn');
        await closeModalIfPresent(page);

        await page.goto('/publier.html');
        await expect(page.locator('#publishForm')).toBeVisible();
        await page.waitForTimeout(2000);

        const submitStory = async () => {
            await page.fill('#titre', `Histoire e2e ${Date.now()}`);
            await page.selectOption('#categorie', 'Rencontres');
            await page.fill('#contenu', 'Contenu automatique e2e. '.repeat(40));
            await page.click('#publishSubmitBtn');
            await waitForRedirectWithModalHandling(
                page,
                /\/profil(\.html)?\?(?:(?:.*tab=histoires.*status=en_attente)|(?:.*status=en_attente.*tab=histoires))/,
                60000
            );
        };

        try {
            await submitStory();
        } catch (error) {
            if (!page.url().includes('/login')) throw error;
            await loginWithUi(page, user);
            await page.goto('/publier.html');
            await expect(page.locator('#publishForm')).toBeVisible();
            await page.waitForTimeout(2000);
            await submitStory();
        }
        await expect(page.locator('#panel-histoires')).toBeVisible();

        // L'auteur peut relire une histoire encore en revision depuis son profil.
        await page.locator('#panel-histoires .story-card .story-edit-btn').first().click();
        await expect(page).toHaveURL(/\/histoire(\.html)?\?id=/);
        await expect(page.getByText('en attente de validation par un modérateur')).toBeVisible({ timeout: 20000 });

        await page.goto('/parametres.html');
        await expect(page.locator('#saveProfileBtn')).toBeVisible();
        await page.fill('#bio', `Bio mise a jour par test e2e ${Date.now()}`);
        await page.click('#saveProfileBtn');
        await closeModalIfPresent(page);

        await page.goto('/notifications.html');
        await expect(page.locator('#notificationsList')).toBeVisible();
        await page.click('#markAllRead');
        await expect(page.locator('#notificationsList')).toBeVisible();

        await logoutFromNav(page);

        await loginWithUi(page, user);
        await ensureFeedLoaded(page);

        const session = await readSession(page);
        expect(session?.uid).toBeTruthy();
        expect(session?.email).toBe(user.email);
    });

    test('messagerie temps reel entre 2 comptes', async ({ browser }) => {
        const userA = makeUser('msgA');
        const userB = makeUser('msgB');
        const messageText = `hello-e2e-${Date.now()}`;

        const contextA = await browser.newContext();
        const contextB = await browser.newContext();
        const pageA = await contextA.newPage();
        const pageB = await contextB.newPage();

        try {
            const accountA = await registerWithUi(pageA, userA, { type: 'lecteur' });
            const accountB = await registerWithUi(pageB, userB, { type: 'lecteur' });

            expect(accountA.uid).toBeTruthy();
            expect(accountB.uid).toBeTruthy();
            await ensureFeedLoaded(pageA);
            await ensureFeedLoaded(pageB);

            const ensureConversationOrSkip = async (page, otherUid) => {
                try {
                    await ensureMessagingConversationOpen(page, otherUid, 60000);
                } catch (error) {
                    const details = String(error?.message || error || '');
                    if (/permission-denied|insufficient permissions/i.test(details)) {
                        test.skip(true, 'Messagerie temps reel non testable sur cet environnement: ecriture conversations/messages refusee par les regles Firestore.');
                    }
                    throw error;
                }
            };

            await ensureConversationOrSkip(pageA, accountB.uid);
            await expect(pageA.locator('#chatPanel')).toBeVisible({ timeout: 30000 });
            await pageA.fill('#messageInput', messageText);
            await pageA.click('#sendBtn');

            await ensureConversationOrSkip(pageB, accountA.uid);
            await expect(pageB.locator('#chatPanel')).toBeVisible();
            await expect.poll(async () => {
                return pageB.locator('#chatMessages').innerText();
            }, { timeout: 45000 }).toContain(messageText);
        } finally {
            await contextA.close();
            await contextB.close();
        }
    });
});
