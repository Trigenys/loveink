// Tests de non-regression des regles Firestore (emulateur requis).
// Lancer : npm run test:rules
import { readFileSync } from 'node:fs';
import { test, before, after, beforeEach } from 'node:test';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs,
  writeBatch, increment, serverTimestamp
} from 'firebase/firestore';

let env;
const A = 'alice', B = 'bob', M = 'mallory', MODO = 'modo';
const convAB = [A, B].sort().join('_');

const db = (uid) => env.authenticatedContext(uid).firestore();

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'love-ink-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });
});
after(async () => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    for (const uid of [A, B, M]) await setDoc(doc(d, 'utilisateurs', uid), { uid, pseudo: uid, role: 'user', statut: 'actif' });
    await setDoc(doc(d, 'utilisateurs', MODO), { uid: MODO, pseudo: 'modo', role: 'moderateur', statut: 'actif' });
    await setDoc(doc(d, 'histoires', 'h1'), {
      auteurId: A, titre: 't', categorie: 'c', contenu: 'x', likes: 0, commentaires: 0, statut: 'publie', date: new Date()
    });
    await setDoc(doc(d, 'commentaires', 'c1'), { histoireId: 'h1', auteurId: B, contenu: 'hello', date: new Date() });
  });
});

// --- #1 Messagerie : un tiers ne peut pas s'inviter dans une conversation ---
test('tiers ne peut pas pre-creer la conversation A_B avec lui dedans', async () => {
  await assertFails(setDoc(doc(db(M), 'conversations', convAB), { participants: [A, B, M], dernierMessage: '' }));
});
test('participant cree sa conversation 1-1 (ordre quelconque)', async () => {
  await assertSucceeds(setDoc(doc(db(A), 'conversations', convAB), { participants: [B, A], dernierMessage: '', derniereActivite: serverTimestamp() }));
});
test('participant ne peut pas ajouter un tiers via update', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'conversations', convAB), { participants: [A, B] }));
  await assertFails(updateDoc(doc(db(A), 'conversations', convAB), { participants: [A, B, M] }));
  await assertSucceeds(updateDoc(doc(db(A), 'conversations', convAB), { dernierMessage: 'hi', derniereActivite: serverTimestamp(), expediteurDernierMessage: A }));
});
test('message : participants forges ou conversation etrangere refuses', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'conversations', convAB), { participants: [A, B] }));
  const base = { conversationId: convAB, contenu: 'yo', lu: false, date: serverTimestamp() };
  await assertFails(setDoc(doc(db(M), 'messages', 'm1'), { ...base, expediteurId: M, participants: [M] }));
  await assertFails(setDoc(doc(db(A), 'messages', 'm2'), { ...base, expediteurId: A, participants: [A, B, M] }));
  await assertSucceeds(setDoc(doc(db(A), 'messages', 'm3'), { ...base, expediteurId: A, participants: [A, B] }));
});
test('lecture des messages filtree par participant', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'messages', 'm1'), { conversationId: convAB, expediteurId: A, participants: [A, B], contenu: 'x', lu: false, date: new Date() }));
  await assertSucceeds(getDocs(query(collection(db(B), 'messages'), where('conversationId', '==', convAB), where('participants', 'array-contains', B))));
  await assertFails(getDocs(query(collection(db(M), 'messages'), where('conversationId', '==', convAB))));
});

// --- #2 Bannissement ---
test('un banni ne peut pas supprimer son profil ; un actif peut', async () => {
  await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'utilisateurs', M), { statut: 'banni' }));
  await assertFails(deleteDoc(doc(db(M), 'utilisateurs', M)));
  await assertSucceeds(deleteDoc(doc(db(B), 'utilisateurs', B)));
});

// --- #3 Moderation ---
const story = (uid, statut) => ({ auteurId: uid, titre: 't', categorie: 'c', contenu: 'x', likes: 0, commentaires: 0, date: serverTimestamp(), ...(statut ? { statut } : {}) });
test('creation forcee en en_attente', async () => {
  await assertFails(setDoc(doc(db(B), 'histoires', 'h2'), story(B, 'publie')));
  await assertFails(setDoc(doc(db(B), 'histoires', 'h3'), story(B)));
  await assertSucceeds(setDoc(doc(db(B), 'histoires', 'h4'), story(B, 'en_attente')));
});
test("l'auteur ne peut pas reecrire une histoire publiee ni ses compteurs", async () => {
  await assertFails(updateDoc(doc(db(A), 'histoires', 'h1'), { contenu: 'spam' }));
  await assertFails(updateDoc(doc(db(A), 'histoires', 'h1'), { likes: 9999 }));
});

