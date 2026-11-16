// Parcours « Écrire une histoire » en étapes, sans compte ni écriture réelle :
// Firebase (auth, données, session) est remplacé par des modules simulés et le stockage media par media-mock.
// À lancer contre un serveur local : E2E_BASE_URL=http://127.0.0.1:<port> npx playwright test publier-wizard
const { test, expect } = require('@playwright/test');
const { closeModalIfPresent, fillPublishWizard } = require('./helpers/app');
const { mockMediaStorage, tinyImageFile } = require('./helpers/media-mock');

const USER = { uid: 'u-e2e-wizard', email: 'plume@loveink-e2e.test', displayName: 'Plume Test' };

const FIREBASE_CONFIG_STUB = `
const user = ${JSON.stringify(USER)};
user.getIdToken = async () => 'token-e2e';
export const auth = { currentUser: user };
export const db = {};
export const app = {};
`;

const FIREBASE_DATA_STUB = `
const cfg = window.__publishStub || {};
// Journal conservé en sessionStorage : il survit à la redirection qui suit l'envoi.
const log = (name, args) => {
    const calls = JSON.parse(sessionStorage.getItem('__calls') || '{}');
    (calls[name] ||= []).push(args);
    sessionStorage.setItem('__calls', JSON.stringify(calls));
};
export const firebaseAPI = {
    getUtilisateur: async () => ({ role: cfg.role || 'user', statut: 'actif' }),
    publierHistoire: async (...args) => { log('publierHistoire', args); return 'story-e2e-1'; },
    getHistoireById: async (id) => (cfg.story ? { id, ...cfg.story } : null),
    editerHistoireModeration: async (...args) => { log('editerHistoireModeration', args); return { ok: true }; }
};
`;

const AUTH_SESSION_STUB = `
export function requireAuth({ auth, onReady }) {
    setTimeout(() => onReady(auth.currentUser, { pseudo: 'Plume Test' }), 0);
    return () => {};
}
export async function logoutAndRedirect() {}
`;

async function stubBackend(page, config = {}) {
    await page.addInitScript((cfg) => { window.__publishStub = cfg; }, config);
    const js = (body) => (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body });
    await page.route('**/js/core/firebase-config.js*', js(FIREBASE_CONFIG_STUB));
    await page.route('**/js/core/firebase-data.js*', js(FIREBASE_DATA_STUB));
    await page.route('**/js/core/auth-session.js*', js(AUTH_SESSION_STUB));
    // Pages de destination après envoi : on ne charge pas la vraie app.
    await page.route('**/profil.html*', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>profil</title><p id="landed">profil</p>' }));
    return mockMediaStorage(page);
}

async function openWizard(page, query = '') {
    await page.goto(`/publier.html${query}`);
    await expect(page.locator('#publishForm')).toBeVisible();
    await page.waitForFunction(() => document.querySelector('.li-steps__item.is-current'));
}

const current = (page) => page.locator('.li-steps__item.is-current');
const STORY = 'Premier paragraphe,\nsur deux lignes.\n\nDeuxième paragraphe. '.concat('Encore des mots. '.repeat(20));

