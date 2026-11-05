'use strict';
// Adaptateur Resend (API HTTP, sans dépendance). Remplaçable par un autre fournisseur avec la même signature.
async function sendEmail({ apiKey, endpoint, from, replyTo, to, subject, html, text, tags }) {
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}), ...(tags ? { tags } : {}) })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(`Resend ${res.status}: ${body.message || body.name || 'erreur inconnue'}`);
        err.status = res.status;
        throw err;
    }
    return body; // { id }
}
module.exports = { sendEmail };