// --- #4 Compteurs ---
test('like : +1 seul refuse, +1 en batch avec le like accepte, double +1 refuse', async () => {
  await assertFails(updateDoc(doc(db(B), 'histoires', 'h1'), { likes: increment(1) }));
  const d = db(B);
  const b = writeBatch(d);
  b.set(doc(d, 'likes', `h1_${B}`), { histoireId: 'h1', userId: B });
  b.update(doc(d, 'histoires', 'h1'), { likes: increment(1) });
  await assertSucceeds(b.commit());
  await assertFails(updateDoc(doc(db(B), 'histoires', 'h1'), { likes: increment(1) }));
});
test('commentaire : +1 lie a un nouveau commentaire uniquement', async () => {
  await assertFails(updateDoc(doc(db(B), 'histoires', 'h1'), { commentaires: increment(1), dernierCommentaireId: 'c1' }));
  const d = db(B);
  const ref = doc(collection(d, 'commentaires'));
  const b = writeBatch(d);
  b.set(ref, { histoireId: 'h1', auteurId: B, contenu: 'ok', date: serverTimestamp() });
  b.update(doc(d, 'histoires', 'h1'), { commentaires: increment(1), dernierCommentaireId: ref.id });
  await assertSucceeds(b.commit());
});

// --- #5 / #6 Commentaires ---
test("l'auteur d'un commentaire ne peut pas changer auteurId", async () => {
  await assertFails(updateDoc(doc(db(B), 'commentaires', 'c1'), { auteurId: A }));
  await assertSucceeds(updateDoc(doc(db(B), 'commentaires', 'c1'), { contenu: 'edit' }));
});
test('un moderateur peut supprimer un commentaire, pas un tiers', async () => {
  await assertFails(deleteDoc(doc(db(M), 'commentaires', 'c1')));
  await assertSucceeds(deleteDoc(doc(db(MODO), 'commentaires', 'c1')));
});

// --- Non-regression : lecture publique d'une histoire publiee ---
test('histoire publiee lisible sans compte', async () => {
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'histoires', 'h1')));
});

test('histoires : sans connexion, lecture limitee aux histoires publiees', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'histoires', 'brouillon'), { ...story(A, 'en_attente'), auteurId: A });
  });
  const anon = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anon, 'histoires', 'brouillon')));
  await assertFails(getDocs(collection(anon, 'histoires')));
  await assertSucceeds(getDocs(query(collection(anon, 'histoires'), where('statut', '==', 'publie'))));
});

// --- #14 Coup de coeur : reserve aux modos, histoires publiees, deux champs seulement ---
test('coup de coeur : modo marque et retire une histoire publiee', async () => {
  await assertSucceeds(updateDoc(doc(db(MODO), 'histoires', 'h1'), { coupDeCoeur: serverTimestamp(), coupDeCoeurPar: MODO }));
  await assertSucceeds(updateDoc(doc(db(MODO), 'histoires', 'h1'), { coupDeCoeur: null, coupDeCoeurPar: MODO }));
});
test('coup de coeur : refuse aux non-modos, aux dates forgees, aux autres champs et hors publication', async () => {
  await assertFails(updateDoc(doc(db(A), 'histoires', 'h1'), { coupDeCoeur: serverTimestamp(), coupDeCoeurPar: A }));
  await assertFails(updateDoc(doc(db(MODO), 'histoires', 'h1'), { coupDeCoeur: new Date('2030-01-01'), coupDeCoeurPar: MODO }));
  await assertFails(updateDoc(doc(db(MODO), 'histoires', 'h1'), { coupDeCoeur: serverTimestamp(), coupDeCoeurPar: B }));
  await assertFails(updateDoc(doc(db(MODO), 'histoires', 'h1'), { coupDeCoeur: serverTimestamp(), coupDeCoeurPar: MODO, likes: 99 }));
  await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'histoires', 'h1'), { statut: 'en_attente' }));
  await assertFails(updateDoc(doc(db(MODO), 'histoires', 'h1'), { coupDeCoeur: serverTimestamp(), coupDeCoeurPar: MODO }));
});

