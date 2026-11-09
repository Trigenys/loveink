'use strict';
// Réinitialisation de mot de passe : ne génère le lien que pour un compte existant.
// L'Admin SDK ne renvoie pas `auth/user-not-found` pour une adresse inconnue mais
// `auth/internal-error` (« INTERNAL ASSERT FAILED: Unable to create the email action link ») :
// on vérifie donc l'existence d'abord, pour que seule une vraie panne (Admin SDK, Resend) remonte.
const NOT_FOUND = new Set(['auth/user-not-found', 'auth/email-not-found']);

async function sendPasswordReset({ auth, deliver, email, continueUrl, toActionLink = (l) => l }) {
    try {
        await auth.getUserByEmail(email);
    } catch (e) {
        if (NOT_FOUND.has(e.code)) return 'unknown';
        throw e;
    }
    const link = toActionLink(await auth.generatePasswordResetLink(email, { url: continueUrl }));
    await deliver('passwordReset', email, { link });
    return 'sent';
}
module.exports = { sendPasswordReset };
