// Histoires en plusieurs chapitres : lecture (position, sommaire, suite) et carte de série dans le fil.
// Hermétique : Firebase (auth, données, session) est remplacé par des modules simulés.
// À lancer contre un serveur local : E2E_BASE_URL=http://127.0.0.1:<port> npx playwright test chapitres
const { test, expect } = require('@playwright/test');

const USER = { uid: 'u-e2e-lecteur', email: 'lecteur@loveink-e2e.test', displayName: 'Lecteur' };
const TEXT = 'Premier paragraphe du chapitre.\n\n'.concat('Des mots qui avancent. '.repeat(40));

const SERIE = { id: 'a', titre: 'Nos étés', genre: 'Rencontres', statut: 'en_cours', dernierChapitre: 3, auteurId: 'u-auteur', couverture: null };
const CHAPTERS = [
    { id: 'a', serieId: 'a', chapitre: 1, titre: 'La rencontre', categorie: 'Rencontres', auteur: 'Plume', auteurId: 'u-auteur', statut: 'publie', contenu: TEXT, date: '2026-11-01T10:00:00Z' },
    { id: 'c2', serieId: 'a', chapitre: 2, titre: 'Chapitre 2', categorie: 'Rencontres', auteur: 'Plume', auteurId: 'u-auteur', statut: 'publie', contenu: TEXT, date: '2026-11-08T10:00:00Z' },
    { id: 'c3', serieId: 'a', chapitre: 3, titre: 'Le retour', categorie: 'Rencontres', auteur: 'Plume', auteurId: 'u-auteur', statut: 'publie', contenu: TEXT, date: '2026-11-15T10:00:00Z' }
];
const SOLO = { id: 'solo', titre: 'Le quai de la gare', categorie: 'Amour heureux', auteur: 'Lou', auteurId: 'u-lou', statut: 'publie', contenu: TEXT, date: '2026-11-12T10:00:00Z' };

const FIREBASE_CONFIG_STUB = `
const user = ${JSON.stringify(USER)};
user.getIdToken = async () => 'token-e2e';
export const auth = { currentUser: user, onAuthStateChanged: () => () => {} };
export const db = {};
export const app = {};
`;

// Toute méthode non décrite répond « vide » : la page reste fonctionnelle sans réseau.
const FIREBASE_DATA_STUB = `
const cfg = window.__chapStub || {};
const byId = Object.fromEntries((cfg.stories || []).map((s) => [s.id, s]));
const known = {
    getHistoireById: async (id) => byId[id] || null,
    getHistoires: async () => ({ histoires: cfg.feed || [], total: (cfg.feed || []).length }),
    getSerie: async (id) => (cfg.serie && cfg.serie.id === id ? cfg.serie : null),
    getChapitresSerie: async (id) => (cfg.stories || []).filter((s) => s.serieId === id && s.statut === 'publie'),
    getCommentaires: async () => [],
    aLiker: async () => false,
    estAbonne: async () => false,
    compterHistoiresParCategorie: async () => ({}),
    getUtilisateur: async () => ({ role: 'user', statut: 'actif' }),
    ecouterNotificationsNonLues: () => () => {}
};
export const firebaseAPI = new Proxy(known, { get: (t, k) => (k in t ? t[k] : async () => null) });
`;

const AUTH_SESSION_STUB = `
export function requireAuth({ auth, onReady }) {
    setTimeout(() => onReady(auth.currentUser, { pseudo: 'Lecteur', session: { role: 'user' } }), 0);
    return () => {};
}
export async function logoutAndRedirect() {}
export function getStoredSession() { return null; }
export function getUserPseudo() { return 'Lecteur'; }
export function buildSessionPayload() { return {}; }
export function saveUserSession() {}
export function syncUserSession() {}
export function clearUserSession() {}
`;

async function stubBackend(page, config) {
    await page.addInitScript((cfg) => { window.__chapStub = cfg; }, config);
    const js = (body) => (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body });
    await page.route('**/js/core/firebase-config.js*', js(FIREBASE_CONFIG_STUB));
    await page.route('**/js/core/firebase-data.js*', js(FIREBASE_DATA_STUB));
    await page.route('**/js/core/auth-session.js*', js(AUTH_SESSION_STUB));
}

