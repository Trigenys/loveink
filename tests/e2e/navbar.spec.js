// Barre de navigation des pages connectées, sans compte ni réseau Firebase :
// les modules Firebase sont remplacés par des simulations, les données restent en mémoire.
// À lancer contre un serveur local : E2E_BASE_URL=http://127.0.0.1:<port> npx playwright test navbar
const { test, expect } = require('@playwright/test');

const USER = { uid: 'u-e2e-nav', email: 'nav@loveink-e2e.test', displayName: 'Plume Nav' };
const STORIES = [
    { id: 's1', titre: 'Les lettres d’août', auteur: 'Camille', categorie: 'Romance', extrait: 'Une correspondance.' },
    { id: 's2', titre: 'Nos étés', auteur: 'Jules', categorie: 'Rencontres', extrait: 'Un été au bord de mer.' },
    { id: 's3', titre: 'Minuit à Lisbonne', auteur: 'Inès', categorie: 'Voyage', extrait: 'Le dernier tram.' }
];

const FIREBASE_CONFIG_STUB = `
const user = ${JSON.stringify(USER)};
user.getIdToken = async () => 'token-e2e';
export const auth = { currentUser: user };
export const db = {};
export const app = {};
`;

// Toute méthode non prévue répond « vide » : la page reste fonctionnelle sans backend.
const FIREBASE_DATA_STUB = `
const stories = ${JSON.stringify(STORIES)};
const known = {
    getHistoires: async () => ({ histoires: stories }),
    compterHistoiresParCategorie: async () => ({}),
    getUtilisateur: async () => ({ role: 'user', statut: 'actif', pseudo: 'Plume Nav' }),
    ecouterNotificationsNonLues: (uid, cb) => { setTimeout(() => cb(3), 0); return () => {}; }
};
export const firebaseAPI = new Proxy(known, {
    get: (target, name) => (name in target ? target[name] : async () => null)
});
`;

const AUTH_SESSION_STUB = `
export function requireAuth({ auth, onReady }) {
    setTimeout(() => onReady(auth.currentUser, { pseudo: 'Plume Nav' }), 0);
    return () => {};
}
export async function logoutAndRedirect() { sessionStorage.setItem('__loggedOut', '1'); }
`;

const FIREBASE_AUTH_STUB = `
export function onAuthStateChanged(auth, cb) { setTimeout(() => cb(auth.currentUser), 0); return () => {}; }
`;

async function stubBackend(page, { reading = null } = {}) {
    if (reading) {
        await page.addInitScript((r) => {
            localStorage.setItem(`loveInk_pos_${r.id}`, String(r.ratio));
            localStorage.setItem('loveInk_lus', JSON.stringify({ [r.id]: { titre: r.titre, ratio: r.ratio, t: Date.now() } }));
        }, reading);
    }
    const js = (body) => (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body });
    await page.route('**/js/core/firebase-config.js*', js(FIREBASE_CONFIG_STUB));
    await page.route('**/js/core/firebase-data.js*', js(FIREBASE_DATA_STUB));
    await page.route('**/js/core/auth-session.js*', js(AUTH_SESSION_STUB));
    await page.route('**/firebasejs/*/firebase-auth.js', js(FIREBASE_AUTH_STUB));
}

async function openFeed(page, query = '') {
    await page.goto(`/feed.html${query}`);
    await expect(page.locator('#storiesGrid')).toContainText('Nos étés');
}

const storyTitles = (page) => page.locator('#storiesGrid').innerText();

