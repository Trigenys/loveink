// Comptes jetables de la recette e2e en production.
// Stockés dans un fichier local ignoré par git (.env.e2e.json) : jamais commités ni affichés.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ACCOUNTS_FILE = process.env.E2E_ACCOUNTS_FILE || path.resolve(__dirname, '../../../.env.e2e.json');
const ROLES = ['auteur', 'lecteur', 'modo', 'censeur'];
const REGISTER_TYPE = { auteur: 'lesdeux', lecteur: 'lecteur', modo: 'lecteur', censeur: 'lecteur' };
const EXPECTED_ROLE = { modo: 'moderateur', censeur: 'censeur' };

function generatePassword() {
    // Majuscule, minuscule, chiffre et symbole garantis, 20+ caractères.
    return `Li!${crypto.randomBytes(12).toString('base64url')}7a`;
}

function newAccount(role, runId) {
    return {
        role,
        pseudo: `e2e-${role}-${runId}`.slice(0, 38),
        email: `e2e.${role}.${runId}@loveink-e2e.test`,
        password: generatePassword(),
        uid: ''
    };
}

function readAccounts() {
    if (!fs.existsSync(ACCOUNTS_FILE)) return null;
    return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
}

function writeAccounts(data) {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function removeAccountsFile() {
    if (fs.existsSync(ACCOUNTS_FILE)) fs.unlinkSync(ACCOUNTS_FILE);
}

function requireAccounts() {
    const data = readAccounts();
    const missing = ROLES.filter((r) => !data?.accounts?.[r]?.uid);
    if (missing.length) {
        throw new Error(`Comptes e2e absents (${missing.join(', ')}). Lancer d'abord : npm run e2e:prod:setup`);
    }
    return data;
}

module.exports = {
    ACCOUNTS_FILE,
    ROLES,
    REGISTER_TYPE,
    EXPECTED_ROLE,
    newAccount,
    readAccounts,
    writeAccounts,
    removeAccountsFile,
    requireAccounts
};
