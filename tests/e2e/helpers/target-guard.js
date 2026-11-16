// target-guard.js - Empêche les e2e d'écrire dans la production Love Ink par défaut.
// Les e2e créent des comptes et des histoires : ils tournent sur la Firebase Emulator Suite.
// Viser un hôte distant (prod, canal de prévisualisation, staging partageant le projet `love-ink`)
// exige E2E_ALLOW_PROD=1, posé explicitement et en connaissance de cause.

const DEFAULT_BASE_URL = 'http://127.0.0.1:5000';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function isLocalUrl(url) {
    let host;
    try {
        host = new URL(url).hostname.toLowerCase();
    } catch {
        return false;
    }
    return LOCAL_HOSTS.has(host) || host.endsWith('.localhost');
}

function prodAllowed(env = process.env) {
    return env.E2E_ALLOW_PROD === '1';
}

function resolveE2eBaseUrl(env = process.env) {
    const baseURL = String(env.E2E_BASE_URL || DEFAULT_BASE_URL).trim();
    if (!isLocalUrl(baseURL) && !prodAllowed(env)) {
        throw new Error(
            `E2E bloqués : ${baseURL} n'est pas un hôte local et les e2e créent des comptes réels. ` +
            'Lancer `npm run test:e2e` (émulateurs) ou, en connaissance de cause, poser E2E_ALLOW_PROD=1.'
        );
    }
    return baseURL;
}

// Vérifie dans la page que le client Firebase vise bien les émulateurs avant toute écriture.
async function assertEmulatorTarget(page, env = process.env) {
    if (prodAllowed(env)) return;
    const target = await page
        .waitForFunction(() => globalThis.__LOVEINK_FIREBASE_TARGET__, null, { timeout: 15000 })
        .then((handle) => handle.jsonValue())
        .catch(() => '');
    if (target !== 'emulators') {
        throw new Error(
            `E2E bloqués : le client Firebase vise "${target || 'inconnu'}" et non les émulateurs. ` +
            'Aucune écriture ne doit partir vers la production sans E2E_ALLOW_PROD=1.'
        );
    }
}

module.exports = { DEFAULT_BASE_URL, isLocalUrl, prodAllowed, resolveE2eBaseUrl, assertEmulatorTarget };
