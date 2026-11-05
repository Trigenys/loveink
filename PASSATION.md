
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

## 2026-11-05 16:36 — Deploiement du mode lecture
- Hosting deploye (commit 8a691d1) ; reader.css/js en 200 ; PASSATION, docs/, tests/, .claude/ en 404.
- Reste : verif visuelle connectee par Lee ; feed "Continuer a lire" + histoire a la une ; domaine loveink.site.

## 2026-11-05 16:41 — Feed : « A la une » et « Continuer a lire »
- `js/core/reading-history.js` (nouveau) : historique local. Contrat conserve `loveInk_pos_<id>` (ratio) ; ajout `loveInk_lus` (meta titre/categorie/accroche, 12 max, ecriture seulement si le % change). `reader.js` passe par `recordReading`.
- `js/components/feed-extras.js` + `css/feed-extras.css` (nouveaux) : ecoute `li:feed-loaded` (emis par `loadStories` de feed.html, succes et echec).
  - A la une : histoire publiee la plus aimee des 7 derniers jours (repli : toutes), accroche = premiere phrase.
  - Continuer a lire : positions entre 5 % et 97 %, plus recentes d'abord ; anciennes positions sans meta resolues via le feed puis `getHistoireById`.
  - Blocs masques si vides ; rendu idempotent.
- Verifie sur `tests/feed-harness.html` (local) : selection, exclusions (brouillon, ancienne, terminee), idempotence, etats vides, sombre, pas de debordement horizontal (correctif `min-width:0`). Mode lecture : ecriture/suppression des cles OK.
- Non verifie : feed reel derriere connexion (prod sans histoire publiee). Deploiement : en attente d'accord.

## 2026-11-05 16:48 — Deploiement feed (A la une / Continuer a lire)
- Deploye sur https://love-ink.web.app (accord explicite). Nouveaux fichiers en 200, feed.html et reader.js a jour ; tests/ et PASSATION.md en 404.
- A tester par Lee une fois connectee, avec au moins une histoire publiee : bloc a la une, puis lire une histoire a moitie et revenir au feed.
- Suites du benchmark : commentaires par paragraphe, son d'ambiance optionnel.

