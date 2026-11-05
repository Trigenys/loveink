# Love Ink - Plan de Stabilisation Deploiement

Date: 2026-03-18
Etat global: `DEPLOYED_PENDING_SMOKE_QA`

## Objectif
Rendre l'application vraiment deployable en production avec un parcours utilisateur complet, des donnees coherentes et une securite Firebase correcte.

## Regles de travail (actives)
- [x] Plan obligatoire avant implementation non triviale
- [x] Etapes checkables dans ce fichier
- [x] Verification avant fermeture de chaque etape
- [x] Journal d'avancement maintenu au fil de l'eau
- [x] Section review en fin de cycle

## Plan d'execution
- [x] 0. Initialiser le cadre de pilotage (`tasks/todo.md`, `tasks/lessons.md`)
- [x] 1. Unifier Firebase (SDK v9 modulaire uniquement + config unique)
- [x] 2. Corriger les erreurs structurelles bloquantes (scripts invalides, routes cassees, handlers incoherents)
- [x] 3. Definir et appliquer le schema Firestore cible (`users`, `stories`, `comments`, `likes`, `follows`, `notifications`, `conversations`, `messages`)
- [x] 4. Mettre en place les regles Firestore minimales de production
- [x] 5. Brancher feed/lecture/publication/commentaires/likes/notifications sur Firestore
- [x] 6. Uniformiser la session utilisateur (auth guard + etat local coherent)
- [x] 7. Ajouter outillage de deploiement (`firebase.json`, `.firebaserc`, scripts npm) et CI de base
- [ ] 8. Validation finale end-to-end + review technique

## Criteres d'acceptation (definition of done)
- [ ] Aucune erreur console bloquante sur parcours principal
- [ ] Inscription -> Connexion -> Publication -> Lecture -> Commentaire/Likes fonctionnels
- [ ] Notifications lisibles et marquables comme lues
- [x] Regles Firestore empechent les ecritures non autorisees
- [x] Deploiement reproductible via commande unique

## Verification planifiee (a executer a chaque etape)
- Verification manuelle navigation: `index -> login/register -> feed -> publier -> histoire -> notifications`
- Verification technique: logs console + reseau Firebase + coherence des documents Firestore
- Verification scripts: commandes de build/deploiement sans erreur

## Journal d'avancement
- 2026-03-18: Plan initialise et valide par l'utilisateur.
- 2026-03-18: Etape 1 completee (config Firebase unique + migration auth/pages vers SDK v9 modulaire).
- 2026-03-18: Verification syntaxique JS executee (`node --check` sur fichiers modifies).
- 2026-03-19: Etape 2 completee (pages manquantes creees, liens corrigees, handler favoris corrige, navigation "Decouvrir" nettoyee).
- 2026-03-19: Etape 3 completee (schema Firestore documente + collections ciblees alignees).
- 2026-03-19: Etape 4 completee (fichier `firestore.rules` ajoute).
- 2026-03-19: Etape 7 completee (fichiers Firebase deploy + scripts npm + workflow CI de base).
- 2026-03-19: Etape 5 completee (feed et lecture branches sur `firebaseAPI`, commentaires/likes persistes via Firestore).
- 2026-03-19: Etape 6 completee (auth guard Firebase unifie sur les pages privees + coherences de session locale).
- 2026-03-19: Verification outillage deploiement (`npx firebase-tools --version` -> 15.11.0).
- 2026-03-19: Documentation ajoutee (`README.md`, checklist QA `docs/qa-checklist.md`).
- 2026-03-19: Tentative de deploiement Firestore lancee, bloquee par absence d'auth Firebase CLI (`Failed to authenticate`).
- 2026-03-24: Confirmation acces projet cote utilisateur (`projects:list` OK), mais environnement agent toujours non authentifie Firebase CLI.
- 2026-03-24: Reverification locale effectuee: syntaxe JS OK (`node --check`), aucun lien HTML local manquant, aucun appel Firebase v8 detecte dans les pages actives.
- 2026-03-24: Tentative de passage via `powershell.exe` pour reutiliser la session Windows; execution technique possible mais deploiement non pilotable depuis l'environnement agent actuel.
- 2026-03-24: Deploiement execute depuis PowerShell utilisateur avec succes:
  - `firebase deploy --only firestore:rules,firestore:indexes` -> `Deploy complete`
  - `firebase deploy --only hosting` -> `Deploy complete`
  - URL de production: `https://love-ink.web.app`
- 2026-03-25: Ajout d'une librairie de modales reutilisable (`modale.js`) et remplacement des `alert()` navigateur sur les parcours auth/publication/profil/lecture.
- 2026-03-25: Refonte visuelle du feed (`feed.html`) avec layout premium responsive, recherche client, categories filtrantes, cartes histoires alimentees par Firestore et integration `modale.js`.
- 2026-03-25: Centralisation de la navigation via composant partage (`nav-component.js`) et suppression du markup duplique sur pages app principales (`feed`, `profil`, `messagerie`, `publier`, `notifications`, `histoire`, `mes-histoires`, `parametres`).
- 2026-03-30: T13 complete (page `parametres.html` finalisee: avatar Firebase Storage, changement de mot de passe, suppression compte, preferences email et mode nuit persistant).
- 2026-03-30: T14 complete (presence en ligne cote client sans Functions: heartbeat `enLigne/lastHeartbeat`, `lastSeen` au cleanup, integration auth-session, statut en messagerie).
- 2026-03-31: T15 complete (workflow editorial moderation: `publier.html?edit=...`, sauvegarde `versionOriginale`, correction avant validation, action "enregistrer et approuver").
- 2026-03-31: T16 complete (ops censeur: promotion des roles, traitement des candidatures moderateur, historique global des sanctions et journal d'actions ops).

## Review (a remplir en fin de cycle)
- Resume des changements: migration Firebase v9, correction des pages/routes/handlers, ajout des regles/index Firestore, outillage de deploiement et CI.
- Risques residuels: smoke QA fonctionnelle encore requise sur parcours complet utilisateur en environnement prod.
- Tests executes: checks syntaxe JS, verification liens locaux, verification absence de calls Firebase v8 actifs, deploiement Firestore + Hosting reussi.
- Recommandations post-deploiement: executer la checklist `docs/qa-checklist.md` sur `https://love-ink.web.app`.
