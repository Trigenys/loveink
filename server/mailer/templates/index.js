'use strict';
const { layout, esc } = require('./layout');

const em = (s) => `<em style="font-style:italic;color:#7a3e3e;">${s}</em>`;
const footerFor = (brandName, appBaseUrl) =>
    `${esc(brandName)} · L'encre des cœurs<br><a href="${esc(appBaseUrl)}" style="color:#b07070;">${esc(appBaseUrl.replace(/^https?:\/\//, ''))}</a>`;

const templates = {
    verification: ({ brandName, appBaseUrl, logoUrl, pseudo, link }) => ({
        subject: `Confirmez votre adresse${pseudo ? `, ${pseudo}` : ''} · ${brandName}`,
        html: layout({
            brandName, logoUrl,
            preheader: 'Un clic pour ouvrir votre carnet Love Ink.',
            eyebrow: 'Bienvenue',
            title: `Votre carnet vous attend${pseudo ? `, ${em(esc(pseudo))}` : ''}.`,
            intro: 'Merci de rejoindre Love Ink. Confirmez votre adresse e-mail pour que vos histoires, vos lectures et vos messages restent bien à vous.',
            ctaLabel: 'Confirmer mon adresse',
            ctaUrl: link,
            note: "Ce lien est valable quelques heures. Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement ce message.",
            footer: footerFor(brandName, appBaseUrl)
        }),
        text: `Bienvenue sur ${brandName}${pseudo ? `, ${pseudo}` : ''} !\n\nConfirmez votre adresse e-mail en ouvrant ce lien :\n${link}\n\nSi vous n'êtes pas à l'origine de cette inscription, ignorez ce message.`
    }),
    passwordReset: ({ brandName, appBaseUrl, logoUrl, link }) => ({
        subject: `Réinitialisation de votre mot de passe · ${brandName}`,
        html: layout({
            brandName, logoUrl,
            preheader: 'Choisissez un nouveau mot de passe pour votre compte.',
            eyebrow: 'Mot de passe oublié',
            title: `On tourne la page, ${em("sans perdre l'histoire")}.`,
            intro: 'Vous avez demandé à réinitialiser votre mot de passe. Cliquez ci-dessous pour en choisir un nouveau ; vos histoires et vos lectures restent intactes.',
            ctaLabel: 'Choisir un nouveau mot de passe',
            ctaUrl: link,
            note: "Ce lien expire dans une heure et ne peut servir qu'une fois. Si vous n'avez rien demandé, votre mot de passe actuel reste valable : ignorez ce message.",
            footer: footerFor(brandName, appBaseUrl)
        }),
        text: `Réinitialisation de votre mot de passe ${brandName}\n\nChoisissez un nouveau mot de passe en ouvrant ce lien (valable une heure) :\n${link}\n\nSi vous n'avez rien demandé, ignorez ce message.`
    })
};
module.exports = { templates };
