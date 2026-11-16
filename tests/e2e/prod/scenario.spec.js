// Recette e2e en production : rôles (utilisateur, modérateur, censeur) et interactions entre comptes.
// Les données créées sont supprimées ensuite par teardown.js (lancé d'office par run.js).
const { test, expect } = require('@playwright/test');
const {
    loginWithUi,
    closeModalIfPresent,
    ensureMessagingConversationOpen,
    waitForRedirectWithModalHandling
} = require('../helpers/app');
const { requireAccounts, readAccounts, writeAccounts } = require('./accounts');

test.skip(process.env.E2E_PROD !== '1', 'Recette prod : lancer via npm run e2e:prod');
test.describe.configure({ mode: 'serial' });

const stamp = Date.now().toString(36);
const titleA = `[E2E] Histoire A ${stamp}`;
const titleB = `[E2E] Histoire B ${stamp}`;
const comment = `Commentaire e2e ${stamp}`;
const messageIn = `Bonjour auteur ${stamp}`;
const messageOut = `Merci lecteur ${stamp}`;
const devise = `Devise e2e ${stamp}`;

let accounts;
const pages = {};
const contexts = [];
const storyIds = {};

async function openAs(browser, role) {
    const context = await browser.newContext();
    contexts.push(context);
    const page = await context.newPage();
    await loginWithUi(page, accounts[role]);
    pages[role] = page;
}

async function openModeration(page) {
    await page.goto('/profil.html');
    const tab = page.locator('#tabModeration');
    await expect(tab, 'onglet Modération visible (rôle posé dans Firestore ?)').toBeVisible({ timeout: 30000 });
    await tab.click();
    await expect(page.locator('#panel-moderation')).toBeVisible();
}

function modoItem(page, title) {
    return page.locator('.modo-item', { has: page.locator('.modo-item-title', { hasText: title }) });
}

function rememberStory(title, id) {
    storyIds[title] = id;
    const data = readAccounts();
    if (!data) return;
    data.storyIds = Array.from(new Set([...(data.storyIds || []), id]));
    writeAccounts(data);
}

test.beforeAll(async ({ browser }) => {
    accounts = requireAccounts().accounts;
    for (const role of ['auteur', 'lecteur', 'modo', 'censeur']) await openAs(browser, role);
});

test.afterAll(async () => {
    for (const context of contexts) await context.close().catch(() => {});
});

test("rôles : seul le personnel de modération voit l'onglet Modération", async () => {
    await pages.lecteur.goto('/profil.html');
    await expect(pages.lecteur.locator('#panel-histoires')).toBeVisible({ timeout: 30000 });
    await pages.lecteur.waitForTimeout(3000);
    await expect(pages.lecteur.locator('#tabModeration')).toBeHidden();

    await openModeration(pages.modo);
    await openModeration(pages.censeur);
});

test('auteur : publie deux histoires soumises à modération', async () => {
    const page = pages.auteur;
    for (const title of [titleA, titleB]) {
        await page.goto('/publier.html');
        await expect(page.locator('#publishForm')).toBeVisible();
        await page.waitForTimeout(1500);
        await page.fill('#titre', title);
        await page.selectOption('#categorie', 'Rencontres');
        await page.fill('#contenu', `Texte de recette e2e pour ${title}. `.repeat(30));
        await page.click('#publishSubmitBtn');
        await waitForRedirectWithModalHandling(page, /\/profil(\.html)?\?.*status=en_attente/, 60000);

        const card = page.locator('#panel-histoires .story-card', { hasText: title });
        await expect(card).toBeVisible({ timeout: 30000 });
        const href = await card.locator('.story-edit-btn').getAttribute('href');
        const id = new URL(href, 'https://x.invalid/').searchParams.get('id');
        expect(id, `id de ${title}`).toBeTruthy();
        rememberStory(title, id);
    }
});

test("lecteur : une histoire en révision n'est pas lisible publiquement", async () => {
    const page = pages.lecteur;
    await page.goto(`/histoire.html?id=${encodeURIComponent(storyIds[titleA])}`);
    await page.waitForTimeout(5000);
    await expect(page.locator('#likeBtn')).not.toBeVisible();
});

test("censeur : voit les histoires en attente avec l'action Sanctionner", async () => {
    const page = pages.censeur;
    await openModeration(page);
    const item = modoItem(page, titleA);
    await expect(item).toBeVisible({ timeout: 30000 });
    await expect(item.locator('.modo-sanction')).toBeVisible();
});

test('modérateur : approuve A, rejette B avec motif, sans action Sanctionner', async () => {
    const page = pages.modo;
    await openModeration(page);

    const itemA = modoItem(page, titleA);
    await expect(itemA).toBeVisible({ timeout: 30000 });
    await expect(itemA.locator('.modo-sanction')).toHaveCount(0);
    await itemA.locator('.modo-approve').click();
    await expect(itemA).toHaveCount(0, { timeout: 30000 });

    const itemB = modoItem(page, titleB);
    await expect(itemB).toBeVisible();
    await itemB.locator('.modo-reject').click();
    await page.fill('#rejectMotifInput', 'Rejet de recette e2e');
    await page.click('#rejectConfirmBtn');
    await expect(itemB).toHaveCount(0, { timeout: 30000 });
});