test.describe('Écrire une histoire — parcours en étapes', () => {
    test('parcours complet : validation par étape, aperçu fidèle, contrat de publication inchangé', async ({ page }) => {
        const mediaCalls = await stubBackend(page);
        await openWizard(page);

        // Étape 1 : impossible d'avancer sans genre.
        await expect(current(page)).toContainText('Genre');
        await page.click('[data-wizard-next]');
        await expect(page.locator('[data-step="categorie"] [data-step-error]')).toBeVisible();
        await expect(current(page)).toContainText('Genre');

        // Un choix au clic enchaîne seul sur le titre.
        await page.locator('label.li-genre', { hasText: 'Rencontres' }).click();
        await expect(page.locator('#titre')).toBeFocused();
        await expect(current(page)).toContainText('Titre');

        // Titre vide refusé ; Entrée valide.
        await page.keyboard.press('Enter');
        await expect(page.locator('[data-step="titre"] [data-step-error]')).toBeVisible();
        await page.fill('#titre', 'Le quai de la gare');
        await expect(page.locator('#titleCount')).toHaveText('18 / 140');
        await page.keyboard.press('Enter');
        await expect(page.locator('#contenu')).toBeFocused();

        // Texte : compteur de mots, Ctrl+Entrée pour continuer, Ctrl+Maj+Entrée pour revenir.
        await page.fill('#contenu', STORY);
        await expect(page.locator('#charCount')).toContainText('mots');
        await page.keyboard.press('Control+Shift+Enter');
        await expect(current(page)).toContainText('Titre');
        await page.keyboard.press('Enter');
        await page.locator('#contenu').focus();
        await page.keyboard.press('Control+Enter');
        await expect(current(page)).toContainText('Images');

        // Images : au moins une requise.
        await page.click('[data-wizard-next]');
        await expect(page.locator('[data-step="images"] [data-step-error]')).toBeVisible();
        await page.setInputFiles('#imagesInput', [tinyImageFile('a.png'), tinyImageFile('b.png')]);
        await expect(page.locator('#imagePreviews .image-preview')).toHaveCount(2);
        await expect(page.locator('#imagesCount')).toHaveText('2 / 4 images');
        await page.getByLabel("Description de l'image 1").fill('Le quai au petit matin');
        await page.click('[data-wizard-next]');

        // Aperçu « comme publié ».
        await expect(page.locator('[data-step="apercu"]')).toBeVisible();
        await expect(page.locator('#previewTitre')).toHaveText('Le quai de la gare');
        await expect(page.locator('#previewCategorie')).toHaveText('Rencontres');
        await expect(page.locator('#previewAuteur')).toHaveText('Plume Test');
        await expect(page.locator('#previewContenu p')).toHaveCount(2);
        await expect(page.locator('#previewContenu p').first().locator('br')).toHaveCount(1);
        await expect(page.locator('#previewGallery img')).toHaveCount(2);
        await expect(page.locator('#previewGallery img').first()).toHaveAttribute('alt', 'Le quai au petit matin');
        await expect(page.locator('#reviewNote')).toContainText('attente de modération');

        // Envoi : même contrat publierHistoire(titre, categorie, contenu, auteur, auteurId, images).
        await page.click('#publishSubmitBtn');
        await closeModalIfPresent(page);
        await page.waitForURL(/profil\.html\?tab=histoires&status=en_attente/);
        // Images envoyées (variants compris) par le flux existant publishStoryImages.
        expect(mediaCalls.filter((c) => c.method === 'PUT').length).toBeGreaterThanOrEqual(2);
    });

    test('arguments transmis à publierHistoire et brouillon effacé après envoi', async ({ page }) => {
        await stubBackend(page);
        await openWizard(page);
        await fillPublishWizard(page, {
            categorie: 'Poésie d\'amour',
            titre: '  Vers le large  ',
            contenu: `${STORY}\n\n`,
            files: [tinyImageFile()]
        });
        await page.click('#publishSubmitBtn');
        await closeModalIfPresent(page);
        await page.waitForURL(/profil\.html\?tab=histoires&status=en_attente/);
        const [args] = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__calls')).publierHistoire);
        expect(args.slice(0, 5)).toEqual(['Vers le large', 'Poésie d\'amour', STORY.trim(), 'Plume Test', USER.uid]);
        expect(args[5]).toHaveLength(1);
        expect(args[5][0].id).toBeTruthy();
        const draft = await page.evaluate((uid) => localStorage.getItem(`loveInk_publishDraft:${uid}`), USER.uid);
        expect(draft).toBeNull();
    });

    test('pas de saut d\'étape invalide via la barre de progression', async ({ page }) => {
        await stubBackend(page);
        await openWizard(page);
        await expect(page.locator('.li-steps__item[data-goto="4"]')).toBeDisabled();
        await page.locator('input[name="categorie"][value="Amour magique"]').check({ force: true });
        await page.click('[data-wizard-next]');
        await page.fill('#titre', 'Un titre');
        await page.click('[data-wizard-next]');
        await page.fill('#contenu', 'Un texte.');
        await page.click('[data-wizard-next]');
        await expect(current(page)).toContainText('Images');
        // Retour au titre, on l'efface, puis on tente de revenir aux images : arrêt sur le titre.
        await page.click('.li-steps__item[data-goto="1"]');
        await page.fill('#titre', '');
        await page.click('.li-steps__item[data-goto="3"]');
        await expect(current(page)).toContainText('Titre');
        await expect(page.locator('[data-step="titre"] [data-step-error]')).toContainText(/titre/i);
    });

    test('brouillon local restauré après rechargement, puis effaçable', async ({ page }) => {
        await stubBackend(page);
        await openWizard(page);
        await page.locator('input[name="categorie"][value="Lettres d\'amour"]').check({ force: true });
        await page.click('[data-wizard-next]');
        await page.fill('#titre', 'Lettre à M.');
        await page.click('[data-wizard-next]');
        await page.fill('#contenu', 'Cher M., je t\'écris depuis la gare.');
        await expect(page.locator('#draftStatus')).toContainText('Brouillon enregistré');

        await page.reload();
        await expect(page.locator('#draftBanner')).toBeVisible();
        await expect(page.locator('#titre')).toHaveValue('Lettre à M.');
        await expect(page.locator('#contenu')).toHaveValue('Cher M., je t\'écris depuis la gare.');
        await expect(page.locator('input[name="categorie"][value="Lettres d\'amour"]')).toBeChecked();
        await expect(current(page)).toContainText('Texte');

        await page.click('#draftDiscardBtn');
        await expect(current(page)).toContainText('Genre');
        await expect(page.locator('#titre')).toHaveValue('');
        const draft = await page.evaluate((uid) => localStorage.getItem(`loveInk_publishDraft:${uid}`), USER.uid);
        expect(draft).toBeNull();
    });

    test('prefers-reduced-motion : aucune animation d\'entrée d\'étape', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await stubBackend(page);
        await openWizard(page);
        await page.locator('label.li-genre', { hasText: 'Premier amour' }).click();
        await expect(current(page)).toContainText('Titre');
        await expect(page.locator('[data-step="titre"]')).not.toHaveClass(/is-entering/);
        const duration = await page.locator('.li-steps__fill').evaluate((el) => getComputedStyle(el).transitionDuration);
        expect(duration.split(',').every((d) => parseFloat(d) <= 0.01)).toBeTruthy();
    });

    test('mobile : pas de défilement horizontal, navigation accessible en bas', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await stubBackend(page);
        await openWizard(page);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        await page.locator('label.li-genre', { hasText: 'Rencontres' }).click();
        await expect(page.locator('[data-wizard-next]')).toBeInViewport();
    });

    test('mode modération : arrivée sur l\'aperçu et corrections enregistrées', async ({ page }) => {
        await stubBackend(page, {
            role: 'moderateur',
            story: {
                titre: 'Histoire à relire',
                categorie: 'Amour heureux',
                contenu: 'Un texte en attente.',
                auteur: 'Autrice',
                statut: 'en_attente',
                images: [{ id: '11111111-1111-4111-8111-111111111111', alt: 'ancienne description' }]
            }
        });
        await openWizard(page, '?edit=story-mod-1');
        await expect(current(page)).toContainText('Aperçu');
        await expect(page.locator('#publishTitle')).toHaveText('Edition de moderation');
        await expect(page.locator('#moderationBanner')).toBeVisible();
        await expect(page.locator('#publishSubmitBtn')).toBeHidden();
        await expect(page.locator('#previewAuteur')).toHaveText('Autrice');

        await page.click('.li-steps__item[data-goto="1"]');
        await page.fill('#titre', 'Histoire relue');
        await page.click('.li-steps__item[data-goto="4"]');
        await page.click('#saveEditBtn');
        await closeModalIfPresent(page);
        await page.waitForURL(/profil\.html\?tab=moderation/);
        const [args] = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__calls')).editerHistoireModeration);
        expect(args[0]).toBe('story-mod-1');
        expect(args[2]).toMatchObject({ titre: 'Histoire relue', categorie: 'Amour heureux', contenu: 'Un texte en attente.' });
        expect(args[2].images).toHaveLength(1);
        expect(args[3]).toEqual({ approuver: false });
    });
});