test.describe('Barre de navigation', () => {
    test('liens : plus d’« Accueil », recherche unique, rien n’est surligné en haut du fil', async ({ page }) => {
        await stubBackend(page);
        await openFeed(page);
        const nav = page.locator('#navLinks');
        await expect(nav.getByRole('link')).toHaveText(['Catégories', 'Messagerie']);
        await expect(page.locator('#searchInput, #searchBtn, .search-bar')).toHaveCount(0);
        await expect(page.getByRole('search')).toHaveCount(1);
        await expect(page.locator('#navSearchInput')).toBeVisible();
        await expect(page.locator('#navSearchToggle')).toBeHidden();
        await expect(nav.locator('[aria-current]')).toHaveCount(0);
        await expect(page.locator('#userPseudo')).toHaveText('Plume Nav');
        await expect(page.locator('#userPseudo')).not.toHaveClass(/is-loading/);
    });

    test('« Catégories » devient actif quand la section est à l’écran', async ({ page }) => {
        await stubBackend(page);
        await openFeed(page);
        await page.locator('#categories').scrollIntoViewIfNeeded();
        await page.evaluate(() => {
            const el = document.getElementById('categories');
            window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.4);
        });
        const link = page.locator('[data-nav-key="categories"]');
        await expect(link).toHaveClass(/is-active/);
        await expect(link).toHaveAttribute('aria-current', 'location');
    });

    test('recherche sur le fil : filtre sur place, effacer rétablit tout', async ({ page }) => {
        await stubBackend(page);
        await openFeed(page);
        await page.fill('#navSearchInput', 'lisbonne');
        await page.press('#navSearchInput', 'Enter');
        await expect(page).toHaveURL(/\/feed\.html$/);
        await expect(page.locator('#storiesGrid')).toContainText('Minuit à Lisbonne');
        expect(await storyTitles(page)).not.toContain('Nos étés');
        await page.fill('#navSearchInput', '');
        await expect(page.locator('#storiesGrid')).toContainText('Nos étés');
    });

    test('recherche depuis une autre page : ouvre le fil filtré (?q=)', async ({ page }) => {
        await stubBackend(page);
        await page.goto('/publier.html');
        await page.fill('#navSearchInput', 'Jules');
        await page.press('#navSearchInput', 'Enter');
        await expect(page).toHaveURL(/\/feed\.html\?q=Jules$/);
        await expect(page.locator('#storiesGrid')).toContainText('Nos étés');
        expect(await storyTitles(page)).not.toContain('Lisbonne');
        await expect(page.locator('#navSearchInput')).toHaveValue('Jules');
    });

    test('raccourci « / » : place le focus dans la recherche, pas pendant une saisie', async ({ page }) => {
        await stubBackend(page);
        await openFeed(page);
        await page.locator('body').click({ position: { x: 5, y: 400 } });
        await page.keyboard.press('/');
        await expect(page.locator('#navSearchInput')).toBeFocused();
        await expect(page.locator('#navSearchInput')).toHaveValue('');
        await page.keyboard.type('a/b');
        await expect(page.locator('#navSearchInput')).toHaveValue('a/b');
    });

    test('menu du compte : vrai bouton, clavier, Échap rend le focus', async ({ page }) => {
        await stubBackend(page);
        await openFeed(page);
        const trigger = page.getByRole('button', { name: /Menu du compte/ });
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await expect(page.locator('[role="menu"], [role="menuitem"]')).toHaveCount(0);
        await trigger.focus();
        await page.keyboard.press('ArrowDown');
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator('#navDropdown a').first()).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await expect(trigger).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
        const logout = page.getByRole('button', { name: 'Déconnexion' });
        await expect(logout).toBeVisible();
        await logout.click();
        await expect.poll(() => page.evaluate(() => sessionStorage.getItem('__loggedOut'))).toBe('1');
    });

    test('cloche : le nombre de non lues est annoncé', async ({ page }) => {
        await stubBackend(page);
        await openFeed(page);
        await expect(page.locator('#navNotifBell')).toHaveAttribute('aria-label', 'Notifications, 3 non lues');
    });

    test('reprise : lien vers la dernière lecture, absent sur la page de lecture', async ({ page }) => {
        await stubBackend(page, { reading: { id: 's2', titre: 'Nos étés', ratio: 0.42 } });
        await openFeed(page);
        const resume = page.locator('#navResume');
        await expect(resume).toHaveAttribute('href', 'histoire.html?id=s2');
        await expect(resume).toHaveAttribute('title', /Nos étés.*42 % lu/);
        await page.route('**/histoire.html*', (route) => route.fulfill({
            status: 200, contentType: 'text/html',
            body: `<!doctype html><div id="appNavRoot"></div><script type="module">
                import { mountAppNav } from './js/components/nav-component.js';
                mountAppNav({ active: 'histoire', footer: false });</script>`
        }));
        await page.goto('/histoire.html?id=s2');
        await expect(page.locator('#navLinks')).toBeVisible();
        await expect(page.locator('#navResume')).toHaveCount(0);
    });

    test('mobile : la loupe ouvre la recherche, Échap la referme', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 800 });
        await stubBackend(page);
        await openFeed(page);
        const toggle = page.getByRole('button', { name: 'Rechercher' });
        await expect(page.locator('#navSearchInput')).toBeHidden();
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator('#navSearchInput')).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(toggle).toBeFocused();
        await page.keyboard.press('/');
        await expect(page.locator('#navSearchInput')).toBeFocused();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
    });
});
