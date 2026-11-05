'use strict';
// Gabarit e-mail Love Ink : tableaux + styles inline (compatibilité clients mail), palette de la landing.
const theme = {
    cream: '#fdf8f5', paper: '#ffffff', roseDeep: '#7a3e3e', roseMid: '#b07070', roseSoft: '#d4a0a0',
    rosePale: '#f5e6e6', ink: '#2a1a1a', inkMuted: '#7a5f5f', border: '#ecdcdc',
    serif: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
    sans: "'DM Sans', 'Helvetica Neue', Arial, sans-serif"
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function layout({ brandName, preheader, eyebrow, title, intro, ctaLabel, ctaUrl, note, footer, logoUrl }) {
    const t = theme;
    const logo = logoUrl
        ? `<img src="${esc(logoUrl)}" width="36" height="36" alt="" style="display:inline-block;vertical-align:middle;border-radius:50%;margin-right:10px;">`
        : `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${t.roseDeep};margin-right:10px;vertical-align:middle;"></span>`;
    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title.replace(/<[^>]+>/g, ''))}</title></head>
<body style="margin:0;padding:0;background:${t.cream};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${t.cream};padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
  <tr><td style="padding:0 8px 18px;font-family:${t.serif};font-size:24px;color:${t.roseDeep};">${logo}<span style="vertical-align:middle;">${esc(brandName)}</span></td></tr>
  <tr><td style="background:${t.paper};border:1px solid ${t.border};border-radius:22px;padding:40px 36px;">
    <p style="margin:0 0 14px;font-family:${t.sans};font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${t.roseMid};font-weight:600;">${esc(eyebrow)}</p>
    <h1 style="margin:0 0 18px;font-family:${t.serif};font-weight:500;font-size:32px;line-height:1.15;color:${t.ink};">${title}</h1>
    <p style="margin:0 0 26px;font-family:${t.sans};font-size:16px;line-height:1.65;color:${t.inkMuted};">${intro}</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:${t.roseDeep};">
      <a href="${esc(ctaUrl)}" style="display:inline-block;padding:14px 28px;font-family:${t.sans};font-size:15px;font-weight:600;color:${t.cream};text-decoration:none;border-radius:999px;">${esc(ctaLabel)}</a>
    </td></tr></table>
    <p style="margin:26px 0 0;font-family:${t.sans};font-size:13px;line-height:1.6;color:${t.inkMuted};">${note}</p>
    <p style="margin:18px 0 0;padding:14px 16px;background:${t.rosePale};border-left:3px solid ${t.roseDeep};border-radius:10px;font-family:${t.sans};font-size:12px;line-height:1.6;color:${t.roseDeep};word-break:break-all;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><a href="${esc(ctaUrl)}" style="color:${t.roseDeep};">${esc(ctaUrl)}</a></p>
  </td></tr>
  <tr><td style="padding:22px 8px 0;font-family:${t.sans};font-size:12px;line-height:1.6;color:${t.inkMuted};text-align:center;">${footer}</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
module.exports = { layout, theme, esc };
