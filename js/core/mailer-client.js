// Client du service d'e-mails thématisés (server/mailer). Chaque appel renvoie true si le
// service a pris la demande en charge, false sinon : l'appelant se replie alors sur Firebase.
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
export const MAILER_URL = isLocal ? 'http://127.0.0.1:8787' : 'https://mail.loveink.site';
const TIMEOUT_MS = 8000;

async function post(path, { body, token } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${MAILER_URL}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify(body || {}),
            signal: ctrl.signal
        });
        return res.ok;
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

export async function requestVerificationEmail(user, pseudo = '') {
    if (!user) return false;
    const token = await user.getIdToken().catch(() => null);
    if (!token) return false;
    return post('/v1/auth/verification', { token, body: { pseudo } });
}

export function requestPasswordReset(email) {
    return post('/v1/auth/password-reset', { body: { email } });
}