// --- Images d'histoire : 0 a 4 references { id, w, h, alt } ---
const img = (n) => ({ id: `00000000-0000-4000-8000-00000000000${n}`, w: 1600, h: 1200, alt: `photo ${n}` });
test('images : creation avec 1 et 4 images acceptee, 5 refusee', async () => {
  await assertSucceeds(setDoc(doc(db(B), 'histoires', 'i1'), { ...story(B, 'en_attente'), images: [img(1)] }));
  await assertSucceeds(setDoc(doc(db(B), 'histoires', 'i4'), { ...story(B, 'en_attente'), images: [img(1), img(2), img(3), img(4)] }));
  await assertFails(setDoc(doc(db(B), 'histoires', 'i5'), { ...story(B, 'en_attente'), images: [img(1), img(2), img(3), img(4), img(5)] }));
});
test('images : forme d\'item invalide refusee', async () => {
  const create = (id, images) => setDoc(doc(db(B), 'histoires', id), { ...story(B, 'en_attente'), images });
  await assertFails(create('b1', [{ ...img(1), id: 'court' }]));
  await assertFails(create('b2', [{ ...img(1), w: 1.5 }]));
  await assertFails(create('b3', [{ ...img(1), alt: 'x'.repeat(201) }]));
  await assertFails(create('b4', [{ ...img(1), url: 'https://evil.example' }]));
  await assertFails(create('b5', [{ id: img(1).id, w: 1, h: 1 }]));
  await assertFails(create('b6', [img(1), 'pas-une-map']));
  await assertFails(create('b7', 'pas-une-liste'));
});
test('images : l\'auteur met a jour les images d\'une histoire en attente', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'histoires', 'p1'), { ...story(B, 'en_attente'), date: new Date(), images: [img(1)] }));
  await assertSucceeds(updateDoc(doc(db(B), 'histoires', 'p1'), { images: [img(1), img(2)] }));
  await assertFails(updateDoc(doc(db(B), 'histoires', 'p1'), { images: [img(1), { ...img(2), id: 'x' }] }));
});
test('images : un modo edite les images avant publication', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'histoires', 'p2'), { ...story(B, 'en_attente'), date: new Date(), images: [img(1), img(2)] }));
  const edit = (images) => updateDoc(doc(db(MODO), 'histoires', 'p2'), {
    titre: 't2', contenu: 'x2', extrait: 'x2', image: 'images/a.jpg', images,
    moderateurId: MODO, dateModeration: serverTimestamp(), dateEditionModeration: serverTimestamp()
  });
  await assertFails(edit([img(1), { ...img(2), alt: 3 }]));
  await assertSucceeds(edit([img(2)]));
});

// --- Role admin : au-dessus de censeur, seul a attribuer/retirer n'importe quel role ---
const ADMIN = 'admin1', ADMIN2 = 'admin2', CENS = 'cens1';
const seedRoles = () => env.withSecurityRulesDisabled(async (c) => {
  const d = c.firestore();
  await setDoc(doc(d, 'utilisateurs', ADMIN), { uid: ADMIN, pseudo: 'admin', role: 'admin', statut: 'actif' });
  await setDoc(doc(d, 'utilisateurs', ADMIN2), { uid: ADMIN2, pseudo: 'admin2', role: 'admin', statut: 'actif' });
  await setDoc(doc(d, 'utilisateurs', CENS), { uid: CENS, pseudo: 'cens', role: 'censeur', statut: 'actif' });
});
const roleChange = (actor, role, extra = {}) => ({ role, roleUpdatedBy: actor, dateRoleUpdate: serverTimestamp(), roleUpdateSource: 'test', ...extra });

