#!/usr/bin/env node
// e2e-prod-cleanup-apply.mjs - APPLY : supprime les comptes de test e2e (@loveink-e2e.test) et leurs données,
// à partir d'un plan produit puis relu (`e2e-prod-cleanup-plan.mjs --json plan.json`).
//
// Sûreté :
//   - simulation par défaut ; rien n'est supprimé sans `--apply --confirm <projet>` ;
//   - domaine obligatoirement sous le TLD réservé `.test` ;
//   - chaque compte est revérifié en direct (Auth, profil, contact privé) : tout e-mail hors domaine de test
//     écarte le compte, même s'il figure dans le plan ;
//   - chaque document du plan est relu et supprimé seulement s'il appartient encore exclusivement à des
//     comptes de test (une conversation avec un participant réel est conservée) ;
//   - idempotent : un document déjà absent est ignoré ; relancer après succès ne supprime plus rien.
// Non couverts : fichiers Storage, compteurs (likes, commentaires) des histoires réelles touchées par un
// compte de test, `sanctions` et `ops_logs` (traces conservées).
//
// Prérequis : identiques au plan (gcloud auth application-default login ; npm install --no-save firebase-admin@12).
// Usage :
//   node scripts/e2e-prod-cleanup-plan.mjs --json plan.json                     # 1. inventaire, à relire
//   node scripts/e2e-prod-cleanup-apply.mjs --plan plan.json                     # 2. simulation
//   node scripts/e2e-prod-cleanup-apply.mjs --plan plan.json --apply --confirm love-ink   # 3. suppression
//   node scripts/e2e-prod-cleanup-plan.mjs                                       # 4. contrôle : 0 compte

import { readFileSync } from 'node:fs';
import {
    DEFAULT_TEST_DOMAIN, canDelete, specFor, validatePlan, validateTestDomain, verifyAccounts
} from './lib/e2e-test-accounts.mjs';

const BATCH_MAX = 400; // sous la limite Firestore de 500 écritures par lot.

