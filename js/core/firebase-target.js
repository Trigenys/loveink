// firebase-target.js - Choisit la cible Firebase du client : émulateurs locaux ou projet réel.
// Sur un hôte local (localhost, 127.0.0.1, [::1], *.localhost), le client parle par défaut à la
// Firebase Emulator Suite sous un projet `demo-*` : aucune écriture ne peut atteindre la prod.
// Dérogation explicite et volontaire : localStorage.setItem('loveInk_firebaseTarget', 'production').

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const OVERRIDE_KEY = 'loveInk_firebaseTarget';

export const EMULATOR_PROJECT_ID = 'demo-love-ink';
// Ports alignés sur la section "emulators" de firebase.json.
export const EMULATORS = Object.freeze({
    authUrl: 'http://127.0.0.1:9099',
    firestoreHost: '127.0.0.1',
    firestorePort: 8080
});

export function isLocalHost(hostname) {
    const host = String(hostname || '').toLowerCase();
    return LOCAL_HOSTS.has(host) || host.endsWith('.localhost');
}

function readOverride() {
    try {
        return globalThis.localStorage?.getItem(OVERRIDE_KEY) || '';
    } catch {
        return '';
    }
}

export function resolveFirebaseTarget(location = globalThis.location) {
    if (!isLocalHost(location?.hostname)) return 'production';
    return readOverride() === 'production' ? 'production' : 'emulators';
}

export function configForTarget(config, target) {
    return target === 'emulators' ? { ...config, projectId: EMULATOR_PROJECT_ID } : config;
}

export function exposeFirebaseTarget(target) {
    globalThis.__LOVEINK_FIREBASE_TARGET__ = target;
    try {
        document.documentElement.dataset.firebaseTarget = target;
    } catch {
        // Contexte sans DOM : rien à exposer.
    }
    if (target === 'emulators') {
        console.info(`[Love Ink] Firebase Emulator Suite (${EMULATOR_PROJECT_ID}) : aucune donnée de production.`);
    }
}
