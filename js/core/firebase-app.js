// firebase-app.js - App et Auth seuls (pas de Firestore) : pour les pages publiques qui ne lisent
// aucune donnée, afin de ne pas charger le SDK Firestore (~130 KiB) inutilement.
import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { firebaseConfig } from './firebase-public-config.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app, auth, firebaseConfig };
