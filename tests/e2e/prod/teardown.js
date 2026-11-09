// Nettoyage de la recette e2e prod : supprime les données des comptes jetables puis les comptes eux-mêmes.
// Idempotent : relançable sans risque ; un document déjà supprimé est ignoré.
// Ne touche qu'aux documents appartenant aux comptes listés dans .env.e2e.json.
const { readAccounts, writeAccounts, removeAccountsFile, ROLES } = require('./accounts');
const { firebaseConfig } = loadPublicConfig();

const AUTH = 'https://identitytoolkit.googleapis.com/v1';
const DB = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

// Collections supprimables côté client, avec le champ propriétaire.
const OWNED = [
    { collection: 'likes', field: 'userId' },
    { collection: 'commentaires', field: 'auteurId' },
    { collection: 'abonnements', field: 'abonneId' },
    { collection: 'histoires', field: 'auteurId' }
];

function loadPublicConfig() {
    const src = require('fs').readFileSync(require('path').resolve(__dirname, '../../../js/core/firebase-public-config.js'), 'utf8');
    const pick = (key) => (src.match(new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`)) || [])[1];
    const config = { apiKey: pick('apiKey'), projectId: pick('projectId') };
    if (!config.apiKey || !config.projectId) throw new Error('Configuration Firebase publique introuvable.');
    return { firebaseConfig: config };
}

async function call(url, { method = 'GET', token, body } = {}) {
    const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) {
        const message = json?.error?.message || res.statusText;
        const err = new Error(`${method} ${url.split('?')[0]} -> ${res.status} ${message}`);
        err.status = res.status;
        err.code = message;
        throw err;
    }
    return json;
}

async function signIn(account) {
    try {
        const out = await call(`${AUTH}/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`, {
            method: 'POST',
            body: { email: account.email, password: account.password, returnSecureToken: true }
        });
        return out.idToken;
    } catch (error) {
        if (/EMAIL_NOT_FOUND|INVALID_LOGIN_CREDENTIALS|USER_NOT_FOUND/.test(error.code)) return null; // déjà supprimé
        throw error;
    }
}

async function ownedDocs(token, collection, field, uid) {
    const rows = await call(`${DB}:runQuery`, {
        method: 'POST',
        token,
        body: {
            structuredQuery: {
                from: [{ collectionId: collection }],
                where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: uid } } },
                limit: 500
            }
        }
    });
    return rows.filter((r) => r.document).map((r) => r.document.name);
}

async function deleteDoc(token, name) {
    try {
        await call(`https://firestore.googleapis.com/v1/${name}`, { method: 'DELETE', token });
        return true;
    } catch (error) {
        if (error.status === 404) return false;
        throw error;
    }
}

async function main() {
    const data = readAccounts();
    if (!data) {
        console.log('Aucun compte e2e à nettoyer (.env.e2e.json absent) : rien à faire.');
        return;
    }

    const failures = [];
    const report = [];

    for (const role of ROLES) {
        const account = data.accounts?.[role];
        if (!account?.email || account.deleted) continue;

        try {
            const token = await signIn(account);
            if (!token) {
                account.deleted = true;
                report.push(`${role}: compte déjà absent`);
                continue;
            }
            const uid = account.uid;
            let removed = 0;
            for (const { collection, field } of OWNED) {
                for (const name of await ownedDocs(token, collection, field, uid)) {
                    if (await deleteDoc(token, name)) removed += 1;
                }
            }
            if (uid) await deleteDoc(token, `projects/${firebaseConfig.projectId}/databases/(default)/documents/utilisateurs/${uid}`);
            await call(`${AUTH}/accounts:delete?key=${firebaseConfig.apiKey}`, { method: 'POST', body: { idToken: token } });
            account.deleted = true;
            report.push(`${role}: ${removed} document(s) + profil + compte supprimés`);
        } catch (error) {
            failures.push(`${role}: ${error.message}`);
        } finally {
            writeAccounts(data);
        }
    }

    console.log('\nNettoyage e2e :');
    for (const line of report) console.log(`  ok  ${line}`);
    for (const line of failures) console.log(`  KO  ${line}`);

    const uids = ROLES.map((r) => data.accounts?.[r]?.uid).filter(Boolean);
    console.log('\nRestes non supprimables côté client (notifications, conversations, messages, ops_logs, sanctions) liés à :');
    console.log(`  uids     ${uids.join(' ')}`);
    if (data.storyIds?.length) console.log(`  histoires ${data.storyIds.join(' ')}`);

    if (failures.length) {
        process.exitCode = 1;
        console.log('\nFichier .env.e2e.json conservé pour relancer : npm run e2e:prod:teardown');
    } else {
        removeAccountsFile();
        console.log('\nComptes e2e supprimés ; fichier .env.e2e.json effacé.');
    }
}

main().catch((error) => {
    console.error(`Nettoyage interrompu : ${error.message}`);
    process.exitCode = 1;
});
