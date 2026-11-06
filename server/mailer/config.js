'use strict';
// Toute la configuration vient de l'environnement : aucun nom de projet, domaine ou clé en dur.
const required = (name) => {
    const v = process.env[name];
    if (!v) throw new Error(`Variable d'environnement manquante : ${name}`);
    return v;
};
const list = (name, fallback = []) => (process.env[name] ? process.env[name].split(',').map((s) => s.trim()).filter(Boolean) : fallback);

module.exports = {
    port: Number(process.env.PORT || 8787),
    brandName: process.env.BRAND_NAME || 'Love Ink',
    appBaseUrl: required('APP_BASE_URL').replace(/\/$/, ''),           // ex. https://loveink.site
    actionPath: process.env.ACTION_PATH || '/auth-action.html',         // page de retour thématisée dans l'app
    mailFrom: required('MAIL_FROM'),                                     // ex. "Love Ink <no-reply@loveink.site>"
    replyTo: process.env.MAIL_REPLY_TO || '',
    resendApiKey: required('RESEND_API_KEY'),
    resendEndpoint: process.env.RESEND_ENDPOINT || 'https://api.resend.com/emails',
    allowedOrigins: list('ALLOWED_ORIGINS', ['http://127.0.0.1:5178', 'http://localhost:5178']),
    rateLimit: { windowMs: Number(process.env.RATE_WINDOW_MS || 15 * 60 * 1000), max: Number(process.env.RATE_MAX || 5) },
    previewEnabled: process.env.MAILER_PREVIEW === '1',
    logoUrl: process.env.MAIL_LOGO_URL || ''
};
