#!/usr/bin/env node
// admin-bootstrap.mjs - Amorçage idempotent d'un administrateur Love Ink (plan par défaut, --apply pour écrire).
//
// Ne crée AUCUN compte et ne manipule AUCUN mot de passe : le compte doit exister (inscription sur le site).
// Écrit seulement l'écart avec l'état désiré : rôle `admin` et pseudo dans `utilisateurs/{uid}`,
// displayName Auth, copie privée de l'e-mail dans `comptes_prives/{uid}`. Second passage = aucune écriture.
//
// Prérequis (poste de l'utilisatrice, compte propriétaire du projet) :
//   gcloud auth application-default login
//   npm install --no-save firebase-admin@12
// Usage :
//   node scripts/admin-bootstrap.mjs --email jennifer@trigenys.com --pseudo "Law Admin"            (plan)
//   node scripts/admin-bootstrap.mjs --email jennifer@trigenys.com --pseudo "Law Admin" --apply    (écriture)
// Options : --project <id> (défaut FIREBASE_PROJECT ou love-ink),
//           --backfill-emails (rattrape comptes_prives pour tous les comptes Auth existants).

import { planAdminBootstrap, planContactBackfill, validateInputs, normalizeEmail } from './lib/admin-bootstrap-plan.mjs';

const FLAGS = new Set(['apply', 'backfill-emails']);

export function parseArgs(argv, env = process.env) {
    const args = { email: '', pseudo: '', project: env.FIREBASE_PROJECT || 'love-ink', apply: false, 'backfill-emails': false };
    for (let i = 0; i < argv.length; i += 1) {
        const key = argv[i].replace(/^--/, '');
        if (!(key in args)) throw new Error(`Option inconnue : ${argv[i]}`);
        if (FLAGS.has(key)) { args[key] = true; continue; }
        args[key] = argv[i + 1] || '';
        i += 1;
    }
    const errors = validateInputs(args);
    if (!args.project) errors.push('--project est vide.');
    if (errors.length) throw new Error(errors.join('\n'));
    return { ...args, email: normalizeEmail(args.email), pseudo: args.pseudo.trim() };
}

async function loadAdmin() {
    try {
        const [app, auth, firestore] = await Promise.all([
            import('firebase-admin/app'), import('firebase-admin/auth'), import('firebase-admin/firestore')
        ]);
        return { ...app, ...auth, ...firestore };
    } catch {
        throw new Error('firebase-admin introuvable : `npm install --no-save firebase-admin@12`, puis relancer.');
    }
}

async function findAuthUser(auth, email) {
    try {
        return await auth.getUserByEmail(email);
    } catch (error) {
        if (error?.code === 'auth/user-not-found') return null;
        throw error;
    }
}

async function listAuthUsers(auth) {
    const users = [];
    let pageToken;
    do {
        const page = await auth.listUsers(1000, pageToken);
        users.push(...page.users.map((u) => ({ uid: u.uid, email: u.email || '' })));
        pageToken = page.pageToken;
    } while (pageToken);
    return users;
}

function printChanges(title, changes) {
    console.log(title);
    if (!changes.length) { console.log('  aucun changement (état déjà convergé)'); return; }
    for (const c of changes) console.log(`  ${c.target} · ${c.field} : ${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}`);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const mode = args.apply ? 'APPLY' : 'PLAN (lecture seule)';
    const sdk = await loadAdmin();
    sdk.initializeApp({ credential: sdk.applicationDefault(), projectId: args.project });
    const auth = sdk.getAuth();
    const db = sdk.getFirestore();
    console.log(`Projet ${args.project} — mode ${mode}`);

    const authUser = await findAuthUser(auth, args.email);
    if (!authUser) {
        console.error(`Aucun compte Love Ink pour ${args.email}. Inscris-toi d'abord sur le site avec cette adresse, puis relance ce script.`);
        console.error('Ce script ne crée jamais de compte et ne choisit aucun mot de passe.');
        process.exitCode = 1;
        return;
    }

    const profileRef = db.collection('utilisateurs').doc(authUser.uid);
    const contactRef = db.collection('comptes_prives').doc(authUser.uid);
    const [profileSnap, contactSnap] = await Promise.all([profileRef.get(), contactRef.get()]);
    const plan = planAdminBootstrap(
        { authUser, profile: profileSnap.exists ? profileSnap.data() : null, contact: contactSnap.exists ? contactSnap.data() : null },
        { pseudo: args.pseudo }
    );
    printChanges(`Administrateur ${args.email} (uid ${plan.uid}) :`, plan.changes);

    let backfill = [];
    if (args['backfill-emails']) {
        const [users, contacts] = await Promise.all([listAuthUsers(auth), db.collection('comptes_prives').get()]);
        const byUid = new Map(contacts.docs.map((d) => [d.id, d.data()]));
        backfill = planContactBackfill(users, byUid).filter((item) => item.uid !== plan.uid);
        printChanges(`Rattrapage comptes_prives (${users.length} comptes Auth) :`, backfill.map((b) => ({
            target: `comptes_prives/${b.uid}`, field: 'email', from: b.from, to: b.email
        })));
    }

    if (!args.apply) {
        if (plan.changes.length || backfill.length) console.log('\nPlan seulement. Relancer avec --apply pour écrire ces changements.');
        return;
    }

    const now = sdk.FieldValue.serverTimestamp();
    if (plan.profileCreate) {
        await profileRef.create({ ...plan.profileCreate, dateInscription: now, dateRoleUpdate: now });
    } else if (plan.profileUpdate) {
        const update = { ...plan.profileUpdate };
        if ('role' in update) update.dateRoleUpdate = now;
        await profileRef.update(update);
    }
    if (plan.authUpdate) await auth.updateUser(plan.uid, plan.authUpdate);
    if (plan.contactWrite) await contactRef.set({ ...plan.contactWrite, dateMaj: now });
    for (let i = 0; i < backfill.length; i += 400) {
        const batch = db.batch();
        for (const b of backfill.slice(i, i + 400)) {
            batch.set(db.collection('comptes_prives').doc(b.uid), { uid: b.uid, email: b.email, dateMaj: now });
        }
        await batch.commit();
    }
    if (plan.changes.some((c) => c.target.startsWith('utilisateurs/') || c.target.startsWith('comptes_prives/'))) {
        await db.collection('ops_logs').add({
            actorId: 'admin_bootstrap_script', action: 'admin_bootstrap', date: now, targetUserId: plan.uid,
            metadata: { changes: plan.changes.map(({ target, field }) => `${target}.${field}`), backfill: backfill.length }
        });
    }
    console.log(`\nAppliqué : ${plan.changes.length + backfill.length} changement(s). Relancer le plan doit maintenant afficher « aucun changement ».`);
    console.log("L'utilisatrice doit se déconnecter puis se reconnecter pour que son nouveau rôle soit pris en compte.");
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/admin-bootstrap.mjs')) {
    main().catch((error) => {
        console.error(`Échec : ${error.message}`);
        if (/default credentials|Could not load the default credentials/i.test(error.message)) {
            console.error('Authentifie-toi : gcloud auth application-default login');
        }
        process.exitCode = 1;
    });
}