test('admin : attribue tous les roles, dans les deux sens, y compris admin', async () => {
  await seedRoles();
  const u = doc(db(ADMIN), 'utilisateurs', B);
  await assertSucceeds(updateDoc(u, roleChange(ADMIN, 'censeur')));
  await assertSucceeds(updateDoc(u, roleChange(ADMIN, 'admin')));
  await assertSucceeds(updateDoc(u, roleChange(ADMIN, 'user')));
  await assertSucceeds(updateDoc(doc(db(ADMIN), 'utilisateurs', ADMIN2), roleChange(ADMIN, 'moderateur')));
});
// Non-regression : register.html cree le profil SANS champ role (role implicite 'user').
// Une cle ajoutee n'apparait pas dans changedKeys() : la regle doit quand meme accepter le changement.
test('profil sans champ role (cree par register.html) : admin et censeur peuvent le promouvoir', async () => {
  await seedRoles();
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'utilisateurs', 'sansrole'), { uid: 'sansrole', pseudo: 'sansrole' }));
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'utilisateurs', 'sansrole2'), { uid: 'sansrole2', pseudo: 'sansrole2' }));
  // Role implicite inchange : aucune ecriture utile, refusee.
  await assertFails(updateDoc(doc(db(ADMIN), 'utilisateurs', 'sansrole'), roleChange(ADMIN, 'user')));
  await assertSucceeds(updateDoc(doc(db(ADMIN), 'utilisateurs', 'sansrole'), roleChange(ADMIN, 'moderateur')));
  await assertSucceeds(updateDoc(doc(db(CENS), 'utilisateurs', 'sansrole2'), roleChange(CENS, 'moderateur')));
});
test('admin : role inconnu, champ etranger, tracabilite forgee refuses', async () => {
  await seedRoles();
  const u = doc(db(ADMIN), 'utilisateurs', B);
  await assertFails(updateDoc(u, roleChange(ADMIN, 'superadmin')));
  await assertFails(updateDoc(u, roleChange(ADMIN, 'censeur', { pseudo: 'pirate' })));
  await assertFails(updateDoc(u, roleChange(B, 'censeur')));
  await assertFails(updateDoc(u, { role: 'censeur' }));
});
test("admin : ne modifie jamais son propre role (ni promotion ni retrogradation)", async () => {
  await seedRoles();
  await assertFails(updateDoc(doc(db(ADMIN), 'utilisateurs', ADMIN), roleChange(ADMIN, 'user')));
});
test("personne ne s'auto-promeut : user, moderateur, censeur", async () => {
  await seedRoles();
  await assertFails(updateDoc(doc(db(B), 'utilisateurs', B), roleChange(B, 'admin')));
  await assertFails(updateDoc(doc(db(B), 'utilisateurs', B), { role: 'admin' }));
  await assertFails(updateDoc(doc(db(MODO), 'utilisateurs', MODO), roleChange(MODO, 'censeur')));
  await assertFails(updateDoc(doc(db(CENS), 'utilisateurs', CENS), roleChange(CENS, 'admin')));
  await env.withSecurityRulesDisabled((c) => deleteDoc(doc(c.firestore(), 'utilisateurs', 'neuf')));
  await assertFails(setDoc(doc(db('neuf'), 'utilisateurs', 'neuf'), { uid: 'neuf', pseudo: 'neuf', role: 'admin' }));
  await assertSucceeds(setDoc(doc(db('neuf'), 'utilisateurs', 'neuf'), { uid: 'neuf', pseudo: 'neuf', role: 'user' }));
});
test('censeur : promotions limitees, ne touche ni ne nomme un admin', async () => {
  await seedRoles();
  await assertSucceeds(updateDoc(doc(db(CENS), 'utilisateurs', B), roleChange(CENS, 'moderateur')));
  await assertFails(updateDoc(doc(db(CENS), 'utilisateurs', B), roleChange(CENS, 'user')));
  await assertFails(updateDoc(doc(db(CENS), 'utilisateurs', MODO), roleChange(CENS, 'admin')));
  await assertFails(updateDoc(doc(db(CENS), 'utilisateurs', ADMIN), roleChange(CENS, 'user')));
  await assertFails(updateDoc(doc(db(CENS), 'utilisateurs', ADMIN), { statut: 'banni', suspensionJusqua: null }));
  await assertSucceeds(updateDoc(doc(db(CENS), 'utilisateurs', B), { statut: 'suspendu', suspensionJusqua: null }));
});
test('admin : herite des droits censeur et moderateur', async () => {
  await seedRoles();
  await assertSucceeds(updateDoc(doc(db(ADMIN), 'utilisateurs', M), { statut: 'banni', suspensionJusqua: null }));
  await assertSucceeds(updateDoc(doc(db(ADMIN), 'utilisateurs', ADMIN2), { statut: 'suspendu', suspensionJusqua: null }));
  await assertSucceeds(setDoc(doc(db(ADMIN), 'sanctions', 's1'), {
    utilisateurId: M, type: 'avertissement', motif: 'test', dateDebut: serverTimestamp(), dateFin: null, censeurId: ADMIN, actif: true
  }));
  await assertSucceeds(getDocs(collection(db(ADMIN), 'ops_logs')));
  await assertSucceeds(getDocs(collection(db(ADMIN), 'candidatures_moderateur')));
  await assertSucceeds(deleteDoc(doc(db(ADMIN), 'commentaires', 'c1')));
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'histoires', 'att'), { ...story(B, 'en_attente'), date: new Date() }));
  await assertSucceeds(getDoc(doc(db(ADMIN), 'histoires', 'att')));
  await assertSucceeds(updateDoc(doc(db(ADMIN), 'histoires', 'att'), { statut: 'publie', moderateurId: ADMIN, dateModeration: serverTimestamp() }));
  await assertSucceeds(setDoc(doc(db(ADMIN), 'ops_logs', 'l1'), { actorId: ADMIN, action: 'role_change', date: serverTimestamp(), targetUserId: B }));
});
test('admin : voit la liste des comptes', async () => {
  await seedRoles();
  const snap = await assertSucceeds(getDocs(collection(db(ADMIN), 'utilisateurs')));
  if (snap.size < 7) throw new Error(`liste incomplete : ${snap.size}`);
});

