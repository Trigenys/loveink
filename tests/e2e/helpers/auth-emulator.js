// auth-emulator.js - Confirme l'e-mail d'un compte de test via l'API d'administration de l'émulateur Auth.
// La connexion exige une adresse confirmée : sur émulateur, on pose emailVerified=true au lieu de cliquer un lien.
// "Bearer owner" n'est accepté que par l'émulateur ; ces appels ne visent jamais la production.

const AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-love-ink';
const OWNER = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };

function accountsUrl(action) {
    return `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:${action}`;
}

async function postJson(request, action, data) {
    const response = await request.post(accountsUrl(action), { headers: OWNER, data });
    if (!response.ok()) {
        throw new Error(`Émulateur Auth (${action}) : HTTP ${response.status()} ${await response.text()}`);
    }
    return response.json();
}

/**
 * Idempotent : ne modifie que les comptes non confirmés.
 * @returns {Promise<'verified'|'already'>}
 */
async function verifyEmailOnEmulator(request, email) {
    const { users = [] } = await postJson(request, 'lookup', { email: [email] });
    const account = users[0];
    if (!account) throw new Error(`Émulateur Auth : aucun compte pour ${email}.`);
    if (account.emailVerified) return 'already';
    await postJson(request, 'update', { localId: account.localId, emailVerified: true });
    return 'verified';
}

module.exports = { verifyEmailOnEmulator, AUTH_EMULATOR_HOST, PROJECT_ID };
