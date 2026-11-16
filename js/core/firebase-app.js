// firebase-app.js - App et Auth seuls (pas de Firestore) : pour les pages publiques qui ne lisent
// aucune donnée, afin de ne pas charger le SDK Firestore (~130 KiB) inutilement.
import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { connectAuthEmulator, getAuth } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { firebaseConfig as publicConfig } from './firebase-public-config.js';
import { EMULATORS, configForTarget, exposeFirebaseTarget, resolveFirebaseTarget } from './firebase-target.js';

const firebaseTarget = resolveFirebaseTarget();
const firebaseConfig = configForTarget(publicConfig, firebaseTarget);
const firstInit = !getApps().length;
const app = firstInit ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

if (firstInit && firebaseTarget === 'emulators') {
    connectAuthEmulator(auth, EMULATORS.authUrl, { disableWarnings: true });
}
exposeFirebaseTarget(firebaseTarget);

export { app, auth, firebaseConfig, firebaseTarget };
