'use strict';
// Rend chaque gabarit en HTML dans ./preview/ pour contrôle visuel, sans envoi ni Firebase.
const fs = require('fs');
const path = require('path');
const { templates } = require('../templates');

const out = path.join(__dirname, '..', 'preview');
fs.mkdirSync(out, { recursive: true });
const ctx = {
    brandName: 'Love Ink',
    appBaseUrl: 'https://love-ink.web.app',
    logoUrl: '',
    pseudo: 'Lee',
    link: 'https://love-ink.web.app/auth-action.html?mode=verifyEmail&oobCode=EXEMPLE'
};
for (const [name, build] of Object.entries(templates)) {
    const m = build(ctx);
    fs.writeFileSync(path.join(out, `${name}.html`), m.html);
    fs.writeFileSync(path.join(out, `${name}.txt`), `${m.subject}\n\n${m.text}`);
    console.log(`${name}: ${m.subject}`);
}
