// email-verification.js - Connexion reservee aux adresses e-mail confirmees.
// Ce controle est cote client (parcours utilisateur) ; il ne remplace pas les regles Firestore.
import { sendEmailVerification } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { requestVerificationEmail } from './mailer-client.js';

export const REQUIRE_VERIFIED_EMAIL = true;
// Indique a login.html qu'un compte a ete deconnecte faute de confirmation.
export const VERIFY_PENDING_KEY = 'loveInk_verifyPending';

/** Relit l'etat du compte (le lien a pu etre clique dans un autre onglet) puis renvoie emailVerified. */
export async function isEmailVerified(user) {
    if (!REQUIRE_VERIFIED_EMAIL || !user) return true;
    if (user.emailVerified) return true;
    try { await user.reload(); } catch { /* reseau indisponible : on garde l'etat connu */ }
    return user.emailVerified === true;
}

/** E-mail thematise via le service mailer, repli sur l'e-mail Firebase. Renvoie true si l'envoi est parti. */
export async function sendVerification(user, pseudo = '') {
    if (await requestVerificationEmail(user, pseudo || user?.displayName || '')) return true;
    try { await sendEmailVerification(user); return true; } catch { return false; }
}

export function markVerifyPending(email) {
    try {
        sessionStorage.setItem(VERIFY_PENDING_KEY, '1');
        if (email) sessionStorage.setItem('loveInk_prefillEmail', email);
    } catch { /* stockage indisponible */ }
}
