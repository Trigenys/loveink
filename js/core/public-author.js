// public-author.js - Nom d'auteur public d'une histoire.
// Seul le pseudonyme du profil (utilisateurs/{uid}.pseudo) peut devenir public :
// il alimente les pages /histoires/auteur/<slug>, le JSON-LD et les URL.
// Aucun nom n'est jamais dérivé de l'adresse e-mail.

export const PSEUDO_SETTINGS_URL = 'parametres.html';

/**
 * Résout le nom d'auteur public à partir du profil.
 * @param {{ pseudo?: unknown } | null | undefined} profile profil Firestore de l'utilisateur
 * @param {{ email?: string | null } | null | undefined} user utilisateur Firebase Auth (sert uniquement au contrôle)
 * @returns {{ ok: true, auteur: string } | { ok: false, reason: 'missing' | 'email' }}
 */
export function resolvePublicAuthorName(profile, user) {
    const pseudo = String(profile?.pseudo ?? '').trim();
    if (!pseudo) return { ok: false, reason: 'missing' };

    // Un pseudo qui contient « @ » ou qui reprend l'identifiant de l'e-mail
    // (ancien repli automatique) exposerait l'adresse : il est refusé.
    if (pseudo.includes('@')) return { ok: false, reason: 'email' };
    const email = String(user?.email ?? '').trim().toLowerCase();
    const localPart = email.includes('@') ? email.slice(0, email.indexOf('@')) : '';
    if (localPart && pseudo.toLowerCase() === localPart) return { ok: false, reason: 'email' };

    return { ok: true, auteur: pseudo };
}

export function authorNameErrorMessage(reason) {
    if (reason === 'email') {
        return "Votre pseudo reprend votre adresse e-mail. Choisissez un pseudonyme différent dans vos paramètres avant de publier : il sera affiché publiquement comme nom d'auteur.";
    }
    return "Choisissez d'abord un pseudonyme dans vos paramètres : il sera affiché publiquement comme nom d'auteur.";
}
