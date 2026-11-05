const { expect } = require('@playwright/test');

const DEFAULT_PASSWORD = process.env.E2E_PASSWORD || 'LoveInkTest@2026';

function randomSuffix() {
    return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function makeUser(seed = 'e2e') {
    const suffix = randomSuffix();
    return {
        pseudo: `${seed}-${suffix}`.slice(0, 38),
        email: `${seed}.${suffix}@loveink-e2e.test`,
        password: DEFAULT_PASSWORD
    };
}

async function closeModalIfPresent(page) {
    const button = page.locator('.li-modale-btn-primary');
    try {
        await button.waitFor({ state: 'visible', timeout: 3500 });
        await button.click();
        return true;
    } catch {
        return false;
    }
}

function urlMatches(page, pattern) {
    const current = page.url();
    if (pattern instanceof RegExp) return pattern.test(current);
    return current.includes(String(pattern));
}

async function waitForRedirectWithModalHandling(page, expectedUrl, timeoutMs = 45000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (urlMatches(page, expectedUrl)) return;

        const clicked = await closeModalIfPresent(page);
        if (clicked && urlMatches(page, expectedUrl)) return;

        await page.waitForTimeout(300);
    }

    throw new Error(`Redirection non atteinte dans le delai (${timeoutMs}ms). URL actuelle: ${page.url()}`);
}

async function readSession(page) {
    return page.evaluate(() => {
        try {
            return JSON.parse(localStorage.getItem('loveInk_user') || 'null');
        } catch {
            return null;
        }
    });
}

async function registerWithUi(page, user, options = {}) {
    const {
        type = 'lecteur',
        bio = 'Compte test e2e',
        expectRedirectTo = /\/feed(\.html)?($|\?)/
    } = options;

    await page.goto('/register.html');
    await expect(page.locator('#registerForm')).toBeVisible();

    await page.fill('#pseudo', user.pseudo);
    await page.fill('#email', user.email);
    await page.fill('#password', user.password);
    await page.fill('#confirmPassword', user.password);
    await page.selectOption('#type', type);
    await page.fill('#bio', bio);
    await page.check('#consent');
    await page.click('#registerForm button[type="submit"]');
    await waitForRedirectWithModalHandling(page, expectRedirectTo, 60000);

    const session = await readSession(page);
    return { ...user, uid: session?.uid || '', session };
}

async function loginWithUi(page, user, options = {}) {
    const { expectRedirectTo = /\/feed(\.html)?($|\?)/ } = options;
    await page.goto('/login.html');
    await expect(page.locator('#loginForm')).toBeVisible();
    await page.fill('#email', user.email);
    await page.fill('#password', user.password);
    await page.click('#loginForm button[type="submit"]');
    await waitForRedirectWithModalHandling(page, expectRedirectTo, 45000);
    return readSession(page);
}

async function logoutFromNav(page) {
    const trigger = page.locator('#navUser, #userProfile').first();
    await trigger.waitFor({ state: 'visible', timeout: 15000 });
    await trigger.click();
    await page.locator('#logoutBtn').click();
    await page.waitForURL(/\/($|index(?:\.html)?(?:\?|$))/, { timeout: 20000 });
}

async function ensureFeedLoaded(page) {
    await expect(page).toHaveURL(/\/feed(\.html)?($|\?)/);
    await expect(page.locator('#categoriesGrid')).toBeVisible();
    await expect.poll(async () => {
        return page.locator('#categoriesGrid .cat-card').count();
    }, { timeout: 30000 }).toBeGreaterThan(0);
}

async function waitForAuthReady(page, timeoutMs = 30000) {
    await page.waitForFunction(() => {
        const readyFlag = document.documentElement?.dataset?.authReady;
        if (readyFlag === '1') return true;

        try {
            const raw = localStorage.getItem('loveInk_user');
            if (!raw) return false;
            const session = JSON.parse(raw);
            return Boolean(session && session.uid);
        } catch {
            return false;
        }
    }, { timeout: timeoutMs });
}

async function ensureMessagingConversationOpen(page, otherUid, timeoutMs = 60000) {
    if (!otherUid) {
        throw new Error('ensureMessagingConversationOpen: otherUid manquant.');
    }

    await page.goto(`/messagerie.html?with=${encodeURIComponent(String(otherUid))}`);
    await waitForAuthReady(page, Math.min(timeoutMs, 30000));

    const chatPanel = page.locator('#chatPanel');
    const conversationItems = page.locator('#conversationsList .conversation-item');

    if (await chatPanel.isVisible()) return;

    try {
        await expect.poll(async () => {
            return conversationItems.count();
        }, { timeout: 15000 }).toBeGreaterThan(0);
    } catch {
        // Fallback deterministe: force la creation de conversation via firebaseAPI expose dans la page.
        const session = await readSession(page);
        if (!session?.uid) {
            throw new Error('Conversation introuvable et session locale absente.');
        }

        await page.waitForFunction(() => {
            return Boolean(window.firebaseAPI && window.firebaseAPI.getOuCreerConversation);
        }, { timeout: 15000 });

        let convId = '';
        let lastBootstrapError = '';
        for (let attempt = 0; attempt < 12; attempt += 1) {
            const result = await page.evaluate(async ({ myUid, targetUid }) => {
                try {
                    const [{ getApp }, { getFirestore, doc, getDoc, setDoc, serverTimestamp }] = await Promise.all([
                        import('https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js'),
                        import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js')
                    ]);

                    const conversationId = [myUid, targetUid].sort().join('_');
                    const db = getFirestore(getApp());
                    const convRef = doc(db, 'conversations', conversationId);
                    const snap = await getDoc(convRef);

                    if (!snap.exists()) {
                        await setDoc(convRef, {
                            participants: [myUid, targetUid],
                            derniereActivite: serverTimestamp(),
                            dernierMessage: ''
                        });
                    }

                    return { ok: true, conversationId };
                } catch (error) {
                    return {
                        ok: false,
                        code: String(error?.code || ''),
                        message: String(error?.message || error || '')
                    };
                }
            }, { myUid: session.uid, targetUid: String(otherUid) });

            if (result?.ok && result.conversationId) {
                convId = result.conversationId;
                break;
            }

            lastBootstrapError = `${result?.code || 'unknown'} ${result?.message || ''}`.trim();
            const permissionDenied = /permission-denied|insufficient permissions/i.test(lastBootstrapError);
            if (permissionDenied) break;

            await page.waitForTimeout(1000);
        }

        if (!convId) {
            const details = lastBootstrapError ? ` (${lastBootstrapError})` : '';
            throw new Error(`Impossible de creer/recuperer la conversation en fallback${details}.`);
        }

        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForAuthReady(page, Math.min(timeoutMs, 30000));
        await expect.poll(async () => {
            return conversationItems.count();
        }, { timeout: 30000 }).toBeGreaterThan(0);
    }

    if (!(await chatPanel.isVisible())) {
        await conversationItems.first().click();
        await expect(chatPanel).toBeVisible({ timeout: 30000 });
    }
}

module.exports = {
    DEFAULT_PASSWORD,
    makeUser,
    closeModalIfPresent,
    readSession,
    registerWithUi,
    loginWithUi,
    logoutFromNav,
    ensureFeedLoaded,
    waitForAuthReady,
    ensureMessagingConversationOpen,
    waitForRedirectWithModalHandling
};
