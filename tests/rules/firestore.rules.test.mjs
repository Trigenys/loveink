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

// --- Series : histoires en plusieurs chapitres ---
// h1 (publiee, auteur A) devient le chapitre 1 de la serie « h1 ».
const serie = (over = {}) => ({
  titre: 't', auteurId: A, genre: 'c', couverture: null, statut: 'en_cours', dernierChapitre: 2,
  dateCreation: serverTimestamp(), dateMaj: serverTimestamp(), ...over
});
const chapitre = (n, over = {}) => ({ ...story(A, 'en_attente'), serieId: 'h1', chapitre: n, ...over });
async function premierChapitre2(d, over = {}) {
  const b = writeBatch(d);
  b.set(doc(d, 'series', 'h1'), serie(over.serie));
  b.update(doc(d, 'histoires', 'h1'), { serieId: 'h1', chapitre: 1, ...(over.attach || {}) });
  b.set(doc(d, 'histoires', over.id || 'ch2'), chapitre(2, over.chapitre));
  return b.commit();
}

test('series : histoire sans serieId inchangee (contrat historique)', async () => {
  await assertSucceeds(setDoc(doc(db(B), 'histoires', 'solo'), story(B, 'en_attente')));
});

test('series : chapitre 2 d\'une histoire publiee en un seul batch', async () => {
  await assertSucceeds(premierChapitre2(db(A)));
  let s;
  await env.withSecurityRulesDisabled(async (c) => { s = (await getDoc(doc(c.firestore(), 'histoires', 'h1'))).data(); });
  if (s.serieId !== 'h1' || s.chapitre !== 1) throw new Error('chapitre 1 non rattache');
});

test('series : lecture publique, creation refusee a un tiers ou hors batch', async () => {
  const d = db(B);
  const b = writeBatch(d);
  b.set(doc(d, 'series', 'h1'), serie({ auteurId: B }));
  b.set(doc(d, 'histoires', 'x2'), { ...chapitre(2), auteurId: B });
  await assertFails(b.commit());
  // Serie seule, sans rattacher le chapitre 1 : refusee.
  await assertFails(setDoc(doc(db(A), 'series', 'h1'), serie()));
  await assertSucceeds(premierChapitre2(db(A)));
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'series', 'h1')));
});

test('series : titre, genre, couverture ou numero forges refuses', async () => {
  await assertFails(premierChapitre2(db(A), { serie: { titre: 'autre' } }));
  await assertFails(premierChapitre2(db(A), { serie: { genre: 'autre' } }));
  await assertFails(premierChapitre2(db(A), { serie: { couverture: img(1) } }));
  await assertFails(premierChapitre2(db(A), { serie: { dernierChapitre: 3 } }));
  await assertFails(premierChapitre2(db(A), { chapitre: { categorie: 'autre' } }));
  await assertFails(premierChapitre2(db(A), { attach: { chapitre: 2 } }));
  await assertFails(premierChapitre2(db(A), { serie: { statut: 'publie' } }));
});

test('series : histoire non publiee ne peut pas devenir une serie', async () => {
  await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'histoires', 'h1'), { statut: 'en_attente' }));
  await assertFails(premierChapitre2(db(A)));
});

test('series : couverture = premiere image du chapitre 1', async () => {
  await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'histoires', 'h1'), { images: [img(1), img(2)] }));
  await assertFails(premierChapitre2(db(A)));
  await assertSucceeds(premierChapitre2(db(A), { serie: { couverture: img(1) } }));
});

test('series : chapitre 3 avec avancement +1, doublon et saut refuses', async () => {
  await premierChapitre2(db(A));
  const d = db(A);
  const next = (n, id, statut = 'en_cours') => {
    const b = writeBatch(d);
    b.update(doc(d, 'series', 'h1'), { dernierChapitre: n, statut, dateMaj: serverTimestamp() });
    b.set(doc(d, 'histoires', id), chapitre(n));
    return b.commit();
  };
  await assertFails(next(4, 'c4'));
  await assertSucceeds(next(3, 'c3', 'terminee'));
  // Meme numero rejoue (deux onglets) : refuse.
  const b = writeBatch(d);
  b.update(doc(d, 'series', 'h1'), { statut: 'en_cours', dateMaj: serverTimestamp() });
  b.set(doc(d, 'histoires', 'c3bis'), chapitre(3));
  await assertFails(b.commit());
  // Chapitre sans avancer la serie : refuse.
  await assertFails(setDoc(doc(d, 'histoires', 'c5'), chapitre(4)));
});

test('series : un tiers ne peut ni ajouter de chapitre ni modifier la serie', async () => {
  await premierChapitre2(db(A));
  const d = db(B);
  const b = writeBatch(d);
  b.update(doc(d, 'series', 'h1'), { dernierChapitre: 3, dateMaj: serverTimestamp() });
  b.set(doc(d, 'histoires', 'pirate'), { ...chapitre(3), auteurId: B });
  await assertFails(b.commit());
  await assertFails(updateDoc(doc(d, 'series', 'h1'), { statut: 'terminee', dateMaj: serverTimestamp() }));
  await assertFails(deleteDoc(doc(db(A), 'series', 'h1')));
});

test('series : l\'auteur ne change que statut / avancement, et ne detache pas un chapitre', async () => {
  await premierChapitre2(db(A));
  await assertSucceeds(updateDoc(doc(db(A), 'series', 'h1'), { statut: 'terminee', dateMaj: serverTimestamp() }));
  await assertFails(updateDoc(doc(db(A), 'series', 'h1'), { titre: 'renomme', dateMaj: serverTimestamp() }));
  await assertFails(updateDoc(doc(db(A), 'series', 'h1'), { dernierChapitre: 1, dateMaj: serverTimestamp() }));
  await assertFails(updateDoc(doc(db(A), 'histoires', 'h1'), { serieId: 'autre', chapitre: 1 }));
  await assertFails(updateDoc(doc(db(A), 'histoires', 'ch2'), { chapitre: 7 }));
});
