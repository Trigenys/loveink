// e2e-test-accounts.mjs - Logique pure (sans Firebase) du nettoyage des comptes de test e2e en production.
// Partagée par `e2e-prod-cleanup-plan.mjs` (inventaire) et `e2e-prod-cleanup-apply.mjs` (suppression).
//
// Règle de sûreté : seul un compte dont l'e-mail se termine par `@<domaine>.test` est supprimable,
// et chaque document n'est supprimé que si, relu au moment de l'application, il appartient encore
// exclusivement à de tels comptes. Un plan édité à la main ne peut donc pas viser un compte réel.

export const DEFAULT_TEST_DOMAIN = 'loveink-e2e.test';

// Collections rattachées à un compte : champ porteur de l'uid et mode de requête.
// `docId` : le document a pour identifiant l'uid ; `in` : égalité ; `array` : uid présent dans un tableau.
// Ordre = ordre de suppression : contenus d'abord, profil et contact privé en dernier.
// Non couverts volontairement : `sanctions` et `ops_logs` (traces de modération et d'exploitation).
export const LINKED_COLLECTIONS = Object.freeze([
    { collection: 'histoires', field: 'auteurId', mode: 'in', label: (d) => d.titre || '(sans titre)' },
    { collection: 'series', field: 'auteurId', mode: 'in', label: (d) => d.titre || '(sans titre)' },
    { collection: 'commentaires', field: 'auteurId', mode: 'in' },
    { collection: 'likes', field: 'userId', mode: 'in' },
    { collection: 'abonnements', field: 'abonneId', mode: 'in' },
    { collection: 'abonnements', field: 'auteurId', mode: 'in' },
    { collection: 'notifications', field: 'utilisateurId', mode: 'in' },
    { collection: 'conversations', field: 'participants', mode: 'array' },
    { collection: 'messages', field: 'expediteurId', mode: 'in' },
    { collection: 'candidatures_moderateur', field: 'userId', mode: 'in' },
    { collection: 'comptes_prives', mode: 'docId' },
    { collection: 'utilisateurs', mode: 'docId' }
].map(Object.freeze));

export function specFor(collection, field) {
    return LINKED_COLLECTIONS.find((s) => s.collection === collection && (s.field || '(id)') === field) || null;
}

export function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

/** Domaine de test : sans @, et sous le TLD réservé `.test` (RFC 2606), jamais un domaine réel. */
export function validateTestDomain(domain) {
    const d = String(domain || '').trim().toLowerCase();
    if (!d || d.includes('@')) return '--domain attend un domaine sans @ (ex. loveink-e2e.test).';
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.test$/.test(d)) return `Domaine refusé : « ${d} » n'est pas sous le TLD réservé .test.`;
    return '';
}

export function isTestEmail(email, domain = DEFAULT_TEST_DOMAIN) {
    const e = normalizeEmail(email);
    const suffix = `@${String(domain).toLowerCase()}`;
    return e.endsWith(suffix) && e.length > suffix.length;
}

/**
 * Comptes réellement supprimables, d'après l'état relu en direct (jamais d'après le seul plan).
 * @param {Array<{uid:string,email?:string}>} planAccounts comptes listés par le plan
 * @param {Map<string,{authEmail?:string|null, profileEmail?:string|null, privateEmail?:string|null}>} live
 * @returns {{ uids: string[], refused: Array<{uid:string, reason:string}> }}
 */
export function verifyAccounts(planAccounts, live, domain = DEFAULT_TEST_DOMAIN) {
    const uids = [];
    const refused = [];
    for (const account of planAccounts || []) {
        const uid = String(account?.uid || '');
        if (!uid) { refused.push({ uid: '(vide)', reason: 'uid manquant dans le plan' }); continue; }
        const state = live.get(uid) || {};
        const emails = [state.authEmail, state.profileEmail, state.privateEmail].filter((e) => e != null && e !== '');
        if (emails.length === 0) {
            refused.push({ uid, reason: 'aucun e-mail lisible (compte Auth, profil et contact privé absents ou vides)' });
        } else if (!emails.every((e) => isTestEmail(e, domain))) {
            refused.push({ uid, reason: `e-mail hors domaine de test : ${emails.filter((e) => !isTestEmail(e, domain)).join(', ')}` });
        } else {
            uids.push(uid);
        }
    }
    return { uids, refused };
}

/**
 * Un document relu peut-il être supprimé ? Il doit appartenir exclusivement à des comptes de test vérifiés.
 * @returns {{ ok: boolean, reason: string }}
 */
export function canDelete(spec, docId, data, testUids) {
    const set = testUids instanceof Set ? testUids : new Set(testUids);
    if (!spec) return { ok: false, reason: 'collection non prévue' };
    if (!data) return { ok: false, reason: 'déjà absent' };
    if (spec.mode === 'docId') {
        return set.has(docId) ? { ok: true, reason: '' } : { ok: false, reason: 'identifiant hors comptes de test' };
    }
    if (spec.mode === 'array') {
        const members = Array.isArray(data[spec.field]) ? data[spec.field] : [];
        if (!members.some((m) => set.has(m))) return { ok: false, reason: 'plus rattaché à un compte de test' };
        return members.every((m) => set.has(m))
            ? { ok: true, reason: '' }
            : { ok: false, reason: 'participant réel : conservé' };
    }
    return set.has(data[spec.field]) ? { ok: true, reason: '' } : { ok: false, reason: `${spec.field} hors comptes de test` };
}

/** Le plan doit viser le projet et le domaine demandés, et ne lister que des e-mails de test. */
export function validatePlan(plan, { project, domain }) {
    const errors = [];
    if (!plan || plan.mode !== 'plan') errors.push('Fichier de plan invalide (attendu : sortie --json de e2e-prod-cleanup-plan.mjs).');
    else {
        if (plan.project !== project) errors.push(`Le plan vise le projet « ${plan.project} », pas « ${project} ».`);
        if (plan.domain !== domain) errors.push(`Le plan vise le domaine « ${plan.domain} », pas « ${domain} ».`);
        const outside = (plan.accounts || []).filter((a) => a.email && !isTestEmail(a.email, domain));
        if (outside.length) errors.push(`Le plan contient des e-mails hors domaine de test : ${outside.map((a) => a.email).join(', ')}.`);
    }
    return errors;
}