## 2026-11-05 17:05 — Durcissement inscription / connexion
- `js/components/auth-form.js` + `css/auth-form.css` (nouveaux, partages) : erreurs sous le champ (aria-invalid/aria-describedby/role=alert), bouton occupe (aria-busy, anti double-envoi), oeil afficher/masquer, jauge de force (longueur d'abord), messages Firebase generiques (pas d'enumeration d'adresses).
- `register.html` : novalidate + validation JS ; autocomplete username/email/new-password ; pseudo 2-40, bio ≤ 600 (= firestore.rules), mot de passe ≥ 8 ; case CGU/confidentialite obligatoire ; `sendEmailVerification` apres creation (non bloquant) ; plus de console.log ni `error.message` brut.
- `login.html` : « Mot de passe oublie ? » (bloc `#resetBox`, `sendPasswordResetEmail`, meme confirmation que le compte existe ou non) ; message unique « E-mail ou mot de passe incorrect ».
- `conditions.html` + `confidentialite.html` (nouvelles) : textes generiques a relire par Lee ; adresse de contact contact@loveink.site a confirmer (ou remplacer).
- Tests e2e : helper `registerWithUi` coche `#consent`.
- Choix : `requireAuth` n'exige PAS emailVerified (ne pas bloquer les comptes existants) ; a durcir plus tard pour la publication si souhaite.
- Verifie en local (127.0.0.1:5178, etat JS) : erreurs inline, focus premier champ invalide, jauge, oeil, bloc reset (prerempli, aria-expanded), aucune erreur console. Non verifie : envoi reel des e-mails Firebase (necessite un vrai compte) ; template d'e-mail Firebase en anglais par defaut (console Auth > Templates, a franciser par Lee).
- Deploiement : en attente d'accord.

## 2026-11-05 17:12 — Deploiement auth durcie
- Hosting deploye (commit dc95152) sur https://love-ink.web.app ; nouveaux fichiers en 200, register/login a jour ; tests/ et PASSATION.md en 404.
- A faire par Lee : tester une inscription reelle (e-mail de verification recu ?) et « Mot de passe oublie » ; franciser les templates e-mail (console Auth > Templates) ; relire conditions.html / confidentialite.html et confirmer contact@loveink.site.
- Suites : domaine loveink.site ; audit 8-13 restant (liste blanche cles users, hierarchie censeurs, validation liens notifications, CSP) ; firebase-deploy.yml avec FIREBASE_TOKEN deprecie.

## 2026-11-05 17:38 — Refonte landing (index.html)
- index.html reecrit (nav sticky glass + burger mobile, hero asymetrique avec page de lecture mock, bandeau categories, etapes editoriales, bento mode lecture, bloc auteurs, manifeste, CTA final, footer avec liens legaux) ; nouveau css/landing.css (tokens du feed, Cormorant Garamond + DM Sans, sombre via html[data-theme="dark"], reduced-motion). Redirection onAuthStateChanged -> feed.html conservee ; carrousel, faux chiffres et styles inline supprimes.
- Bannière `?compte=suspendu|banni` (renvoi de auth-session.js) desormais affichee ; smoke e2e vise `.lp-hero` au lieu de `.hero-slideshow`.
- Verifie en local par etat JS (795px et 375px, clair/sombre, menu burger, 0 erreur console, pas de scroll horizontal). Non verifie : rendu >960px (2 colonnes) faute de pane plus large ; e2e non relances.
- Deploiement : attend l'accord explicite.

## 2026-11-05 17:39 — Landing : fond plume + mots parallax
- index.html / css/landing.css : couche .lp-ink (z 0) avec 8 titres de genres en serif italique (parallax au scroll via --d, rotation -4deg, moitie masques en mobile) et une plume (fa-feather-pointed) fixe qui « ecrit » toutes les 11 s une phrase en SVG (stroke-dashoffset) a une position aleatoire. Desactive si prefers-reduced-motion ou onglet cache.
- Verifie en local par etat JS : plume active, parallax applique, nav sticky au-dessus du contenu, 0 erreur console, pas de scroll horizontal.
- Deploiement : attend l'accord explicite.

## 2026-11-05 17:42 — Deploiement landing
- Hosting deploye (commit e560b70) sur https://love-ink.web.app : / et css/landing.css en 200 avec la plume, tests/ en 404.
- A faire par Lee : juger le rendu reel du fond (opacite des mots, frequence de la plume 11 s) ; reglages dans css/landing.css bloc « Fond ».
- Suites inchangees : domaine loveink.site ; audit 8-13 ; firebase-deploy.yml ; templates e-mail a franciser.

## 2026-11-05 18:40 — Landing : images (hero, genres, auteurs, manifeste)
- images/landing/ (nouveau) : 9 WebP convertis depuis les generations ChatGPT (C:\Users\lawry\Downloads\images_loveink) : hero-lettre 868x1086 (21 Ko), auteur-ecriture 1200x900 (40 Ko), manifeste-lecture 1344x576 (32 Ko), 6 vignettes cat-*.webp 320x400 (2-7 Ko). Reconversion : PIL via `python` (pas `python -I`).
- index.html / css/landing.css : photo hero 4/5 avec la page mock en superposition (bas gauche), bandeau de genres = figures image + legende (defilement 60 s), bloc auteurs = photo 4/3 avec le flux de cartes en superposition, manifeste = photo 21/9 avec degrade creme et citation a droite (mobile : 4/5, degrade vertical, citation en bas). Hero en fetchpriority=high, le reste en lazy.
- Verifie en local par etat JS : 9 fichiers en 200, layout desktop (~795px) et mobile 375px sans scroll horizontal, citation dans le cadre, 0 erreur console. Non verifie : rendu visuel reel (pane masque), >960px, e2e non relances.
- Deploiement : attend l'accord explicite.
