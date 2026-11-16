// Histoires en plusieurs chapitres : logique pure partagée (js/core/series.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    chapterTitle, isChapter, sortChapters, chapterPosition, serieBadge, serieStatutLabel,
    collapseSeries, suiteChoices, planChapter
} from '../../js/core/series.js';

const ch = (id, chapitre, extra = {}) => ({ id, serieId: 's1', chapitre, ...extra });

test('titre par défaut et détection d’un chapitre', () => {
    assert.equal(chapterTitle(3), 'Chapitre 3');
    assert.equal(isChapter({ id: 'a' }), false);
    assert.equal(isChapter({ serieId: '', chapitre: 2 }), false);
    assert.equal(isChapter(ch('a', 1)), true);
});

test('position : rang visible, trous tolérés (chapitre rejeté)', () => {
    const list = [ch('c4', 4), ch('c1', 1), ch('c2', 2)];
    assert.deepEqual(sortChapters(list).map((c) => c.id), ['c1', 'c2', 'c4']);
    const pos = chapterPosition(list, 'c4');
    assert.equal(pos.position, 3);
    assert.equal(pos.total, 3);
    assert.equal(pos.prev.id, 'c2');
    assert.equal(pos.next, null);
    assert.equal(chapterPosition(list, 'zz'), null);
});

test('badge de série', () => {
    assert.equal(serieBadge(1, 'en_cours'), '1 chapitre · en cours');
    assert.equal(serieBadge(3, 'terminee'), '3 chapitres · terminée');
    assert.equal(serieStatutLabel(undefined), 'en cours');
});

test('fil : une carte par série, ordre conservé, histoires seules intactes', () => {
    const out = collapseSeries([ch('c3', 3), { id: 'solo' }, ch('c2', 2), { id: 'x', serieId: 's2', chapitre: 1 }]);
    assert.deepEqual(out.map((s) => s.id), ['c3', 'solo', 'x']);
});

test('choix « Un nouveau chapitre de… » : séries puis histoires publiées hors série', () => {
    const stories = [
        { id: 's1', titre: 'Déjà série', statut: 'publie', serieId: 's1', categorie: 'Romance' },
        { id: 'h2', titre: 'Seule', statut: 'publie', categorie: 'Drame' },
        { id: 'h3', titre: 'En attente', statut: 'en_attente', categorie: 'Drame' }
    ];
    const series = [{ id: 's1', titre: 'Déjà série', genre: 'Romance', dernierChapitre: 3, statut: 'en_cours' }];
    const choices = suiteChoices(stories, series);
    assert.deepEqual(choices.map((c) => [c.kind, c.id, c.prochain]), [['serie', 's1', 4], ['histoire', 'h2', 2]]);
    assert.equal(choices[1].genre, 'Drame');
});

test('plan d’un chapitre 2 : crée la série et rattache le chapitre 1', () => {
    const base = { id: 'h2', titre: 'Seule', categorie: 'Drame', images: ['u1', 'u2'], auteurId: 'alice' };
    const plan = planChapter({ base, titre: '' });
    assert.equal(plan.serieId, 'h2');
    assert.equal(plan.chapitre, 2);
    assert.equal(plan.titre, 'Chapitre 2');
    assert.deepEqual(plan.createSerie, { titre: 'Seule', auteurId: 'alice', genre: 'Drame', couverture: 'u1', statut: 'en_cours', dernierChapitre: 2 });
    assert.deepEqual(plan.attachFirst, { serieId: 'h2', chapitre: 1 });
    assert.equal(plan.updateSerie, null);
    assert.equal(planChapter({ base: { ...base, images: [] }, dernier: true }).createSerie.couverture, null);
    assert.equal(planChapter({ base: { ...base, images: [] }, dernier: true }).createSerie.statut, 'terminee');
});

test('plan d’un chapitre suivant : avance la série', () => {
    const plan = planChapter({ serie: { id: 's1', genre: 'Romance', dernierChapitre: 3 }, titre: ' Le retour ', dernier: true });
    assert.equal(plan.chapitre, 4);
    assert.equal(plan.titre, 'Le retour');
    assert.equal(plan.genre, 'Romance');
    assert.deepEqual(plan.updateSerie, { dernierChapitre: 4, statut: 'terminee' });
    assert.equal(plan.createSerie, null);
});

test('plan refusé sans rattachement ou si l’histoire est déjà en série', () => {
    assert.throws(() => planChapter({}));
    assert.throws(() => planChapter({ base: { id: 'h', serieId: 'h' } }));
});

test('readerNav : position visible, sommaire, suite ou fin', async () => {
    const { readerNav } = await import('../../js/core/series.js');
    const chapters = [
        { id: 'c3', chapitre: 3, titre: 'Retour' },
        { id: 'a', chapitre: 1, titre: 'Rencontre' },
        { id: 'c4', chapitre: 4, titre: '' }
    ];
    const mid = readerNav({ chapters, storyId: 'c3', serie: { statut: 'en_cours' } });
    assert.equal(mid.label, 'Chapitre 2 sur 3');
    assert.deepEqual(mid.sommaire.map((s) => [s.rang, s.titre, s.current]), [[1, 'Rencontre', false], [2, 'Retour', true], [3, 'Chapitre 3', false]]);
    assert.equal(mid.prev.id, 'a');
    assert.equal(mid.next.id, 'c4');
    assert.equal(mid.ending, null);
    assert.equal(readerNav({ chapters, storyId: 'c4', serie: { statut: 'en_cours' } }).ending, 'La suite arrive bientôt');
    assert.equal(readerNav({ chapters, storyId: 'c4', serie: { statut: 'terminee' } }).ending, 'Fin de la série');
    assert.deepEqual(readerNav({ chapters, storyId: 'zz', story: { serieId: 'a', chapitre: 5 } }), { label: 'Chapitre 5', sommaire: [], prev: null, next: null, ending: null });
    assert.equal(readerNav({ chapters, storyId: 'zz', story: {} }), null);
});

test('feedEntries : une carte par série, lien vers le premier chapitre publié', async () => {
    const { feedEntries } = await import('../../js/core/series.js');
    const cover = { id: '11111111-1111-1111-1111-111111111111', alt: 'x' };
    const stories = [
        { id: 'c3', serieId: 'a', chapitre: 3, titre: 'Chapitre 3', categorie: 'Romance', contenu: 'trois' },
        { id: 'solo', titre: 'Seule', categorie: 'Drame' },
        { id: 'a', serieId: 'a', chapitre: 1, titre: 'Rencontre', categorie: 'Romance', contenu: 'un' }
    ];
    const api = {
        getSerie: async () => ({ titre: 'Nos étés', genre: 'Romance', statut: 'en_cours', couverture: cover }),
        getChapitresSerie: async () => [stories[0], stories[2]]
    };
    const out = await feedEntries(stories, api);
    assert.equal(out.length, 2);
    assert.equal(out[0].id, 'a');
    assert.equal(out[0].titre, 'Nos étés');
    assert.equal(out[0].extrait, 'un');
    assert.deepEqual(out[0].images, [cover]);
    assert.equal(out[0].serie.badge, '2 chapitres · en cours');
    assert.equal(out[1].id, 'solo');
    assert.equal(out[1].serie, undefined);
    const failing = await feedEntries(stories, { getSerie: async () => { throw new Error('x'); }, getChapitresSerie: async () => [] });
    assert.equal(failing[0].id, 'c3');
    assert.equal((await feedEntries(stories, {})).length, 2);
});
