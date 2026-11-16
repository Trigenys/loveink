// fresh-doc.js - Lecture d'un document sans la vue locale partielle des écritures en attente.
// Une écriture { merge: true } encore en attente (ex. présence) sur un document absent du cache fait
// renvoyer à getDoc un document limité aux champs écrits. Dans ce cas on relit la version serveur.
import { getDoc, getDocFromServer } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

export async function getFreshDoc(ref) {
    const snap = await getDoc(ref);
    if (!snap.metadata.hasPendingWrites) return snap;
    try {
        return await getDocFromServer(ref);
    } catch (_) {
        return snap; // Hors ligne : on garde la vue locale plutôt que rien.
    }
}
