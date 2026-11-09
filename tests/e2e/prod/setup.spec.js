// Crée les 4 comptes jetables via le vrai parcours d'inscription. Idempotent : un compte déjà créé est conservé.
const { test, expect } = require('@playwright/test');
const { registerWithUi } = require('../helpers/app');
const { ROLES, REGISTER_TYPE, EXPECTED_ROLE, newAccount, readAccounts, writeAccounts } = require('./accounts');

test.skip(process.env.E2E_PROD !== '1', 'Recette prod : lancer via npm run e2e:prod:setup');

test('création des comptes e2e jetables', async ({ browser }) => {
    const data = readAccounts() || { runId: `${Date.now().toString(36)}`, createdAt: new Date().toISOString(), accounts: {} };

    for (const role of ROLES) {
        if (data.accounts[role]?.uid) continue;
        const account = data.accounts[role] || newAccount(role, data.runId);
        data.accounts[role] = account;
        writeAccounts(data); // mot de passe conservé même si l'inscription échoue en route

        const context = await browser.newContext();
        const page = await context.newPage();
        try {
            const created = await registerWithUi(page, account, { type: REGISTER_TYPE[role], bio: `Compte de recette e2e (${role})` });
            expect(created.uid, `uid du compte ${role}`).toBeTruthy();
            account.uid = created.uid;
            writeAccounts(data);
        } finally {
            await context.close();
        }
    }

    console.log('\nComptes prêts. Rôles à poser dans Firestore (utilisateurs/{uid}.role) :');
    for (const role of Object.keys(EXPECTED_ROLE)) {
        console.log(`  ${role.padEnd(8)} ${data.accounts[role].uid}  -> role: "${EXPECTED_ROLE[role]}"`);
    }
});