const READER = { stories: [...CHAPTERS, SOLO], serie: SERIE, feed: [CHAPTERS[2], SOLO, CHAPTERS[1], CHAPTERS[0]] };

test.describe('Lecture d\'une histoire en chapitres', () => {
    test('chapitre du milieu : position, sommaire, précédent et suivant', async ({ page }) => {
        await stubBackend(page, READER);
        await page.goto('/histoire.html?id=c2');
        const head = page.locator('.li-chapters');
        await expect(head).toContainText('Nos étés');
        await expect(head.locator('.li-chapters__label')).toHaveText('Chapitre 2 sur 3');

        await head.locator('summary').click();
        const items = head.locator('.li-chapters__toc li');
        await expect(items).toHaveCount(3);
        await expect(items.nth(1)).toHaveAttribute('aria-current', 'page');
        await expect(items.nth(1).locator('a')).toHaveCount(0);
        await expect(items.nth(0).locator('a')).toHaveAttribute('href', 'histoire.html?id=a');

        const next = page.locator('.li-chapter-next__go');
        await expect(next).toHaveAttribute('href', 'histoire.html?id=c3');
        await expect(next).toContainText('Le retour');
        await expect(page.locator('.li-chapter-next__prev')).toHaveAttribute('href', 'histoire.html?id=a');
        await expect(page.locator('.li-story-end__mark')).toHaveText('Fin du chapitre');

        await next.click();
        await expect(page).toHaveURL(/histoire\.html\?id=c3/);
        await expect(page.locator('.li-chapters__label')).toHaveText('Chapitre 3 sur 3');
    });

    test('dernier chapitre publié : « La suite arrive bientôt », puis fin de série', async ({ page }) => {
        await stubBackend(page, READER);
        await page.goto('/histoire.html?id=c3');
        await expect(page.locator('.li-chapter-next__soon')).toHaveText('La suite arrive bientôt');
        await expect(page.locator('.li-chapter-next__go')).toHaveCount(0);
        await expect(page.locator('.li-story-end__mark')).toHaveText('Fin du chapitre');

        await stubBackend(page, { ...READER, serie: { ...SERIE, statut: 'terminee' } });
        await page.reload();
        await expect(page.locator('.li-chapter-next__soon')).toHaveText('Fin de la série');
        await expect(page.locator('.li-story-end__mark')).toHaveText('Fin');
    });

    test('histoire seule : aucune navigation de chapitres', async ({ page }) => {
        await stubBackend(page, READER);
        await page.goto('/histoire.html?id=solo');
        await expect(page.locator('.story-header h1')).toHaveText('Le quai de la gare');
        await expect(page.locator('.li-story-end__mark')).toHaveText('Fin');
        await expect(page.locator('.li-chapters, .li-chapter-next')).toHaveCount(0);
    });

    test('mobile : pas de défilement horizontal', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await stubBackend(page, READER);
        await page.goto('/histoire.html?id=c2');
        await expect(page.locator('.li-chapter-next__go')).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
    });
});

test.describe('Fil : une carte par série', () => {
    test('les chapitres d\'une série forment une seule carte vers le chapitre 1', async ({ page }) => {
        await stubBackend(page, READER);
        await page.goto('/feed.html');
        const cards = page.locator('#storiesGrid .story-card');
        await expect(cards).toHaveCount(2);
        const serie = cards.filter({ hasText: 'Nos étés' });
        await expect(serie).toHaveCount(1);
        await expect(serie).toHaveAttribute('href', 'histoire.html?id=a');
        await expect(serie.locator('.story-series')).toHaveText('3 chapitres · en cours');
        await expect(cards.first()).toContainText('Nos étés');
        await expect(cards.filter({ hasText: 'Le quai de la gare' }).locator('.story-series')).toHaveCount(0);
    });
});