function parseArgs(argv) {
    const args = { plan: '', project: '', domain: DEFAULT_TEST_DOMAIN, confirm: '', apply: false };
    for (let i = 0; i < argv.length; i += 1) {
        const key = argv[i].replace(/^--/, '');
        if (key === 'apply') { args.apply = true; continue; }
        if (!(key in args) || typeof args[key] !== 'string') throw new Error(`Option inconnue : ${argv[i]}`);
        args[key] = argv[i + 1] || '';
        i += 1;
    }
    if (!args.plan) throw new Error('--plan <fichier.json> est obligatoire (sortie --json de e2e-prod-cleanup-plan.mjs).');
    const domainError = validateTestDomain(args.domain);
    if (domainError) throw new Error(domainError);
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

async function readLiveAccounts(auth, db, uids) {
    const live = new Map(uids.map((uid) => [uid, { authEmail: null, profileEmail: null, privateEmail: null, inAuth: false }]));
    for (let i = 0; i < uids.length; i += 100) {
        const part = uids.slice(i, i + 100);
        const { users } = await auth.getUsers(part.map((uid) => ({ uid })));
        for (const user of users) Object.assign(live.get(user.uid), { authEmail: user.email || '', inAuth: true });
        const profiles = await db.getAll(...part.map((uid) => db.collection('utilisateurs').doc(uid)));
        const privates = await db.getAll(...part.map((uid) => db.collection('comptes_prives').doc(uid)));
        for (const snap of profiles) if (snap.exists) live.get(snap.id).profileEmail = snap.get('email') ?? null;
        for (const snap of privates) if (snap.exists) live.get(snap.id).privateEmail = snap.get('email') ?? null;
    }
    return live;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const plan = JSON.parse(readFileSync(args.plan, 'utf8'));
    const project = args.project || plan.project;
    const planErrors = validatePlan(plan, { project, domain: args.domain });
    if (planErrors.length) throw new Error(planErrors.join('\n'));
    if (args.apply && args.confirm !== project) {
        throw new Error(`--apply exige --confirm ${project} (nom exact du projet visé).`);
    }

    const { initializeApp, applicationDefault, getAuth, getFirestore } = await loadAdmin();
    const app = initializeApp({ credential: applicationDefault(), projectId: project });
    const auth = getAuth(app);
    const db = getFirestore(app);

    const mode = args.apply ? 'SUPPRESSION' : 'SIMULATION (rien n’est modifié ; ajouter --apply --confirm ' + project + ')';
    console.log(`${mode} — projet ${project}, domaine @${args.domain}, plan du ${plan.generatedAt}`);

    const planUids = (plan.accounts || []).map((a) => a.uid);
    const live = await readLiveAccounts(auth, db, planUids);
    const { uids, refused } = verifyAccounts(plan.accounts, live, args.domain);
    const testUids = new Set(uids);
    for (const r of refused) console.log(`  ! compte écarté ${r.uid} : ${r.reason}`);
    console.log(`Comptes de test vérifiés : ${uids.length} / ${planUids.length}`);

    const toDelete = [];
    const kept = [];
    for (const entry of plan.linked || []) {
        const spec = specFor(entry.collection, entry.field);
        for (const item of entry.items || []) {
            const ref = db.collection(entry.collection).doc(item.id);
            const snap = await ref.get();
            const verdict = canDelete(spec, item.id, snap.exists ? snap.data() : null, testUids);
            if (toDelete.some((d) => d.path === ref.path)) continue; // ex. abonnement entre deux comptes de test
            if (verdict.ok) toDelete.push({ ref, path: ref.path, label: item.label });
            else kept.push({ path: ref.path, reason: verdict.reason });
        }
    }
    // Comptes vérifiés sans entrée de profil dans le plan : leurs documents par identifiant restent couverts.
    for (const uid of uids) {
        for (const collection of ['comptes_prives', 'utilisateurs']) {
            const ref = db.collection(collection).doc(uid);
            if (toDelete.some((d) => d.path === ref.path) || kept.some((k) => k.path === ref.path)) continue;
            if ((await ref.get()).exists) toDelete.push({ ref, path: ref.path });
        }
    }

    const byCollection = toDelete.reduce((acc, d) => ({ ...acc, [d.path.split('/')[0]]: (acc[d.path.split('/')[0]] || 0) + 1 }), {});
    for (const [collection, count] of Object.entries(byCollection)) console.log(`  ${collection} : ${count}`);
    for (const d of toDelete.filter((x) => x.label)) console.log(`    - ${d.path}  « ${d.label} »`);
    for (const k of kept.filter((x) => x.reason !== 'déjà absent')) console.log(`  = conservé ${k.path} : ${k.reason}`);
    const absent = kept.filter((x) => x.reason === 'déjà absent').length;
    if (absent) console.log(`  (déjà absents : ${absent})`);
    const authUids = uids.filter((uid) => live.get(uid).inAuth);
    console.log(`Documents à supprimer : ${toDelete.length} ; comptes Auth à supprimer : ${authUids.length}`);

    if (!args.apply) return;
    if (toDelete.length === 0 && authUids.length === 0) {
        console.log('Rien à supprimer : état déjà convergé.');
        return;
    }
    for (let i = 0; i < toDelete.length; i += BATCH_MAX) {
        const batch = db.batch();
        for (const d of toDelete.slice(i, i + BATCH_MAX)) batch.delete(d.ref);
        await batch.commit();
    }
    let authFailures = 0;
    if (authUids.length) {
        const result = await auth.deleteUsers(authUids);
        for (const e of result.errors) console.error(`  ! échec suppression Auth ${authUids[e.index]} : ${e.error.message}`);
        authFailures = result.failureCount;
        if (authFailures) process.exitCode = 1;
    }
    console.log(`Supprimé : ${toDelete.length} document(s), ${authUids.length - authFailures} compte(s) Auth.`);
    console.log('Contrôle : relancer e2e-prod-cleanup-plan.mjs, qui doit annoncer 0 compte.');
}

main().catch((error) => {
    console.error(`Échec : ${error.message}`);
    process.exitCode = 1;
});
