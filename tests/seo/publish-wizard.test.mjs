// Parcours « Écrire une histoire » : fonctions pures du wizard et garde-fous du contrat de publier.html.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    STEPS, LIMITS, countWords, readingMinutes, textStats, storyParagraphs, validateStep, firstInvalidStep,
    draftKey, serializeDraft, parseDraft, loadDraft, saveDraft, clearDraft, keyIntent
} from '../../js/components/publish-wizard.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAGE = readFileSync(join(ROOT, 'publier.html'), 'utf8');
const NOW = Date.UTC(2026, 10, 16, 12);
const FULL = { categorie: 'Rencontres', titre: 'Un titre', contenu: 'Un texte.', imagesCount: 1 };

function memoryStorage() {
    const data = new Map();
    return {
        data,
        getItem: (k) => (data.has(k) ? data.get(k) : null),
        setItem: (k, v) => data.set(k, String(v)),
        removeItem: (k) => data.delete(k)
    };
}

test('étapes : ordre genre → titre → texte → images → aperçu, une section par étape dans publier.html', () => {
    assert.deepEqual(STEPS.map((s) => s.id), ['categorie', 'titre', 'texte', 'images', 'apercu']);
    const sections = [...PAGE.matchAll(/<section[^>]*data-step="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(sections, STEPS.map((s) => s.id));
    assert.equal([...PAGE.matchAll(/data-goto="\d"/g)].length, STEPS.length);
});

test('limites alignées sur firestore.rules et reprises par les champs', () => {
    assert.deepEqual({ ...LIMITS }, { titre: 140, categorie: 80, contenu: 200000 });
    assert.match(PAGE, /id="titre"[^>]*maxlength="140"/);
    assert.match(PAGE, /id="contenu"[^>]*maxlength="200000"/);
});

test('contrat de publication inchangé (publierHistoire, images, modération)', () => {
    assert.match(PAGE, /firebaseAPI\.publierHistoire\(titre, categorie, contenuTexte, auteur, currentUser\.uid, images\)/);
    assert.match(PAGE, /publishStoryImages\(/);
    assert.match(PAGE, /deleteStoryImages\(images\.map/);
    assert.match(PAGE, /firebaseAPI\.editerHistoireModeration\(/);
    assert.match(PAGE, /requireAuth\(\{[\s\S]*redirectTo: 'login\.html'/);
    assert.match(PAGE, /Elle sera visible apres validation par un moderateur/);
    for (const id of ['publishForm', 'imagesInput', 'imagePreviews', 'publishSubmitBtn', 'saveEditBtn', 'approveEditBtn']) {
        assert.ok(PAGE.includes(`id="${id}"`), `#${id} absent`);
    }
});

test('comptage de mots et temps de lecture', () => {
    assert.equal(countWords(''), 0);
    assert.equal(countWords("  L'été de mes seize ans, aujourd’hui  "), 6);
    assert.equal(countWords('peut-être 2026'), 2);
    assert.equal(readingMinutes(''), 0);
    assert.equal(readingMinutes('un mot'), 1);
    assert.equal(readingMinutes('mot '.repeat(690)), 3);
    assert.equal(textStats('').label, '0 mot · 0 caractère');
    assert.equal(textStats('deux mots').label, '2 mots · 9 caractères · ≈ 1 min de lecture');
});

test('aperçu : même découpage en paragraphes que la page de lecture', () => {
    assert.deepEqual(storyParagraphs('  \n '), []);
    assert.deepEqual(storyParagraphs('A\nB\n\n\nC\n'), [['A', 'B'], ['C']]);
});

test('validation par étape', () => {
    assert.equal(validateStep('categorie', {}).ok, false);
    assert.equal(validateStep('titre', { titre: '   ' }).ok, false);
    assert.equal(validateStep('titre', { titre: 'x'.repeat(141) }).ok, false);
    assert.equal(validateStep('texte', { contenu: '' }).ok, false);
    assert.equal(validateStep('texte', { contenu: 'x'.repeat(200001) }).ok, false);
    assert.equal(validateStep('images', { imagesCount: 0 }).ok, false);
    assert.equal(validateStep('images', { imagesCount: 0 }, { minImages: 0 }).ok, true, 'modération : images facultatives');
    assert.equal(validateStep('apercu', {}).ok, true);
    assert.match(validateStep('images', { imagesCount: 0 }).error, /au moins 1 image\./);
});

test('première étape invalide', () => {
    assert.equal(firstInvalidStep(FULL, {}), -1);
    assert.equal(firstInvalidStep({ ...FULL, titre: '' }, {}), 1);
    assert.equal(firstInvalidStep({ ...FULL, titre: '' }, {}, 1), -1, 'les étapes au-delà de la cible ne bloquent pas');
    assert.equal(firstInvalidStep({ ...FULL, imagesCount: 0 }, { minImages: 0 }), -1);
});

test('brouillon : sérialisation, version, expiration, vide', () => {
    assert.equal(draftKey(''), '');
    assert.equal(draftKey('u1'), 'loveInk_publishDraft:u1');
    const raw = serializeDraft({ ...FULL, titre: 't'.repeat(200) }, 9, NOW);
    const draft = parseDraft(raw, NOW);
    assert.equal(draft.titre.length, 140);
    assert.equal(draft.step, STEPS.length - 1);
    assert.equal(parseDraft('{oops', NOW), null);
    assert.equal(parseDraft(JSON.stringify({ ...JSON.parse(raw), v: 2 }), NOW), null);
    assert.equal(parseDraft(raw, NOW + 31 * 24 * 3600 * 1000), null);
    assert.equal(parseDraft(serializeDraft({ titre: '  ' }, 0, NOW), NOW), null);
});

test('brouillon : stockage idempotent, isolé par utilisateur, tolérant aux erreurs', () => {
    const storage = memoryStorage();
    assert.equal(saveDraft(storage, 'u1', FULL, 2, NOW), true);
    assert.equal(saveDraft(storage, 'u1', FULL, 2, NOW), true);
    assert.equal(storage.data.size, 1);
    assert.equal(loadDraft(storage, 'u2', NOW), null);
    assert.equal(loadDraft(storage, 'u1', NOW).contenu, 'Un texte.');
    saveDraft(storage, 'u1', { titre: ' ' }, 0, NOW);
    assert.equal(storage.data.size, 0, 'un état vide efface le brouillon');
    saveDraft(storage, 'u1', FULL, 1, NOW);
    clearDraft(storage, 'u1');
    assert.equal(storage.data.size, 0);
    const broken = { getItem() { throw new Error('bloqué'); }, setItem() { throw new Error('plein'); }, removeItem() { throw new Error('bloqué'); } };
    assert.equal(saveDraft(broken, 'u1', FULL, 0, NOW), false);
    assert.equal(loadDraft(broken, 'u1', NOW), null);
    assert.doesNotThrow(() => clearDraft(broken, 'u1'));
    assert.equal(saveDraft(null, 'u1', FULL, 0, NOW), false);
});

test('raccourcis clavier', () => {
    assert.equal(keyIntent({ key: 'Enter' }, 'field'), 'next');
    assert.equal(keyIntent({ key: 'Enter' }, 'choice'), 'next');
    assert.equal(keyIntent({ key: 'Enter' }, 'other'), null, 'Entrée seule garde son rôle dans le texte');
    assert.equal(keyIntent({ key: 'Enter', ctrlKey: true }, 'other'), 'next');
    assert.equal(keyIntent({ key: 'Enter', metaKey: true, shiftKey: true }, 'other'), 'prev');
    assert.equal(keyIntent({ key: 'Enter', shiftKey: true }, 'field'), null);
    assert.equal(keyIntent({ key: 'Enter', isComposing: true }, 'field'), null, 'saisie IME en cours');
    assert.equal(keyIntent({ key: 'Enter', altKey: true }, 'field'), null);
    assert.equal(keyIntent({ key: 'a', ctrlKey: true }, 'field'), null);
});

test('chapitre : titre facultatif, images facultatives, genre sauté', () => {
    assert.equal(validateStep('titre', { titre: '' }).ok, false);
    assert.equal(validateStep('titre', { titre: '  ' }, { titreOptional: true }).ok, true);
    assert.equal(validateStep('titre', { titre: 'x'.repeat(LIMITS.titre + 1) }, { titreOptional: true }).ok, false);
    assert.equal(validateStep('images', { imagesCount: 0 }, { minImages: 0 }).ok, true);
    const state = { categorie: '', titre: '', contenu: 'Texte', imagesCount: 0 };
    assert.equal(firstInvalidStep(state, { minImages: 0, titreOptional: true }), 0);
    assert.equal(firstInvalidStep(state, { minImages: 0, titreOptional: true, skip: ['categorie'] }), -1);
});

test('brouillon : champ suite facultatif, rétrocompatible v1', () => {
    const now = 1_700_000_000_000;
    const plain = JSON.parse(serializeDraft({ titre: 'T' }, 1, now));
    assert.equal('suite' in plain, false);
    const chap = parseDraft(serializeDraft({ titre: '', contenu: 'Suite', suite: 'serie1' }, 2, now), now);
    assert.equal(chap.suite, 'serie1');
    const old = parseDraft(JSON.stringify({ v: 1, categorie: 'Romance', titre: 'T', contenu: '', step: 1, savedAt: now }), now);
    assert.equal(old.suite, undefined);
});
