#!/usr/bin/env node
// e2e-prod-cleanup-plan.mjs - PLAN uniquement : inventaire des comptes de test e2e (@loveink-e2e.test)
// créés en production avant l'isolation des e2e sur émulateurs, et des données qui leur sont rattachées.
//
// Ce script est en LECTURE SEULE : il ne contient aucun chemin d'écriture ni de suppression.
// Toute suppression en production est décidée et exécutée par l'utilisatrice, après revue de ce plan.
//
// Prérequis (poste de l'utilisatrice, compte propriétaire du projet) :
//   gcloud auth application-default login
//   npm install --no-save firebase-admin@12
// Usage :
//   node scripts/e2e-prod-cleanup-plan.mjs [--project love-ink] [--domain loveink-e2e.test] [--json plan.json]

import { writeFileSync } from 'node:fs';

// Collections rattachées à un compte : champ porteur de l'uid et mode de requête.
// `docId` : le document a pour identifiant l'uid ; `in` : égalité ; `array` : uid présent dans un tableau.
const LINKED_COLLECTIONS = Object.freeze([
    { collection: 'utilisateurs', mode: 'docId' },
    { collection: 'histoires', field: 'auteurId', mode: 'in', label: (d) => d.titre || '(sans titre)' },
    { collection: 'commentaires', field: 'auteurId', mode: 'in' },
    { collection: 'likes', field: 'userId', mode: 'in' },
    { collection: 'abonnements', field: 'abonneId', mode: 'in' },
    { collection: 'abonnements', field: 'auteurId', mode: 'in' },
    { collection: 'notifications', field: 'utilisateurId', mode: 'in' },
    { collection: 'conversations', field: 'participants', mode: 'array' },
    { collection: 'messages', field: 'expediteurId', mode: 'in' },
    { collection: 'candidatures_moderateur', field: 'userId', mode: 'in' }
]);
const QUERY_CHUNK = 30; // limite Firestore des opérateurs `in` / `array-contains-any`.

function parseArgs(argv) {
    const args = { project: process.env.FIREBASE_PROJECT || 'love-ink', domain: 'loveink-e2e.test', json: '' };
    for (let i = 0; i < argv.length; i += 1) {
        const key = argv[i].replace(/^--/, '');
        if (!(key in args)) throw new Error(`Option inconnue : ${argv[i]}`);
        args[key] = argv[i + 1] || '';
        i += 1;
    }
    if (!args.domain || args.domain.includes('@')) throw new Error('--domain attend un domaine sans @ (ex. loveink-e2e.test).');
    return args;
}

async function loadAdmin() {
    try {
        const [{ initializeApp, applicationDefault }, { getAuth }, { getFirestore }] = await Promise.all([
            import('firebase-admin/app'),
            import('firebase-admin/auth'),
            import('firebase-admin/firestore')
        ]);
        return { initializeApp, applicationDefault, getAuth, getFirestore };
    } catch {
        throw new Error('firebase-admin introuvable : `npm install --no-save firebase-admin@12`, puis relancer.');
    }
}

const chunks = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

async function listTestAuthUsers(auth, suffix) {
    const users = [];
    let pageToken;
    do {
        const page = await auth.listUsers(1000, pageToken);
        for (const user of page.users) {
            if (String(user.email || '').toLowerCase().endsWith(suffix)) {
                users.push({ uid: user.uid, email: user.email, creation: user.metadata.creationTime });
            }
        }
        pageToken = page.pageToken;
    } while (pageToken);
    return users;
}

async function listTestProfiles(db, domain) {
    // Firestore ne filtre pas par suffixe : on lit les seuls champs email/pseudo des profils et on filtre ici.
    // Couvre les profils dont le compte Auth aurait déjà disparu.
    const suffix = `@${domain}`;
    const snapshot = await db.collection('utilisateurs').select('email', 'pseudo').get();
    return snapshot.docs
        .filter((doc) => String(doc.get('email') || '').toLowerCase().endsWith(suffix))
        .map((doc) => ({ uid: doc.id, email: doc.get('email'), pseudo: doc.get('pseudo') || '' }));
}

async function collectLinked(db, uids) {
    const result = [];
    for (const spec of LINKED_COLLECTIONS) {
        const docs = new Map();
        if (spec.mode === 'docId') {
            for (const part of chunks(uids, 100)) {
                const refs = part.map((uid) => db.collection(spec.collection).doc(uid));
                for (const snap of await db.getAll(...refs)) if (snap.exists) docs.set(snap.id, snap);
            }
        } else {
            const operator = spec.mode === 'array' ? 'array-contains-any' : 'in';
            for (const part of chunks(uids, QUERY_CHUNK)) {
                const snapshot = await db.collection(spec.collection).where(spec.field, operator, part).get();
                for (const snap of snapshot.docs) docs.set(snap.id, snap);
            }
        }
        result.push({
            collection: spec.collection,
            field: spec.field || '(id)',
            count: docs.size,
            items: [...docs.values()].map((snap) => ({
                id: snap.id,
                ...(spec.label ? { label: spec.label(snap.data()) } : {}),
                ...(spec.field && spec.mode === 'in' ? { owner: snap.get(spec.field) } : {})
            }))
        });
    }
    return result;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const { initializeApp, applicationDefault, getAuth, getFirestore } = await loadAdmin();
    const app = initializeApp({ credential: applicationDefault(), projectId: args.project });
    const auth = getAuth(app);
    const db = getFirestore(app);
    const suffix = `@${args.domain}`.toLowerCase();

    const authUsers = await listTestAuthUsers(auth, suffix);
    const profiles = await listTestProfiles(db, args.domain);
    const uids = [...new Set([...authUsers.map((u) => u.uid), ...profiles.map((p) => p.uid)])].sort();
    const linked = uids.length ? await collectLinked(db, uids) : [];

    const plan = {
        mode: 'plan',
        project: args.project,
        domain: args.domain,
        generatedAt: new Date().toISOString(),
        accounts: uids.map((uid) => {
            const a = authUsers.find((u) => u.uid === uid);
            const p = profiles.find((u) => u.uid === uid);
            return { uid, email: a?.email || p?.email || '', pseudo: p?.pseudo || '', inAuth: Boolean(a), inFirestore: Boolean(p), creation: a?.creation || '' };
        }),
        linked
    };

    console.log(`PLAN (lecture seule) — projet ${plan.project}, domaine @${plan.domain}`);
    console.log(`Comptes de test : ${plan.accounts.length} (Auth : ${authUsers.length}, profils Firestore : ${profiles.length})`);
    for (const account of plan.accounts) {
        console.log(`  - ${account.uid}  ${account.email}  ${account.pseudo}  [auth:${account.inAuth ? 'oui' : 'non'} profil:${account.inFirestore ? 'oui' : 'non'}]`);
    }
    for (const entry of linked) {
        console.log(`${entry.collection} (${entry.field}) : ${entry.count}`);
        if (entry.collection === 'histoires') {
            for (const item of entry.items) console.log(`  - ${item.id}  « ${item.label} »  auteur ${item.owner}`);
        }
    }
    if (args.json) {
        writeFileSync(args.json, `${JSON.stringify(plan, null, 2)}\n`);
        console.log(`Plan écrit dans ${args.json}`);
    }
    console.log('Aucune donnée modifiée. La suppression éventuelle est une décision de l’utilisatrice.');
}

main().catch((error) => {
    console.error(`Échec du plan : ${error.message}`);
    process.exitCode = 1;
});
