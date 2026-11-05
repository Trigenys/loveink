# Lessons Learned - Love Ink

Date de creation: 2026-03-18

## Format d'entree
- Date:
- Contexte:
- Erreur/Risque:
- Regle preventive:
- Action appliquee:

---

## Entrees

### L-001
- Date: 2026-03-18
- Contexte: L'utilisateur a impose un workflow d'orchestration strict avant execution.
- Erreur/Risque: Commencer l'implementation sans artefacts de pilotage cree une ambiguite de suivi.
- Regle preventive: Toujours initialiser `tasks/todo.md` et `tasks/lessons.md` avant un chantier non trivial.
- Action appliquee: Fichiers de pilotage crees et plan checkable etabli avant modification produit.

### L-002
- Date: 2026-03-18
- Contexte: Le projet melange plusieurs approches (donnees statiques, localStorage, Firebase v8/v9).
- Erreur/Risque: Corriger localement sans plan global provoque des regressions laterales.
- Regle preventive: Traiter d'abord l'unification technique (SDK/config/session), puis les features.
- Action appliquee: Le plan d'execution place l'unification Firebase et les corrections bloquantes en priorite.

### L-SEC-2026-11-05
- Date: 2026-11-05
- Contexte: Audit securite avant lancement public (domaine loveink.site).
- Erreur/Risque: Regles Firestore trop permissives : conversation pre-creable par un tiers (lecture des DM d'autrui), ban contournable en supprimant son profil, histoires creables directement en `publie`, compteurs likes/commentaires gonflables sans doc associe, auteurId de commentaire modifiable.
- Cause racine: Regles ecrites "par champ" (le demandeur est-il dans la liste ?) sans verifier l'invariant metier (ID deterministe, statut force, coherence compteur/doc via existsAfter). Aucun test de regles.
- Regle preventive: Toute regle Firestore qui touche a l'acces ou a un compteur a un test emulateur dans `tests/rules/` (cas autorise + cas d'attaque). Les ecritures liees (doc + compteur) passent par `writeBatch`. Les regles de lecture doivent etre prouvables par la requete (pas de `size()` sur une liste interrogee en array-contains).
- Action appliquee: `firestore.rules` durci, client passe en batch (likes/commentaires) et requetes messages filtrees par participant, `npm run test:rules` ajoute (Java requis pour l'emulateur).
