
## 2026-11-05 15:33 — Durcissement sécurité + lancement loveink.site
- Audit sécurité fait. Corrigé dans `firestore.rules` : messagerie (ID de conversation dérivé des deux UIDs, 2 participants), contournement de ban, contournement de modération, compteurs, auteurId des commentaires, suppression des commentaires par les modos.
- Côté client (`js/core/firebase-data.js`) : likes et commentaires en `writeBatch` avec leur compteur, requêtes de messages filtrées par participant ; 2 index ajoutés (`firestore.indexes.json`).
- `firebase.json` : tests, logs et `js/pages/script.js` exclus du déploiement.
- Tests : `tests/rules/firestore.rules.test.mjs` + `npm run test:rules`. **JAMAIS LANCÉS** : Java absent.
- Décision : rester sur Firebase Hosting (pas le VPS OVH). Domaine `loveink.site` acheté chez Spaceship (expire le 2027-11-02, renouvellement auto).
- Reste à faire : installer Java → `npm run test:rules` → `npm run deploy` (login Firebase de l'utilisateur) → domaine personnalisé dans la console Firebase + DNS chez Spaceship → vérification d'email et mot de passe oublié → plan de com.
- Sauvegarde des anciennes règles : uniquement dans le scratchpad de la session (temporaire), pas de git dans ce dossier.

## 2026-11-05 15:40 — Tests des règles verts
- Java Temurin 21 JRE installé via winget.
- `npm run test:rules` : 13/13 OK (émulateur). Correction du script : chemin du fichier explicite (Node 24 n'accepte pas un dossier pour --test).
- Reste à faire : `npm run deploy` (login Firebase de l'utilisateur), domaine personnalisé loveink.site, vérification d'email et mot de passe oublié, com.

## 2026-11-05 15:53 — Dépôt Git + automatisation Project

- Dépôt privé créé : https://github.com/Trigenys/loveink (branche `main`, identité locale EagleFox31 noreply). `.gitignore` ajouté (node_modules, test-results, playwright-report, .firebase, logs, .env, .claude/settings.local.json). Scan de secrets : seule la config web Firebase publique.
- AppFactory non utilisable (preset webapp = react-vite uniquement, pas de brownfield) → exception reuse-first documentée dans https://github.com/Trigenys/appfactory/issues/187.
- Adopté : Project automation (`.github/project-config.json` + `project-automation.yml`, auth broker-user, même pin que trigenys-studio). Bootstrap OK → board https://github.com/orgs/Trigenys/projects/29.
- Reste : `.github/workflows/firebase-deploy.yml` utilise encore `FIREBASE_TOKEN` (déprécié) → passer à un compte de service ; mot de passe de test en dur dans `tests/e2e/helpers/app.js` (dépôt privé, à externaliser) ; gouvernance/impact CI non adoptées. Toujours à faire côté utilisateur : `npm run deploy`, domaine loveink.site dans la console Firebase + DNS Spaceship.

## 2026-11-05 15:59 — Déploiement production
- Gate : `npm run test:rules` 13/13, puis `npm run deploy` (règles, index, hosting) → https://love-ink.web.app en ligne, sans erreur console sur /feed.
- Near miss corrigé : PASSATION.md et .github/** étaient servis publiquement → exclus de `hosting.ignore`, redéployé, 404 vérifié (voir tasks/lessons.md L-HOST-2026-11-05).
- À noter : /feed affiche des auteurs fictifs codés en dur (« Claire B. », etc.) dans « Auteurs à découvrir » à remplacer avant la com. Domaine loveink.site toujours à connecter (console Firebase > Hosting > domaine personnalisé, puis DNS Spaceship).

## 2026-11-05 16:05 — Feed : fin des données fictives
- `feed.html` : « Auteurs à découvrir » est maintenant calculé à partir des histoires publiées chargées (top 4 par nombre d'histoires, sans l'utilisateur connecté, section masquée si vide). Le bouton Suivre utilise le vrai `suivreAuteur`/`estAbonne`, l'état est relu au chargement. Les compteurs inventés des catégories sont supprimés.
- Déployé (hosting). Vérifié : syntaxe du module, page servie à jour, aucune donnée fictive dans les pages. Non vérifié par moi : le rendu une fois connecté (les tests e2e créent des comptes sur la prod, donc pas lancés).
- Limite : pas de page profil publique (`profil.html` n'affiche que son propre profil), donc pas de lien vers l'auteur.

## 2026-11-05 16:11 — Modernisation immersive (couche partagee)
- Ajout `css/immersive.css` + `js/core/immersive.js`, inclus avant `</head>` sur les 12 pages (additif, palette rose/encre conservee).
- Contenu : View Transitions inter-pages, aurore rose + halo pointeur + grain (calques fixes, pointer-events none), nav en verre, apparition au defilement (hors `.animate`), retour tactile boutons, focus visible, barre de lecture sur histoire.html, squelettes de chargement du feed.
- Accessibilite : prefers-reduced-motion et prefers-reduced-transparency respectes ; impression sans calques.
- Verifie en local (index, login, clair/sombre, 0 erreur console). Pages connectees non verifiees (pas d'identifiants).
- A faire : deployer hosting (`npx firebase deploy --only hosting`), puis verifier que PASSATION.md et .claude/ restent en 404.
- Pre-existant note : login.html n'applique pas le theme sombre au fond de page (theme.js absent).

## 2026-11-05 16:27 — Deploiement de la couche immersive
- Hosting deploye (`npx -y firebase-tools deploy --only hosting`) ; commit 40f9ae6 en ligne sur https://love-ink.web.app.
- Verifie : immersive.css/js en 200, pages incluent la couche ; PASSATION.md, .claude/, .github/ en 404.
- Reste : verification visuelle des pages connectees par Lee ; domaine loveink.site (console Firebase + DNS Spaceship).

## 2026-11-05 16:34 — Mode lecture immersif (histoire.html)
- Benchmark concurrents : docs/benchmark-lecture-2026-11.md.
- Ajout css/reader.css + js/components/reader.js ; histoire.html emet `li:story-rendered` apres chaque rendu (seul changement de logique).
- Livre : reglages Aa (taille/interligne/police/ambiance, localStorage `loveInk_reader`), temps de lecture/restant, reprise (`loveInk_pos_<id>`), mode focus, lettrine, separateurs de scene, fin + suggestions.
- Verifie via tests/reader-harness.html (local, non deploye). Suggestions vides en prod tant qu'aucune histoire publiee.
- A faire : deployer hosting apres accord ; ensuite "Continuer a lire" + histoire a la une dans le feed.
