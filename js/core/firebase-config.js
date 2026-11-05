// firebase-config.js - Configuration unique Firebase (SDK v9 modulaire)
import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { browserLocalPersistence, getAuth, setPersistence } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { initTheme } from './theme.js';

// NOTE: Les cles Firebase cote client sont publiques par design.
const firebaseConfig = {
    apiKey: "AIzaSyCuhBZY1JZ0ikozWncRUVzR6n046lJckz8",
    authDomain: "love-ink.firebaseapp.com",
    projectId: "love-ink",
    storageBucket: "love-ink.firebasestorage.app",
    messagingSenderId: "942272722437",
    appId: "1:942272722437:web:a76058c6f0f92cda1bce6c"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Initialise le theme global le plus tot possible.
initTheme();

// Persistance session locale (best effort).
setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.warn("Impossible d'appliquer la persistance locale:", error?.message || error);
});

export { app, auth, db, firebaseConfig };