test('auteur : retrouve A dans Publiées et B dans Rejetées', async () => {
    const page = pages.auteur;
    await page.goto('/profil.html');
    await expect(page.locator('#panel-histoires')).toBeVisible({ timeout: 30000 });

    await page.click('.status-filter-btn[data-status="publie"]');
    await expect(page.locator('#panel-histoires .story-card', { hasText: titleA })).toBeVisible({ timeout: 30000 });

    await page.click('.status-filter-btn[data-status="rejete"]');
    await expect(page.locator('#panel-histoires .story-card', { hasText: titleB })).toBeVisible({ timeout: 30000 });
});

test("lecteur : aime et commente l'histoire publiée", async () => {
    const page = pages.lecteur;
    await page.goto(`/histoire.html?id=${encodeURIComponent(storyIds[titleA])}`);
    await expect(page.locator('#likeBtn')).toBeVisible({ timeout: 30000 });

    await page.click('#likeBtn');
    await expect(page.locator('#likeCount')).toHaveText(/^\s*1\s*$/, { timeout: 20000 });

    await page.fill('#newComment', comment);
    await page.click('#submitComment');
    await closeModalIfPresent(page);
    await expect(page.locator('#commentsContainer')).toContainText(comment, { timeout: 30000 });

    await page.reload();
    await expect(page.locator('#likeCount')).toHaveText(/^\s*1\s*$/, { timeout: 30000 });
    await expect(page.locator('#commentsContainer')).toContainText(comment, { timeout: 30000 });
});

test("lecteur : s'abonne à l'auteur, compteur d'abonnés de l'auteur à 1", async () => {
    const page = pages.lecteur;
    await page.goto('/feed.html');
    await page.waitForTimeout(4000);
    const card = page.locator('.author-card', { hasText: accounts.auteur.pseudo });

    if (await card.count()) {
        await card.first().locator('.follow-btn').click();
    } else {
        // L'auteur n'apparaît pas (encore) dans la grille du fil : même appel que le bouton Suivre.
        await page.waitForFunction(() => Boolean(window.firebaseAPI?.suivreAuteur), null, { timeout: 30000 });
        await page.evaluate(([me, author]) => window.firebaseAPI.suivreAuteur(me, author), [accounts.lecteur.uid, accounts.auteur.uid]);
    }

    const auteur = pages.auteur;
    await expect.poll(async () => {
        await auteur.goto('/profil.html');
        await auteur.waitForTimeout(2500);
        return (await auteur.locator('#statAbonnes').innerText()).trim();
    }, { timeout: 60000 }).toBe('1');
});

test("messagerie : le lecteur écrit à l'auteur, qui répond", async () => {
    const lecteur = pages.lecteur;
    const auteur = pages.auteur;

    await ensureMessagingConversationOpen(lecteur, accounts.auteur.uid, 60000);
    await lecteur.fill('#messageInput', messageIn);
    await lecteur.click('#sendBtn');
    await expect(lecteur.locator('#chatMessages')).toContainText(messageIn, { timeout: 30000 });

    await ensureMessagingConversationOpen(auteur, accounts.lecteur.uid, 60000);
    await expect(auteur.locator('#chatMessages')).toContainText(messageIn, { timeout: 45000 });
    await auteur.fill('#messageInput', messageOut);
    await auteur.click('#sendBtn');

    await expect(lecteur.locator('#chatMessages')).toContainText(messageOut, { timeout: 45000 });
});

test('auteur : reçoit les notifications des interactions du lecteur', async () => {
    const page = pages.auteur;
    await page.goto('/notifications.html');
    await expect(page.locator('#notificationsList')).toBeVisible({ timeout: 30000 });
    await expect.poll(async () => (await page.locator('#notificationsList').innerText()).toLowerCase(), { timeout: 45000 })
        .toContain(accounts.lecteur.pseudo.toLowerCase());
    await page.click('#markAllRead');
});

test('auteur : personnalise son profil (devise, couverture), persistant après rechargement', async () => {
    const page = pages.auteur;
    await page.goto('/profil.html');
    await page.click('#editProfileBtn');
    await expect(page.locator('#editModal')).toBeVisible();
    await page.fill('#editDevise', devise);
    await page.locator('#coverSwatches input[name="couverture"][value="aurore"]').check({ force: true });
    await page.click('#editProfileForm button[type="submit"]');
    await closeModalIfPresent(page);

    await page.reload();
    await expect(page.locator('#profilDevise')).toHaveText(devise, { timeout: 30000 });
    await expect(page.locator('#profileCover')).toHaveAttribute('data-cover', 'aurore');
});
