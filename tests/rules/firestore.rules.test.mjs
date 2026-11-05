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
