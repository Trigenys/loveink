// admin-bootstrap-plan.mjs - Calcul pur (sans Firebase) du plan d'amorçage d'un administrateur.
// Entrée : état courant lu par le script (compte Auth, profil `utilisateurs`, contact `comptes_prives`).
// Sortie : liste des écarts et écritures minimales ; un état déjà convergé donne un plan vide.

export const BOOTSTRAP_SOURCE = 'admin_bootstrap';
export const PSEUDO_MAX = 40; // même borne que firestore.rules

export function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

export function validateInputs({ email, pseudo }) {
    const errors = [];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email))) errors.push('--email attend une adresse e-mail valide.');
    const p = String(pseudo || '').trim();
    if (!p) errors.push('--pseudo est obligatoire.');
    if (p.length > PSEUDO_MAX) errors.push(`--pseudo dépasse ${PSEUDO_MAX} caractères.`);
    return errors;
}

/**
 * @param {object} state
 * @param {{uid:string,email:string,displayName?:string}} state.authUser compte Auth existant (jamais créé ici)
 * @param {object|null} state.profile document `utilisateurs/{uid}` ou null
 * @param {object|null} state.contact document `comptes_prives/{uid}` ou null
 * @param {object} desired
 * @param {string} desired.pseudo
 * @param {string} [desired.role='admin']
 */
export function planAdminBootstrap({ authUser, profile, contact }, { pseudo, role = 'admin' }) {
    if (!authUser?.uid) throw new Error('planAdminBootstrap : compte Auth requis.');
    const uid = authUser.uid;
    const wantedPseudo = String(pseudo).trim();
    const changes = [];
    let profileCreate = null;
    let profileUpdate = null;
    let contactWrite = null;
    let authUpdate = null;

    if (!profile) {
        // Profil absent (inscription interrompue) : profil minimal, mêmes champs que l'inscription.
        profileCreate = {
            uid, pseudo: wantedPseudo, bio: '', abonnes: 0, histoires: 0,
            role, statut: 'actif', suspensionJusqua: null,
            roleUpdatedBy: BOOTSTRAP_SOURCE, roleUpdateSource: BOOTSTRAP_SOURCE
        };
        changes.push({ target: `utilisateurs/${uid}`, field: '(document)', from: null, to: 'profil minimal' });
    } else {
        const update = {};
        const currentRole = profile.role || 'user';
        if (currentRole !== role) {
            Object.assign(update, { role, roleUpdatedBy: BOOTSTRAP_SOURCE, roleUpdateSource: BOOTSTRAP_SOURCE });
            changes.push({ target: `utilisateurs/${uid}`, field: 'role', from: profile.role ?? null, to: role });
        }
        if (String(profile.pseudo || '') !== wantedPseudo) {
            update.pseudo = wantedPseudo;
            changes.push({ target: `utilisateurs/${uid}`, field: 'pseudo', from: profile.pseudo ?? null, to: wantedPseudo });
        }
        if (Object.keys(update).length) profileUpdate = update;
    }

    if (String(authUser.displayName || '') !== wantedPseudo) {
        authUpdate = { displayName: wantedPseudo };
        changes.push({ target: `auth/${uid}`, field: 'displayName', from: authUser.displayName ?? null, to: wantedPseudo });
    }

    const email = String(authUser.email || '');
    if (email && (contact?.email !== email || contact?.uid !== uid)) {
        contactWrite = { uid, email };
        changes.push({ target: `comptes_prives/${uid}`, field: 'email', from: contact?.email ?? null, to: email });
    }

    return { uid, changes, profileCreate, profileUpdate, contactWrite, authUpdate, converged: changes.length === 0 };
}

// Rattrapage des e-mails privés des comptes existants : seuls les comptes absents ou divergents sont écrits.
export function planContactBackfill(authUsers, contactsByUid) {
    return authUsers
        .filter((user) => user.uid && user.email)
        .filter((user) => {
            const current = contactsByUid.get(user.uid);
            return !current || current.email !== user.email || current.uid !== user.uid;
        })
        .map((user) => ({ uid: user.uid, email: user.email, from: contactsByUid.get(user.uid)?.email ?? null }));
}