// --- Contact privé (e-mail) : hors du profil public, lisible par le titulaire et les admins ---
const dbMail = (uid, email) => env.authenticatedContext(uid, { email }).firestore();

test('comptes_prives : le titulaire écrit son propre e-mail (celui du jeton), rien d autre', async () => {
  await seedRoles();
  const mine = doc(dbMail(A, 'alice@example.test'), 'comptes_prives', A);
  await assertSucceeds(setDoc(mine, { uid: A, email: 'alice@example.test', dateMaj: serverTimestamp() }));
  await assertSucceeds(getDoc(mine));
  // Adresse différente du jeton, champ étranger, date forgée, compte d'autrui : refusés.
  await assertFails(setDoc(mine, { uid: A, email: 'autre@example.test', dateMaj: serverTimestamp() }));
  await assertFails(setDoc(mine, { uid: A, email: 'alice@example.test', dateMaj: serverTimestamp(), role: 'admin' }));
  await assertFails(setDoc(mine, { uid: A, email: 'alice@example.test', dateMaj: new Date(0) }));
  await assertFails(setDoc(doc(dbMail(A, 'alice@example.test'), 'comptes_prives', B), { uid: B, email: 'alice@example.test', dateMaj: serverTimestamp() }));
  // Jeton sans e-mail : refusé.
  await assertFails(setDoc(doc(db(B), 'comptes_prives', B), { uid: B, email: '', dateMaj: serverTimestamp() }));
});

test('comptes_prives : lecture et liste réservées aux admins (ni membre, ni modérateur, ni censeur)', async () => {
  await seedRoles();
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'comptes_prives', A), { uid: A, email: 'alice@example.test', dateMaj: new Date() }));
  await assertSucceeds(getDoc(doc(db(ADMIN), 'comptes_prives', A)));
  await assertSucceeds(getDocs(collection(db(ADMIN), 'comptes_prives')));
  for (const uid of [B, MODO, CENS]) {
    await assertFails(getDoc(doc(db(uid), 'comptes_prives', A)));
    await assertFails(getDocs(collection(db(uid), 'comptes_prives')));
  }
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'comptes_prives', A)));
  // L'admin lit mais n'écrit pas l'e-mail d'un autre compte ; seul le titulaire supprime le sien.
  await assertFails(setDoc(doc(dbMail(ADMIN, 'admin@example.test'), 'comptes_prives', A), { uid: A, email: 'admin@example.test', dateMaj: serverTimestamp() }));
  await assertFails(deleteDoc(doc(db(ADMIN), 'comptes_prives', A)));
  await assertSucceeds(deleteDoc(doc(db(A), 'comptes_prives', A)));
});
