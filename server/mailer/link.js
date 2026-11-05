'use strict';
// Réécrit un lien d'action Firebase (Admin SDK) vers la page thématisée de l'application.
// Le code `oobCode` reste valable quelle que soit la page qui l'applique ; seuls l'origine
// et le chemin changent, la query (mode, oobCode, apiKey, continueUrl, lang) est conservée.
// Utile quand la console refuse une URL d'action personnalisée (EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED).
function rewriteActionLink(rawLink, actionUrl) {
    const src = new URL(rawLink);
    const dst = new URL(actionUrl);
    for (const [k, v] of src.searchParams) dst.searchParams.set(k, v);
    return dst.toString();
}
module.exports = { rewriteActionLink };
