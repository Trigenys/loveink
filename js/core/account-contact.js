// account-contact.js - Copie minimale de l'e-mail du compte dans `comptes_prives/{uid}`.
// Le profil public `utilisateurs` est lisible par tout membre connecté : l'e-mail n'y va jamais.
// `comptes_prives` n'est lisible que par son titulaire et les admins (firestore.rules), et la règle
// impose que l'e-mail écrit soit celui du jeton d'authentification : impossible d'en déclarer un autre.
// Idempotent : aucune écriture si la copie est déjà à jour (une lecture au plus par session d'onglet).

import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { db } from './firebase-config.js';

export const PRIVATE_ACCOUNTS = 'comptes_prives';
const syncKey = (uid) => `loveInk_contactSync:${uid}`;

function alreadySynced(uid, email) {
    try { return sessionStorage.getItem(syncKey(uid)) === email; } catch { return false; }
}

function markSynced(uid, email) {
    try { sessionStorage.setItem(syncKey(uid), email); } catch { /* stockage indisponible : simple lecture en plus */ }
}

export async function syncAccountContact(user) {
    const uid = String(user?.uid || '');
    const email = String(user?.email || '');
    if (!uid || !email || alreadySynced(uid, email)) return { ok: true, skipped: true };
    try {
        const ref = doc(db, PRIVATE_ACCOUNTS, uid);
        const snap = await getDoc(ref);
        if (snap.exists() && snap.data()?.email === email) {
            markSynced(uid, email);
            return { ok: true, unchanged: true };
        }
        await setDoc(ref, { uid, email, dateMaj: serverTimestamp() });
        markSynced(uid, email);
        return { ok: true, written: true };
    } catch (error) {
        // Non bloquant : l'admin verra simplement « e-mail inconnu » pour ce compte.
        console.warn('Synchro du contact privé impossible :', error?.code || error?.message || error);
        return { ok: false, error: error?.code || 'unknown' };
    }
}
