'use strict';
// Service HTTP minimal (Node natif) : génère les liens d'action Firebase via l'Admin SDK
// et envoie les e-mails thématisés via Resend. Aucun secret n'est journalisé.
const http = require('http');
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const cfg = require('./config');
const { sendEmail } = require('./resend');
const { templates } = require('./templates');

// Admin SDK : GOOGLE_APPLICATION_CREDENTIALS (chemin du compte de service) ou FIREBASE_SERVICE_ACCOUNT_JSON.
const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
admin.initializeApp(saJson ? { credential: admin.credential.cert(JSON.parse(saJson)) } : {});
const auth = admin.auth();

const actionUrl = `${cfg.appBaseUrl}${cfg.actionPath}`;
const templateCtx = { brandName: cfg.brandName, appBaseUrl: cfg.appBaseUrl, logoUrl: cfg.logoUrl };

// --- Utilitaires ---------------------------------------------------------
const json = (res, status, body, extra = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...extra });
    res.end(JSON.stringify(body));
};
const readJson = (req) => new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 16 * 1024) { reject(new Error('payload trop volumineux')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('JSON invalide')); } });
    req.on('error', reject);
});
const clientIp = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
const log = (level, msg, meta = {}) => console[level === 'error' ? 'error' : 'log'](JSON.stringify({ t: new Date().toISOString(), level, msg, ...meta }));
const maskEmail = (e = '') => e.replace(/^(.).*(@.*)$/, '$1***$2');

// Limitation de débit en mémoire (par IP et par adresse). Suffisant pour une seule instance.
const buckets = new Map();
function rateLimited(key) {
    const now = Date.now();
    const b = buckets.get(key) || [];
    const recent = b.filter((t) => now - t < cfg.rateLimit.windowMs);
    if (recent.length >= cfg.rateLimit.max) { buckets.set(key, recent); return true; }
    recent.push(now); buckets.set(key, recent); return false;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of buckets) if (!v.some((t) => now - t < cfg.rateLimit.windowMs)) buckets.delete(k); }, 60_000).unref();

function cors(req, res) {
    const origin = req.headers.origin;
    if (origin && cfg.allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        res.setHeader('Access-Control-Max-Age', '600');
        return true;
    }
    return !origin; // requêtes sans Origin (curl, health checks) acceptées
}

async function deliver(kind, to, extra) {
    const msg = templates[kind]({ ...templateCtx, ...extra });
    const r = await sendEmail({
        apiKey: cfg.resendApiKey, endpoint: cfg.resendEndpoint, from: cfg.mailFrom, replyTo: cfg.replyTo,
        to, subject: msg.subject, html: msg.html, text: msg.text, tags: [{ name: 'kind', value: kind }]
    });
    log('info', 'mail envoyé', { kind, to: maskEmail(to), id: r.id });
}

// --- Routes --------------------------------------------------------------
async function handleVerification(req, res) {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    if (!m) return json(res, 401, { error: 'jeton manquant' });
    let decoded;
    try { decoded = await auth.verifyIdToken(m[1]); } catch { return json(res, 401, { error: 'jeton invalide' }); }
    if (!decoded.email) return json(res, 400, { error: 'compte sans adresse e-mail' });
    if (decoded.email_verified) return json(res, 200, { ok: true, alreadyVerified: true });
    if (rateLimited(`v:${decoded.uid}`)) return json(res, 429, { error: 'trop de demandes, réessayez plus tard' });
    const body = await readJson(req).catch(() => ({}));
    const link = await auth.generateEmailVerificationLink(decoded.email, { url: actionUrl });
    await deliver('verification', decoded.email, { pseudo: String(body.pseudo || decoded.name || '').slice(0, 40), link });
    json(res, 200, { ok: true });
}

async function handlePasswordReset(req, res) {
    const body = await readJson(req).catch(() => null);
    const email = String(body?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { error: 'adresse invalide' });
    // Réponse toujours identique : ne révèle pas l'existence d'un compte.
    if (rateLimited(`r:${clientIp(req)}`) || rateLimited(`r:${email}`)) return json(res, 200, { ok: true });
    try {
        const link = await auth.generatePasswordResetLink(email, { url: actionUrl });
        await deliver('passwordReset', email, { link });
    } catch (e) {
        // Compte inconnu : même réponse. Autre panne (Admin SDK, Resend) : 502 pour que le front se replie sur Firebase.
        if (e.code !== 'auth/user-not-found') { log('error', 'reset échoué', { to: maskEmail(email), err: e.message }); throw e; }
    }
    json(res, 200, { ok: true });
}

function handlePreview(req, res, name) {
    if (!cfg.previewEnabled || !templates[name]) return json(res, 404, { error: 'introuvable' });
    const m = templates[name]({ ...templateCtx, pseudo: 'Lee', link: `${actionUrl}?mode=${name === 'verification' ? 'verifyEmail' : 'resetPassword'}&oobCode=EXEMPLE` });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(m.html);
}

const server = http.createServer(async (req, res) => {
    const allowed = cors(req, res);
    if (req.method === 'OPTIONS') { res.writeHead(allowed ? 204 : 403); return res.end(); }
    if (!allowed) return json(res, 403, { error: 'origine non autorisée' });
    const url = new URL(req.url, 'http://localhost');
    try {
        if (req.method === 'GET' && url.pathname === '/healthz') return json(res, 200, { ok: true, service: 'loveink-mailer' });
        if (req.method === 'GET' && url.pathname.startsWith('/preview/')) return handlePreview(req, res, url.pathname.slice(9));
        if (req.method === 'POST' && url.pathname === '/v1/auth/verification') return await handleVerification(req, res);
        if (req.method === 'POST' && url.pathname === '/v1/auth/password-reset') return await handlePasswordReset(req, res);
        json(res, 404, { error: 'introuvable' });
    } catch (e) {
        log('error', 'erreur serveur', { path: url.pathname, err: e.message });
        json(res, e.status === 429 ? 429 : 502, { error: "l'envoi a échoué" });
    }
});

server.listen(cfg.port, () => log('info', 'mailer démarré', { port: cfg.port, actionUrl, origins: cfg.allowedOrigins }));
