// roles.js - Hiérarchie des rôles Love Ink, alignée sur firestore.rules (source de vérité côté serveur).
// user < moderateur < censeur < admin : chaque niveau hérite des droits du niveau inférieur.
// Ces helpers ne pilotent que l'affichage ; les règles Firestore décident de ce qui est permis.

export const ROLES = Object.freeze(['user', 'moderateur', 'censeur', 'admin']);

export const ROLE_LABELS = Object.freeze({
    user: 'Membre',
    moderateur: 'Modérateur',
    censeur: 'Censeur',
    admin: 'Admin'
});

const rank = (role) => ROLES.indexOf(String(role || 'user'));

export const isModoRole = (role) => rank(role) >= rank('moderateur');
export const isCenseurRole = (role) => rank(role) >= rank('censeur');
export const isAdminRole = (role) => String(role || '') === 'admin';
export const isKnownRole = (role) => ROLES.includes(String(role || ''));
