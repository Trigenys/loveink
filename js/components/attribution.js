// Anti-plagiat (#20) : un passage copié depuis une histoire emporte sa source.
// Cible tout conteneur [data-li-attrib] (pages statiques /histoires/* et histoire.html) ; le texte reste
// en clair et indexable, rien n'est bloqué : on ajoute seulement « Extrait de … » au presse-papiers.
const MIN_CHARS = 80;

export function attributionFor({ titre, auteur, url }) {
    const t = titre || 'Sans titre';
    return `Extrait de « ${t} »${auteur ? `, par ${auteur}` : ''}, sur Love Ink : ${url}`;
}

export function withAttribution(text, source) {
    const clean = String(text || '');
    if (clean.trim().length < MIN_CHARS) return null;
    return `${clean}\n\n${attributionFor(source)}`;
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function onCopy(event) {
    const sel = document.getSelection();
    if (!sel || sel.isCollapsed || !event.clipboardData) return;
    const node = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
    const host = node && node.closest('[data-li-attrib]');
    if (!host) return;
    const source = { titre: host.dataset.titre, auteur: host.dataset.auteur, url: host.dataset.url || location.href };
    const text = withAttribution(sel.toString(), source);
    if (!text) return;
    event.preventDefault();
    event.clipboardData.setData('text/plain', text);
    const html = escapeHtml(sel.toString()).replace(/\n/g, '<br>');
    event.clipboardData.setData('text/html', `${html}<p>${escapeHtml(attributionFor(source)).replace(escapeHtml(source.url), `<a href="${escapeHtml(source.url)}">${escapeHtml(source.url)}</a>`)}</p>`);
}

if (typeof document !== 'undefined') document.addEventListener('copy', onCopy);
