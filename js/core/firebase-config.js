// firebase-config.js - Configuration unique Firebase (SDK v9 modulaire)
import { browserLocalPersistence, setPersistence } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { connectFirestoreEmulator, getFirestore } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { initTheme } from './theme.js';
import { app, auth, firebaseConfig, firebaseTarget } from './firebase-app.js';
import { EMULATORS } from './firebase-target.js';


const db = getFirestore(app);
if (firebaseTarget === 'emulators' && !globalThis.__LOVEINK_FIRESTORE_EMULATOR__) {
    connectFirestoreEmulator(db, EMULATORS.firestoreHost, EMULATORS.firestorePort);
    globalThis.__LOVEINK_FIRESTORE_EMULATOR__ = true;
}

// Initialise le theme global le plus tot possible.
initTheme();

// Persistance session locale (best effort).
setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.warn("Impossible d'appliquer la persistance locale:", error?.message || error);
});

export { app, auth, db, firebaseConfig, firebaseTarget };
