// firebase-config.js - Configuration unique Firebase (SDK v9 modulaire)
import { browserLocalPersistence, setPersistence } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { initTheme } from './theme.js';
import { app, auth, firebaseConfig } from './firebase-app.js';


const db = getFirestore(app);

// Initialise le theme global le plus tot possible.
initTheme();

// Persistance session locale (best effort).
setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.warn("Impossible d'appliquer la persistance locale:", error?.message || error);
});

export { app, auth, db, firebaseConfig };
