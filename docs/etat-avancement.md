# Etat d'avancement - Audit de l'existant (v2)

Date: 2026-03-31
Reference: `docs/pert.md` (T1 a T12 + T13 a T17), `docs/scope.md`

## 1. Synthese (re-analyse)

- Taches principales T1-T12:
  - `Fait`: 11 (T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11)
  - `Partiel`: 0
  - `Non fait`: 1 (T12)
- Extensions T13-T17:
  - `Fait`: 5 (T13, T14, T15, T16, T17)
  - `Partiel`: 0
  - `Non fait`: 0

Delta majeur vs audit precedent:
- `T10` passe de `Non fait` a `Fait` (page candidature + ecriture Firestore + regles dediees detectees).

## 2. Statut detaille T1-T12

| ID | Statut | Constat actuel | Preuves (fichiers) |
|---|---|---|---|
| T1 | Fait | Infra Firestore en place: roles, statuts, regles, indexes, protections de base. | `firestore.rules`, `firestore.indexes.json`, `js/core/auth-session.js` |
| T2 | Fait | Backend messagerie fonctionnel (creation conversation, envoi, ecoute temps reel, lecture). | `js/core/firebase-data.js` |
| T3 | Fait | UI messagerie 2 colonnes operationnelle + ouverture via `?with=` cote page messagerie. | `messagerie.html` |
| T4 | Fait | Mode Spark couvert (agregation notifications cote app) + base Cloud Functions preparee mais desactivee en Spark. | `js/core/firebase-data.js`, `functions/index.js`, `package.json` |
| T5 | Fait | Page notifications + marquage lu + badge OK + cloche visible en permanence dans les deux variants navbar (classic + feed) avec dot rouge temps réel. | `notifications.html`, `js/components/nav-component.js` |
| T6 | Fait | Profil en onglets avec URL query params (`tab`, `status`) et rendu par role. | `profil.html` |
| T7 | Fait | Workflow moderation backend conforme (en_attente/publie/rejete + metadata de moderation). | `js/core/firebase-data.js`, `firestore.rules` |
| T8 | Fait | UI moderation complete (approuver/rejeter/sanction + lien d'edition pre-approbation fonctionnel via `publier.html?edit=...`). | `profil.html`, `publier.html`, `js/core/firebase-data.js` |
| T9 | Fait | Sanctions censeur complètes + `desactiverSanction` restaure `statut: actif` si plus aucune sanction bloquante active. | `profil.html`, `js/core/firebase-data.js` |
| T10 | Fait | Option "Devenir moderateur" implantee (page + formulaire + ecriture `candidatures_moderateur`). | `candidature-modo.html`, `firestore.rules`, `feed.html`, `profil.html` |
| T11 | Fait | Integration statuts feed/lecture/publication effective (feed filtre `publie`, publication `en_attente`, controle acces lecture). | `js/core/firebase-data.js`, `feed.html`, `histoire.html`, `publier.html` |
| T12 | Non fait | Pas de campagne de tests integration complete ni checklist QA fermee. | `docs/qa-checklist.md`, `tasks/todo.md` |

## 3. Statut detaille T13-T17 (extensions)

| ID | Statut | Constat actuel |
|---|---|---|
| T13 | Fait | Parametres avances implantes (mot de passe, suppression compte, preferences email, mode nuit) + avatar par initiales (compatible Spark, sans Storage). |
| T14 | Fait | Presence en ligne implementee: heartbeat Firestore (`enLigne`, `lastHeartbeat`, `lastSeen`, `presenceSessionId`) + cleanup session au logout/pagehide + affichage statut en messagerie. |
| T15 | Fait | Workflow editorial moderation implemente: edition pre-approbation dans `publier.html?edit=...` + conservation de la version originale (`versionOriginale`) + option "enregistrer et approuver". |
| T16 | Fait | Espace ops censeur implante: promotion role (`user->moderateur`, `moderateur->censeur`), traitement des candidatures, historique global sanctions et journal ops. |
| T17 | Fait | Documentation complète et synchronisée: schéma Firestore (10 collections), QA checklist 60+ items, runbook admin. |

## 4. Verification technique executee pendant cette re-analyse

1. Syntaxe JS:
- `node --check` sur tous les fichiers `js/**/*.js` et `functions/index.js` -> `OK`.

2. Scripts de deploiement:
- `npm run deploy:functions` -> `OK` (message explicite Spark: functions desactivees).
- `npm run deploy:firestore` -> echec dans cet environnement agent: `Failed to authenticate` (pas de session `firebase login` cote agent).

3. Constats de coherence:
- `.firebaserc` pointe bien vers `love-ink`.
- `firebase.json` ignore `functions/**` en hosting (coherent Spark), headers de securite presents.

## 5. Ecarts techniques notables (priorises)

1. P1 - T12 non ferme:
- Pas de validation E2E documentee (parcours complet + checklist QA a executer manuellement).

## 6. Conclusion courte

T1–T17 terminés. Seul T12 (QA E2E manuelle) reste ouvert — il nécessite une session de test sur le projet Firebase réel avec la `docs/qa-checklist.md` comme guide.
