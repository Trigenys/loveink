
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

## 2026-11-05 18:48 — Landing : carrousels « page tournée » (hero + manifeste)
- Composant commun `.lp-book` (css/landing.css bloc « Carrousel ») : feuilles `.lp-book__leaf` empilées, la page active pivote autour de la reliure gauche (rotateY -180°, backface-visibility) avec ombre `.lp-book__shade`, points `role=tablist` (clic, flèches clavier, balayage tactile), auto 6,5 s, pause survol/focus/onglet caché, bascule sans animation si prefers-reduced-motion. Script inline dans index.html (boucle sur `.lp-book`).
- Hero `#lpBook` : 4 photos 4/5 (hero-lettre, hero-carnet, hero-lecture, hero-plume). Manifeste `#lpManifeste` : 4 figures image 21/9 + citation (manifeste-lecture, manifeste-2/3/4), dégradé crème déplacé sur `.lp-book__leaf::after`.
- Responsive : `.lp-hero__visual` a besoin de `width:100%` (sinon largeur 0 dans la grille sans image en flux) ; ≤680 px la page mock passe sous la photo (relative, chevauchement -56 px) et les points du hero vont en haut à droite ; ≤960 px `.lp-flow` calé à right:0.
- Vérifié par état JS : 15 images en 200, page tournée effective, desktop ~1057 px / tablette 768 / mobile 375 sans chevauchement points-page-chips ni scroll horizontal, citation dans le cadre, 0 erreur console. Non vu visuellement (pane masqué).
- Déploiement : attend l'accord explicite.

## 2026-11-05 18:52 — Landing : bento « mode lecture » plus visuel
- index.html / css/landing.css : les 4 tuiles reçoivent une maquette (`.lp-tile__vis`, grille 1fr/auto, min-height 320) : extrait typographié + pilules de réglages (`.lp-reader`), photo manifeste-4 en fond sombre + 3 mini-pages clair/sépia/nuit (`.lp-moods`), carte « Continuer à lire » avec couvertures cat-*.webp et barre de progression (`.lp-resume`), lecteur en mode focus avec paragraphes voisins estompés (`.lp-focus`). Icônes supprimées au profit des maquettes.
- Vérifié par état JS : visuels contenus dans les tuiles en desktop (1057 px) et mobile (375 px), images chargées, pas de scroll horizontal, 0 erreur console. Non vu visuellement.
- Déploiement : attend l'accord explicite.

## 2026-11-05 18:56 — Landing : maquettes visuelles « Comment ça marche »
- `index.html` #comment : chaque `.lp-step` a un bloc `.lp-step__vis` (aria-hidden) : 01 `.lp-shelf` (3 couvertures cat-*.webp en éventail + chip « Premier amour · 6 min »), 02 `.lp-marker` (page avec « Reprendre ici · chapitre 3 »), 03 `.lp-react` (pilules cœur/commentaire/message + bouton « Écrire une histoire »).
- `css/landing.css` : `.lp-step` passe à 4 colonnes (90px / .9fr / 1.1fr / .7fr, align center) ; ≤680 : visuel en colonne 2 sous le texte, aligné à gauche ; reduced-motion coupe la transition des couvertures.
- Vérifié localement (1057 px et 375 px) : visuels contenus dans leur étape, pas de chevauchement texte/visuel, scrollX 0, 0 erreur console. Rendu réel non vu (panneau masqué) : à juger par Lee.
- Déploiement toujours en attente d'accord.

## 2026-11-05 18:58 — Landing : « Comment ça marche » en piste horizontale
- `.lp-steps#lpSteps` : flex + `overflow-x:auto` + scroll-snap, cartes `.lp-step` de `min(440px, 82vw)` (numéro, titre, texte, maquette en bas), la piste déborde à droite jusqu'au bord de l'écran (`margin-right: calc(50% - 50vw)`), barre de défilement masquée.
- En-tête `.lp-section__head--row` avec `.lp-track__nav` (2 boutons `data-track="lpSteps"` / `data-dir`) ; JS générique « Pistes horizontales » : scrollBy d'une carte, boutons désactivés aux extrémités, masqués ≤960.
- Vérifié localement : desktop 1057 (3 cartes 440×402, piste 1388/1030, fin atteinte) et mobile 375 (cartes 308, swipe natif, nav none), scrollX page 0, 0 erreur console. Déploiement toujours en attente.

## 2026-11-05 19:04 — Déploiement + transition « page tournée » entre pages publiques
- Déployé 69e240e sur https://love-ink.web.app (piste horizontale vérifiée en prod via curl).
- `<html class="li-public">` sur index/login/register. `css/immersive.css` : pour `html.li-public`, la transition cross-document (View Transitions, déjà activée par `@view-transition{navigation:auto}`) devient une page qui se tourne : `::view-transition-image-pair(root){perspective:1800px}`, old root `rotateY(0→-150deg)` origine gauche, backface caché, z-index 1, 0,75 s ; new root léger fondu de luminosité. Les autres pages gardent le fondu existant.
- `js/core/immersive.js` : `nameTransitions()` ne nomme plus nav/logo sur les pages publiques (sinon ils flotteraient hors de la page tournée).
- Firefox n'a pas les transitions cross-document : navigation normale. Reduced-motion : désactivé (règle existante).
- Vérifié avec Playwright headless (Chrome installé) : `pagereveal.viewTransition` présent, animations li-turn-out/li-turn-in actives index→page test, login→register sans erreur. Le panneau navigateur masqué saute les transitions (document.hidden), d'où le test headless. Rendu réel à juger par Lee.

## 2026-11-05 19:36 — Déploiement transition page tournée
- 091f4d6 déployé sur https://love-ink.web.app ; vérifié par curl : li-public sur /, login, register ; li-turn-out dans immersive.css ; garde li-public dans immersive.js ; vt-probe.html absent (404).
- Prochaine étape : retour de Lee sur le rendu réel (piste horizontale, page tournée). Suites connues inchangées (domaine loveink.site, audit 8-13, FIREBASE_TOKEN, e2e non relancés).

## 2026-11-05 20:31 — E-mails thématisés (vérification, reset) via service mailer VPS + Resend
- Décision : pas de Blaze ; service Node `server/mailer/` (Admin SDK `generateEmailVerificationLink`/`generatePasswordResetLink` + Resend HTTP), à héberger sur le VPS OVH (Docker + reverse proxy). Reuse-first : rien de réutilisable dans les dépôts EagleFox31 → Build minimal, adaptateur Resend remplaçable.
- Endpoints : `POST /v1/auth/verification` (Bearer ID token), `POST /v1/auth/password-reset {email}` (toujours 200 si compte inconnu, 502 si panne → repli front), `GET /healthz`, `GET /preview/*` (MAILER_PREVIEW=1). CORS allowlist, rate-limit mémoire, e-mails masqués dans les logs, aucun secret journalisé. Tests `node --test` (2 OK), curl local OK.
- Front : `js/core/mailer-client.js` (127.0.0.1:8787 en local, sinon `https://mail.loveink.site` à ajuster) ; register.html/login.html appellent le service puis se replient sur `sendEmailVerification`/`sendPasswordResetEmail`. Page de retour `auth-action.html` + `js/pages/auth-action.js` (verifyEmail / resetPassword, continueUrl même origine seulement). `firebase.json` ignore `server/**`.
- Vérifié localement : preview HTML des gabarits (palette, 560px, Cormorant), auth-action avec code faux → état erreur, repli login avec service arrêté. Non vérifié : envoi réel (clé Resend à créer), lien réel Admin SDK (compte de service absent).
- À faire côté dev : clé Resend « Love Ink » ; compte de service Firebase dans `server/mailer/secrets/` sur le VPS ; `.env` prod ; reverse proxy + domaine (ex. mail.loveink.site) puis mettre `MAILER_URL` à jour ; console Firebase → Authentication → Templates : action URL = `https://love-ink.web.app/auth-action.html` ; déployer hosting (auth-action + login/register).

## 2026-11-05 22:47 — Mailer : déploiement VPS en cours
- Action URL console Firebase impossible (`EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`, plan gratuit) → `server/mailer/link.js` réécrit les liens Admin SDK vers `APP_BASE_URL/auth-action.html` (test OK, commit 69daca3 poussé).
- VPS ubuntu@15.235.90.215 (clé `~/.ssh/id_ed25519_fleet_vps`, docker via sudo) : code copié dans `~/loveink-mailer`, image construite, `.env` écrit sans `RESEND_API_KEY` (MAIL_FROM `Love Ink <loveink@trigenys.com>`, seul domaine Resend vérifié), Caddy `/etc/caddy/sites/loveink-mailer.caddy` → `mail.loveink.site` rechargé.
- Verrous : (1) coller `RESEND_API_KEY` dans `~/loveink-mailer/.env` (clé Resend « Love Ink » créée) ; (2) déposer le JSON compte de service dans `~/loveink-mailer/secrets/firebase-service-account.json` ; (3) DNS Spaceship : A `mail.loveink.site` → 15.235.90.215.
- Ensuite : `sudo docker compose up -d` + `curl https://mail.loveink.site/healthz`, déployer hosting (accord explicite), test réel inscription / reset.

## 2026-11-05 23:26 — Mailer en prod sur le VPS, hosting à déployer
- `https://mail.loveink.site/healthz` OK (Caddy + Let's Encrypt, DNS A ajouté sur Spaceship), CORS 204 pour love-ink.web.app. Conteneur `~/loveink-mailer` (HOST_PORT=8790, 8787 pris par un autre service), secrets en place (clé Resend, JSON compte de service), MAIL_FROM `Love Ink <loveink@trigenys.com>`. Reset réel envoyé avec succès (log « mail envoyé »).
- Commits poussés : 69daca3 (réécriture lien), 6cdcab5 (HOST_PORT). `MAILER_URL` prod déjà = mail.loveink.site.
- Prochaine étape : déployer hosting (`npx -y firebase-tools deploy --only hosting`, accord explicite), puis test complet inscription + reset en prod ; plus tard vérifier loveink.site chez Resend pour un expéditeur @loveink.site.

## 2026-11-05 23:33 — E-mails thématisés en production
- Hosting déployé (auth-action, login, register, mailer-client). Vérifié en prod : reset depuis login → mailer VPS (« mail envoyé » dans les logs, pas de repli), redirection cleanUrls `/auth-action.html?…` → `/auth-action?…` conserve la query.
- Non vérifié par moi : clic sur le lien reçu (page auth-action avec vrai oobCode) et inscription réelle (pas de création de compte en prod) → à tester par Lee/JennLaw.
- Suites : vérifier loveink.site chez Resend (expéditeur @loveink.site au lieu de @trigenys.com) ; e-mails de repli Firebase gardent la page par défaut (plan gratuit) ; VPS : 8787 occupé par un python local, mailer sur 8790.

## 2026-11-06 09:39 — auth-action.html redessinée (commit 6c6bca6, poussé, NON déployé)

- Nouveau `css/auth-action.css` + `auth-action.html` réécrit : emblème par état (plume, enveloppe,
  clé, coche, lien rompu), kicker + titre Baskerville avec italique, trait animé, cascade `.aa-in`,
  dark mode `html[data-theme=dark]`, `prefers-reduced-motion`. Ids et `js/pages/auth-action.js` inchangés.
- Vérifié en local (127.0.0.1:5178) sur les 5 états (bascule `hidden` via JS) et en 375px.
- Reste : `firebase deploy --only hosting` (accord explicite requis), puis ouvrir un vrai lien de reset.

## 2026-11-06 09:48 — 404, login/register harmonisés, fond plume (déployé partiel)

- Déployé en prod (1cbcf4b) : auth-action redessinée, 404.html (servie par Firebase), en-têtes login/register
  en style aa-* (cascade adoucie `aa-rise-soft` car la transition page tournée fige le 1er rendu).
- Commité/poussé NON déployé : fond encre réutilisable `css/ink-quill.css` + `js/core/ink-quill.js`
  (`<div class="li-ink" data-ink-quill>`, options data-words/data-phrases/data-interval) sur login,
  register, auth-action, 404. Empilement : .li-ink z 1 au-dessus du dégradé .auth-container, .auth-card z 2.
- La landing garde sa propre copie (lp-ink) : unification possible plus tard, non régressive.
- Prochaine étape : `firebase deploy --only hosting` après accord, puis ouvrir un vrai lien de reset.

## 2026-11-06 09:49 — mots du fond encre réduits

- Commit poussé, non déployé : taille des mots en filigrane divisée par deux (clamp 1.4rem–3.6rem).
- Prochaine étape : déploiement hosting après accord (fond plume + cette retouche).

## 2026-11-06 10:06 — fond plume déployé en production

- Hosting déployé (jusqu au commit 9a9c14b) : auth-action, 404, login/register harmonisés, fond encre avec mots réduits. Vérifié : /login contient data-ink-quill, ink-quill.css servi.
- Reste : ouvrir un vrai lien de reset en prod ; unifier la landing sur la brique ink-quill (optionnel).

## 2026-11-06 10:21 — aperçu de lien (Open Graph), non déployé

- index.html : balises og:* et twitter:* ; image images/og-love-ink.jpg (1200x630, 43 Ko, générée depuis hero-lettre.webp).
- Prochaine étape : déployer le hosting après accord ; WhatsApp met en cache l aperçu, renvoyer le lien après déploiement.

## 2026-11-06 10:23 — Open Graph déployé en production

- Hosting déployé (b9743e1) : og:* et twitter:* sur la landing, image /images/og-love-ink.jpg servie (200). Le CDN garde l ancienne page ~1 h (max-age 3600), l aperçu WhatsApp est aussi mis en cache côté Meta.
- Suites possibles : OG sur login/register/histoire.html (titre d histoire dynamique), unifier la plume landing sur ink-quill.

## 2026-11-06 10:33 — Pages légales dans l'ambiance (non déployé)
- `conditions.html` / `confidentialite.html` : emblème (`fa-file-signature`, `fa-user-shield`), kicker, titre `aa-title` avec `<em>`, trait, fond encre `data-ink-quill` ; carte `aa-card legal-card`.
- `css/auth-action.css` : bloc `.legal-card` (kicker/titre centrés, titre 2rem, sections décalées 0.3s).
- Piège : `fa-shield-heart` n'existe pas en Font Awesome 6.0.0 (CDN du projet) → icône vide ; vérifier `getComputedStyle(i,'::before').content` avant d'employer une icône récente.
- Vérifié en local desktop + mobile (fond, alignements, pas de débordement). Commit 4ad4f36 poussé. **Prod non déployée** : attendre l'accord.

## 2026-11-06 10:35 — Pages légales « moins ennuyeuses » (non déployé)
- Chapitres : `section.lc-chapter` → badge rond icône + numéro (`.lc-num`), titre `.lc-h2` avec trait dessiné à l'apparition, lettrine, fil vertical entre chapitres, signature `.lc-sign` en bas.
- `js/pages/legal.js` : IntersectionObserver ajoute `is-seen` ; reduced-motion = tout visible.
- Vérifié local desktop + mobile (icônes présentes en FA 6.0.0, pas de débordement). Note : les captures du panneau navigateur ont parfois un frame de retard, re-capturer avant de conclure à un bug.
- Commit `89caf86`. **Prod non déployée** : attendre l'accord.

## 2026-11-06 10:38 — Pages légales déployées en prod
- Déploiement Firebase Hosting OK (commits jusqu'à b50a821). Vérifié par curl : chapitres, legal.js et CSS servis. Prod = dépôt.
- Prochaines pistes : résumé « En bref » en tête des pages légales (contenu à valider avec Lee), OG sur histoire/login/register, unifier la plume de la landing sur ink-quill.

## 2026-11-06 10:43 — Signature studio (non déployé)
- Convention reprise de Xeption (`xeption237/components/Footer.tsx`) : « Made *by* Trigenys Group », « by » en **Pinyon Script** (Google Fonts), accent rose ici (doré chez Xeption).
- `css/styles.css` : `@import` Pinyon Script en 1re ligne + `.li-made-by` ; `css/landing.css` : pleine largeur dans `.lp-footer`. Markup `<p class="li-made-by">Made <em>by</em> Trigenys Group</p>` dans 10 pages (feed/profil/histoire non vérifiés visuellement : connexion requise).
- Commit `073e8b2`. **Prod non déployée** : attendre l'accord.

## 2026-11-06 10:44 — Signature studio déployée en prod
- Déploiement Firebase Hosting OK (commits jusqu'à afc791d). Vérifié par curl : signature présente sur /, /login, /conditions, /feed ; Pinyon Script dans styles.css. Prod = dépôt.

## 2026-11-06 10:52 — SEO + GEO + signature en lien Trigenys
- Nouveaux fichiers racine : `robots.txt` (disallow pages privées : feed, profil, messagerie, notifications, parametres, publier, mes-histoires, auth-action ; `Sitemap:`), `sitemap.xml` (6 URL sans .html grâce à `cleanUrls`), `llms.txt` (présentation GEO).
- Pages publiques (index, login, register, conditions, confidentialite, candidature-modo) : `<link rel="canonical">`, meta description + Open Graph/twitter (image `images/og-love-ink.jpg`). Pages applicatives : `<meta name="robots" content="noindex, nofollow">` (histoire.html reste indexable, titre dynamique `document.title` posé dans `renderStory()`).
- Landing : JSON-LD (Organization → parent Trigenys Group, WebSite, WebApplication, FAQPage) + section FAQ `.lp-faq` (4 `<details>`, style dans `css/landing.css`).
- Signature : `Trigenys Group` devient `<a href="https://trigenys.com" rel="noopener">` dans les 10 pages ; style `.li-made-by a` dans `css/styles.css`.
- Vérifié en local (JSON-LD parsable, FAQ rendue, lien signature). Commit `52181af`. **Prod non déployée** : attendre l'accord.
- Suite possible : OG dynamique par histoire (prérendu via Cloud Function, impossible en hosting statique) ; soumettre `sitemap.xml` dans Google Search Console (action utilisateur).

## 2026-11-06 11:05 — Vérification des pratiques SEO/GEO contre les sources primaires
- Google Search Central (« AI features ») : aucun fichier IA, aucun schema spécial requis ; critères = page indexable avec extrait, contenu en texte, structured data cohérente avec la page, Search Console vérifiée. FAQ rich results supprimés de Google depuis le 7 mai 2026 (schema FAQPage conservé : valide, cohérent avec la FAQ visible, sans effet Google).
- `llms.txt` : aucun moteur majeur ne l'utilise (Google, OpenAI) ; conservé car inoffensif, pas un levier.
- `robots.txt` : groupe explicite OAI-SearchBot / Claude-SearchBot / PerplexityBot (robots de recherche IA, distincts des robots d'entraînement GPTBot/ClaudeBot). Choix d'exclure l'entraînement = décision cliente, non prise.
- Vrai levier restant : les histoires sont rendues côté client (Firestore) → invisibles au premier passage Googlebot et aux crawlers IA (pas de JS). Prérendu HTML par Cloud Function (titre, auteur, extrait, OG) = prochaine étape si Lee veut que les histoires soient trouvées.

## 2026-11-06 11:20 — Autocritique SEO/GEO (failles identifiées, non corrigées)
- histoire.html exige la connexion (`requireAuth` → redirection index.html) : les histoires sont inaccessibles à tout crawler. Le `document.title` dynamique et l'indexabilité de histoire.html sont sans effet. Le seul contenu indexable du site est la landing.
- Sitemap : 4 URL sur 6 (login, conditions, confidentialité, candidature) n'ont aucune intention de recherche ; `lastmod` = date du jour partout (fausse fraîcheur).
- Aucune recherche de mots-clés ; title/H1 poétiques (« L'encre des cœurs ») sans requête cible (« histoires d'amour à lire gratuitement », « romance en ligne »…). Pas de pages par genre ni par auteur = pas de surface SEO.
- Domaine : canonicals sur love-ink.web.app alors que loveink.site est acheté ; brancher le domaine propre avant d'accumuler des signaux sur le sous-domaine Firebase.
- Pas de mesure (Search Console non vérifiée), pas de validation Rich Results / schema, pas de test de non-régression sur les balises head, pas d'audit Core Web Vitals (le `@import` Google Fonts ajouté dans styles.css est bloquant au rendu).
- FAQ inventée (pas de questions réelles d'utilisateurs) ; llms.txt et FAQPage sans effet mesurable.

## 2026-11-06 11:11 — Correctifs SEO (plan 5 étapes) — commit 55ba12c, poussé, NON déployé

- Failles corrigées : title/description/og de `index.html` orientés requêtes ; `@import` Pinyon Script retiré de `css/styles.css` → `<link>` Google Fonts dans les 10 pages signées (feed/profil : ajouté au lien fonts existant) ; `sitemap.xml` réduit (/, /register, /histoires/) sans faux lastmod.
- Nouveau : `scripts/build-seo-pages.mjs` (`npm run build:seo`) lit les histoires `statut == publie` via Firestore REST runQuery (aucun secret), génère `histoires/<id>.html`, `histoires/genre/<slug>.html`, `histoires/index.html` + `sitemap.xml` ; idempotent (second run = 0 écriture), supprime les pages dépubliées ; `--dry-run`, `--base`, `--project`. CSS `css/story-page.css`. `firebase.json` ignore `scripts/`.
- Tests `tests/seo/seo.test.mjs` (`npm run test:seo`, node --test, 19 tests verts) : head des pages publiques (canonical, description 50-170, OG, title 10-70), noindex des privées, JSON-LD + FAQ cohérente, robots, sitemap ↔ fichiers, lien Trigenys. Ont attrapé une description de 182 caractères → raccourcie.
- État : 0 histoire publiée en base (3 `en_attente`) → `histoires/index.html` affiche l'état vide ; relancer `build:seo` avant chaque déploiement une fois des histoires publiées (à automatiser plus tard : CI ou hook de modération).
- À faire côté utilisateur : accord de déploiement hosting ; règles Firestore prod plus permissives que le dépôt (déployer `firestore:rules` sur accord) ; brancher loveink.site puis `--base https://loveink.site` + BASE des tests ; vérifier Search Console.

## 2026-11-06 11:29 — Déploiement hosting prod (accord utilisateur « Oui, déploie »)

- `build:seo` relancé (0 écriture), `test:seo` 19/19, puis `firebase deploy --only hosting` → release complète sur https://love-ink.web.app.
- Vérifié en prod : `/`, `/histoires/`, `/sitemap.xml` (3 URL), `/robots.txt` en 200 ; nouveau title de la landing servi ; `/feed` en noindex ; `scripts/` non publié (404).
- Non déployé : règles Firestore (prod plus permissives que le dépôt) — attendre accord. Reste : brancher loveink.site, Search Console, relancer `build:seo` + déploiement quand des histoires seront publiées.

## 2026-11-06 11:34 — Règles Firestore : fuite des brouillons corrigée et déployée (accord « Oui, les règles »)

- Correction d'un constat précédent : les règles prod étaient identiques au dépôt (deploy : « already up to date »). La lecture anonyme des brouillons venait des règles elles-mêmes : la clause `!('statut' in resource.data)` rendait acceptée toute liste/requête non filtrée sans auth (reproduit sur l'émulateur ; un `get` unitaire était bien refusé).
- Fix `firestore.rules` l.442-446 : clause retirée, lecture = `statut == 'publie'` || modo || auteur. Tous les documents existants ont un statut. Test ajouté dans `tests/rules/firestore.rules.test.mjs` (lecture anonyme : get brouillon refusé, liste non filtrée refusée, requête `publie` acceptée) ; 14/14 verts. `test:rules` exige Java : `C:\Program Files\Eclipse Adoptium\jre-21.0.13.9-hotspot\bin` à mettre dans le PATH.
- Déployé `firestore:rules` 11:34, vérifié en prod via REST sans auth : liste et requête non filtrée → « Missing or insufficient permissions », requête `statut == publie` → OK (0 doc).
- Leçon : « rules are not filters » ne protège pas d'une clause satisfiable par un document hypothétique ; tester systématiquement la liste anonyme non filtrée.
- Prochaine étape : loveink.site, Search Console, `build:seo` + deploy hosting quand des histoires seront publiées.

## 2026-11-06 11:41 — Search Console : propriété en cours de validation

- Propriété « Préfixe d'URL » https://love-ink.web.app/ créée dans Search Console (compte Google ouvert dans le navigateur intégré). Méthode : balise HTML, ajoutée dans `index.html` (commit 51a29af, poussé).
- BLOQUÉ : le déploiement hosting a été refusé par le mode auto (classifieur « Production Deploy »). À faire par l'utilisateur : `npx -y firebase-tools deploy --only hosting --project love-ink --non-interactive`, puis cliquer VALIDER dans Search Console, puis Sitemaps → ajouter `sitemap.xml`.

## 2026-11-06 11:43 — Search Console : propriété validée, sitemap soumis

- Hosting déployé par l'utilisateur (balise servie en prod). Propriété https://love-ink.web.app/ validée (méthode balise HTML — ne pas retirer la balise d'`index.html`). Compte Google utilisé : celui ouvert dans le navigateur intégré (lawrynnjennifer).
- `sitemap.xml` soumis ; état initial « Impossible de récupérer le sitemap » (classique sur une propriété neuve, Google relit sous quelques jours). Sitemap vérifié en 200 / application/xml. À recontrôler dans Search Console > Sitemaps ; si toujours en erreur après 48 h, resoumettre.
- Prochaine étape : brancher loveink.site (ajouter alors une propriété Domaine + `--base`), relancer `build:seo` + deploy quand des histoires seront publiées.

## 2026-11-06 11:48 — Domaine loveink.site ajouté dans Firebase Hosting (DNS à poser)
- Console Firebase > Hosting > site love-ink : domaine personnalisé `loveink.site` ajouté, état « Nécessite une configuration » (mode Configuration rapide).
- Enregistrements à créer chez le registrar du domaine (zone loveink.site) :
  - A    @ (loveink.site)   → 199.36.158.100
  - TXT  @ (loveink.site)   → hosting-site=love-ink
- Ensuite : console Firebase > domaine loveink.site > « Valider » ; propagation DNS + certificat SSL automatique (quelques minutes à 24 h).
- Après activation : ajouter aussi `www.loveink.site` (redirection vers loveink.site), basculer BASE dans index/llms.txt/robots/sitemap/tests SEO et `build:seo --base https://loveink.site`, propriété « Domaine » Search Console, redéploiement (par l'utilisateur).

## 2026-11-06 12:41 — DNS loveink.site posés (registrar Spaceship), validation Firebase en attente
- A 199.36.158.100 et TXT hosting-site=love-ink confirmés sur les NS autoritaires (launch1/launch2.spaceship.net) et sur 8.8.8.8 / 1.1.1.1.
- Console Firebase : « Valider » cliqué 2 fois → « Enregistrements pas encore détectés » (cache résolveur Firebase, jusqu'à 24 h ; revérification automatique).
- À faire : rouvrir Hosting > loveink.site > Valider dans ~1 h ; quand l'état passe à « Connecté », vérifier `curl -I https://loveink.site` (certificat auto), puis bascule BASE + Search Console (voir entrée précédente).

## 2026-11-06 12:42 — Validation Firebase relancée (3e essai), toujours « pas encore détectés »
- DNS corrects partout (autoritaires Spaceship, 8.8.8.8, 1.1.1.1) ; Firebase n'a pas encore rafraîchi son cache.
- Attente d'une heure lancée en tâche de fond dans la session ; relance prévue ensuite (Hosting > loveink.site > Nécessite une configuration > Valider).
- Si toujours bloqué après 24 h : vérifier qu'aucun enregistrement AAAA/CNAME parasite n'existe sur @ et réessayer en mode « Avancé ».

## 2026-11-06 13:43 — loveink.site connecté à Firebase Hosting (HTTPS OK)
- Console Firebase : loveink.site état « Connecté » ; `curl -I https://loveink.site` → 200, certificat auto valide.
- www.loveink.site : pas encore de DNS ni de domaine Firebase → à ajouter (console : Ajouter un domaine personnalisé > www.loveink.site, cocher redirection vers loveink.site, poser les enregistrements A/TXT donnés chez Spaceship).
- Prochaine étape : bascule du site sur https://loveink.site — BASE dans tests/seo/seo.test.mjs, canonicals/OG/JSON-LD des pages publiques, robots.txt (Sitemap), sitemap.xml, llms.txt, `build:seo --base https://loveink.site`, propriété « Domaine » Search Console (TXT DNS) + sitemap ; déploiement hosting par l'utilisateur (accord explicite) ; vérifier ensuite que love-ink.web.app reste accessible (Firebase ne redirige pas automatiquement : prévoir redirect via firebase.json impossible par hôte sur Spark → canonical suffit).

## 2026-11-06 13:48 — Bascule du site sur loveink.site (code prêt, déploiement à faire)
- Commits 0e62702 (bascule : canonicals/OG/JSON-LD, robots, sitemap, llms.txt, histoires/index.html, tests SEO BASE, défauts script SEO/Playwright/mailer) et d3052d0 (2e balise google-site-verification pour https://loveink.site/). Tests SEO 19/19, mailer 3/3.
- Firebase Auth > Domaines autorisés : loveink.site ajouté (Custom).
- Search Console : propriété préfixe https://loveink.site/ créée, NON validée (balise HTML, en attente de déploiement) ; sitemap à soumettre ensuite.
- À FAIRE par l'utilisateur : `npx -y firebase-tools deploy --only hosting --project love-ink --non-interactive` ; puis sur le VPS, `~/loveink-mailer/.env` : APP_BASE_URL=https://loveink.site et ALLOWED_ORIGINS avec loveink.site (+ web.app), redémarrer le mailer (sinon les e-mails de vérification pointent sur web.app et le CORS bloque depuis loveink.site).
- Après déploiement : Search Console > Valider (balise HTML), soumettre sitemap.xml ; ajouter www.loveink.site dans Hosting (redirection) + DNS chez Spaceship ; aperçus HTML du mailer (server/mailer/preview/*) encore sur web.app, à régénérer si besoin.

## 2026-11-06 13:51 — loveink.site en prod, Search Console validée
- Déploiement hosting fait par l'utilisateur (release complete) ; https://loveink.site/ sert canonical loveink.site, 2 balises google-site-verification, robots → sitemap loveink.site.
- Search Console : propriété https://loveink.site/ validée (balise HTML) ; sitemap.xml soumis, état initial « Impossible de récupérer » (idem web.app le 06/11 11:43 ; fichier 200) → recontrôler sous 48 h. Piège noté : dans le dialogue de validation, plusieurs boutons « Valider » (un par méthode) ; cliquer celui qui suit la balise meta, sinon c'est la méthode DNS qui est testée.
- Reste : VPS mailer .env (APP_BASE_URL, ALLOWED_ORIGINS) par l'utilisateur ; www.loveink.site (Hosting + DNS Spaceship) ; ancienne propriété web.app à garder (ou « changement d'adresse » plus tard) ; aperçus mailer server/mailer/preview/* encore sur web.app.

## 2026-11-06 13:53 — www.loveink.site ajouté dans Firebase Hosting (DNS à poser)

- Domaine `www.loveink.site` ajouté dans Firebase Hosting (console), état « Nécessite une configuration ». Ajouté comme alias simple (la case « Rediriger vers un site Web existant » n'a pas été retenue par le dialogue) : le site sera servi tel quel sur www ; les balises canonical pointent déjà vers https://loveink.site, donc pas de contenu dupliqué pour Google. Si on veut une vraie redirection 301 www → apex : supprimer le domaine www dans la console et le ré-ajouter en cochant « Rediriger ».
- DNS à poser chez Spaceship (zone loveink.site) : `CNAME  www  →  love-ink.web.app` (pas d'enregistrement A/TXT demandé pour www).
- Ensuite : dans Hosting, ouvrir www.loveink.site → « Valider » (cache résolveur Firebase ~1 h, comme pour l'apex), puis ajouter `www.loveink.site` dans Authentication → Paramètres → Domaines autorisés si on veut pouvoir se connecter depuis www.
- Toujours en attente côté VPS : `~/loveink-mailer/.env` → `APP_BASE_URL=https://loveink.site`, `ALLOWED_ORIGINS` avec loveink.site (+ web.app, + www.loveink.site si utilisé), redémarrer le mailer.

## 2026-11-06 13:56 — CNAME www posé, validation Firebase en attente

- CNAME `www.loveink.site → love-ink.web.app` posé chez Spaceship, propagé (Google DNS et serveur autoritaire launch1.spaceship.net confirment).
- Validation lancée dans Firebase Hosting : « Enregistrements pas encore détectés » (cache résolveur Firebase, même délai ~1 h que pour l'apex). À refaire : Hosting → www.loveink.site → « Valider » jusqu'à « Connecté » ; puis certificat auto.
- Après « Connecté » : ajouter www.loveink.site dans Authentication → Domaines autorisés si la connexion depuis www doit marcher ; VPS `~/loveink-mailer/.env` (APP_BASE_URL, ALLOWED_ORIGINS) toujours à faire.

## 2026-11-06 14:59 — www.loveink.site connecté

- Firebase Hosting : `www.loveink.site` passé « Connecté » (validation automatique, pas de relance nécessaire). Vérifié depuis 3 points externes (check-host.net) : https://www.loveink.site → 200 sur 199.36.158.100.
- Attention réseau local : depuis le poste de dev, le certificat de www est remplacé par celui d'un pare-feu Fortinet (SSL inspection) et la page renvoie 403 — c'est le réseau local, pas le site. Tester depuis un autre réseau (4G) ou un point externe avant de conclure à un problème.
- www est servi comme alias (pas de redirection 301 vers l'apex) ; canonical → https://loveink.site. Option plus tard : supprimer/ré-ajouter www en cochant « Rediriger ».
- Restant : Authentication → Domaines autorisés → ajouter www.loveink.site si la connexion depuis www doit marcher ; VPS `~/loveink-mailer/.env` (APP_BASE_URL, ALLOWED_ORIGINS) + redémarrage du mailer.

## 2026-11-06 16:15 — www.loveink.site autorisé dans Firebase Auth

- Authentication → Paramètres → Domaines autorisés : `www.loveink.site` ajouté (liste : localhost, love-ink.firebaseapp.com, love-ink.web.app, loveink.site, www.loveink.site).
- État global : apex et www « Connectés » dans Hosting, HTTPS OK depuis l'extérieur ; prod sur https://loveink.site ; Search Console validée pour loveink.site (sitemap à recontrôler sous 48 h).
- Seul reste côté utilisateur : VPS `~/loveink-mailer/.env` → APP_BASE_URL=https://loveink.site, ALLOWED_ORIGINS=https://loveink.site,https://www.loveink.site,https://love-ink.web.app ; redémarrer le mailer. Rien à déployer sur Hosting.

## 2026-11-06 16:18 — Mailer VPS basculé sur loveink.site

- VPS `~/loveink-mailer/.env` : APP_BASE_URL=https://loveink.site, ALLOWED_ORIGINS=https://loveink.site,https://www.loveink.site,https://love-ink.web.app (sed en place, secrets intacts). Conteneur recréé (`sudo docker compose up -d --force-recreate`). Preflight CORS depuis https://loveink.site → 204 (testé depuis le VPS).
- Non testé : preflight depuis www.loveink.site et origine étrangère (le poste de dev ne peut pas joindre mail.loveink.site : pare-feu Fortinet, 403). À lancer depuis le VPS si besoin.
- Migration de domaine terminée : Hosting (apex + www connectés), Auth (domaines autorisés), Search Console (validée, sitemap à recontrôler sous 48 h), mailer. Aucun verrou restant. Reste optionnel : régénérer `server/mailer/preview/*` (encore web.app), redirection 301 www → apex si souhaitée.

## 2026-11-06 16:19 — CORS mailer vérifié pour www

- Preflight depuis le VPS : https://www.loveink.site → 204, https://evil.example → 403. Allowlist CORS du mailer confirmée pour apex, www et web.app. Migration de domaine entièrement vérifiée, aucun reste bloquant.

## 2026-11-06 16:25 — Mission SEO/GEO « industry grade » lancée

- État : migration domaine finie. Nouvelle mission : porter SEO + GEO à un niveau industry grade. Audit/plan confié à l'agent architecte (firebase.json headers/cache/301, JSON-LD par page histoire/genre, sitemap complet + lastmod, RSS/Atom, llms-full.txt, IndexNow/Bing, perf fonts/FontAwesome/images, automatisation régénération + déploiement via GitHub Action, maillage interne, pages genre avec intro).
- Mesure perf : Lighthouse local refusé par le classifieur auto mode (`npx lighthouse --no-sandbox`), API PageSpeed en quota 429 ; mesure via https://pagespeed.web.dev dans le navigateur intégré en cours.
- Verrous : aucun. Prochaine étape : appliquer le plan de l'architecte par chantiers vérifiables (tests node --test tests/seo, build:seo), puis déploiement par l'utilisateur.

## 2026-11-06 16:41 — SEO/GEO industry grade : chantiers implémentés, non déployés

- Fait (commit à suivre) : `histoire.html` en noindex ; générateur `scripts/build-seo-pages.mjs` réécrit (slugs `/histoires/<slug>-<id>`, JSON-LD Article/BreadcrumbList/ItemList/CollectionPage/FAQPage, sitemap lastmod, flux Atom `/histoires/flux.xml`, `llms.txt` bloc marqué + `llms-full.txt`, bloc « dernières histoires » dans `index.html`, garde-fou `shrinkGuard`, `--dry-run/--fixture/--out/--allow-shrink`) ; `data/genres.json` (intros/descriptions des 8 catégories de `publier.html`, **textes provisoires à valider par Lee**) ; perf accueil (fonts/FontAwesome non bloquants, srcset hero 480w, Firestore SDK non chargé via `js/core/firebase-app.js`) ; contraste `.lp-eyebrow`/`.li-made-by` ; `firebase.json` (cache par type, CSP Report-Only, X-Robots-Tag noindex sur espaces privés, 301 `/histoires/genre`) ; IndexNow (`scripts/indexnow.mjs`, clé publique `4564aefdadf1fe978b843a47d3845545.txt` à la racine) ; workflows `seo-refresh.yml` (toutes les 6 h) et `firebase-deploy.yml` (compte de service, Firestore seulement si règles/index modifiés) ; `docs/engineering/lessons-learned.md`.
- Preuve : `node --test tests/seo/*.test.mjs` → 44/44 ; build réel : 0 histoire publiée en prod (Firestore `statut == "publie"` vide, confirmé en REST), donc bibliothèque vide pour l'instant.
- À faire par l'utilisateur : (1) créer le secret GitHub `FIREBASE_SERVICE_ACCOUNT_LOVE_INK` (JSON d'un compte de service, rôle Firebase Hosting Admin ; + Rules Admin / Datastore Index Admin si on veut déployer Firestore via CI) — sans lui les deux workflows échouent explicitement ; (2) déployer Hosting (`firebase deploy --only hosting --project love-ink`) ; (3) 301 www→apex en console Hosting ; (4) importer le site dans Bing Webmaster Tools ; (5) re-mesurer PSI mobile (baseline 75) ; (6) observer la CSP Report-Only en prod (login Google, publication, messagerie) avant tout passage en bloquant.
- Verrous : aucun. Secrets jamais lus ni commités.

## 2026-11-06 16:56 — Déploiement Firebase sans clé (WIF) via AppFactory : écarts et plan, en attente de validation

- Demande : avant de créer `FIREBASE_SERVICE_ACCOUNT_LOVE_INK`, étudier GitHub OIDC + Workload Identity Federation et un provider AppFactory réutilisable. Analyse en lecture seule, aucun fichier du dépôt modifié, aucun identifiant créé, aucun déploiement.
- Constat : `Trigenys/appfactory` (Worker Cloudflare Pages/D1/R2/Neon, broker GitHub) et `EagleFox31/appfactory-project-automation` n'ont **aucune** primitive Firebase/GCP ; patterns à adapter : `reusable-pages-deploy.yml` (contrat sans secret, modes plan/preview/production) et `docs/aws-oidc-one-time-bootstrap.md`.
- Faisabilité vérifiée : `google-github-actions/auth` v3.0.0 (sha `7c6bc770dae815cd3e89ee6cdf493a5fab2cc093`) ; `firebase-tools` 15.35.0 charge un fichier `external_account` et appelle STS (test local avec pool factice → `invalid_target`, contrôle sans credential → « have you run firebase login? ») ; régression 15.22.2 corrigée en 15.22.3, cause Node 22.23.0/24.17.0 → épingler Node exact. `FirebaseExtended/action-hosting-deploy` reste JSON-only (issues #174, #399 ouvertes) → à remplacer.
- Plan complet : `C:\Users\lawry\AppData\Local\Temp\claude\dd1a7a74099b0da2\6ee8181d-41ae-4ff3-adc7-deba6558666b\scratchpad\plan-firebase-wif-appfactory.md` (à copier dans `docs/engineering/` si validé). Résumé : nouveau `reusable-firebase-deploy.yml` + `scripts/firebase-deploy/contract.mjs` + tests + docs dans appfactory-project-automation (fichiers neufs, Cloudflare intact) ; Love Ink consomme via `.github/appfactory-impact.json` + `reusable-impact-analysis` ; `seo-refresh` garde le cron 6 h en 3 jobs (refresh → deploy → indexnow, sitemap précédent en artefact) ; bootstrap GCP (pool `github`, provider OIDC avec `attribute.repository`, SA `github-deploy` sans clé, rôles Hosting Admin [+ Rules Admin, Datastore Index Admin si Firestore via CI]) à exécuter par l'utilisateur, plan → apply.
- Prochaine étape : validation du plan par l'utilisateur, puis phase 1 (PR appfactory-project-automation). Le secret JSON ne doit pas être créé.

## 2026-11-06 17:32 — Firebase WIF phase 1 : PR ouverte dans appfactory-project-automation

- PR https://github.com/EagleFox31/appfactory-project-automation/pull/147 (branche `feat/reusable-firebase-deploy`, commit `27421c6`) : workflow réutilisable `reusable-firebase-deploy.yml` (OIDC + WIF, aucun secret), contrat `scripts/firebase-deploy/contract.mjs`, 18 tests (18/18), docs `docs/reusable-firebase-deploy.md` + `docs/gcp-wif-one-time-bootstrap.md`, exemple `examples/firebase-deploy.yml`, lessons LESSON-2026-017/018.
- Suite complète `npm test` sur Windows : 15 échecs pré-existants (AWS/CloudFormation/governance), identiques sur `origin/main` propre ; CI Linux fait foi (en attente au moment de l'écriture).
- Love Ink **non modifié** ; aucun bootstrap GCP, aucun déploiement, aucun secret créé. Mission SEO/GEO (`1fcd2f2`) toujours non déployée.
- Phase 2 à faire après revue/merge : `hosting.ignore` (`**/gha-creds-*.json`, `**/.*`), `.github/appfactory-impact.json`, remplacer `action-hosting-deploy@v0` + secret JSON par le workflow réutilisable épinglé au SHA mergé, chaîner refresh → deploy (`checkout_ref`, `deployed_sha`) → IndexNow, bootstrap GCP humain (runbook verify puis apply), variables `GCP_WORKLOAD_IDENTITY_PROVIDER` / `GCP_DEPLOY_SERVICE_ACCOUNT`.

## 2026-11-07 03:43 — Firebase WIF phase 2 : PR Love Ink ouverte

- PR https://github.com/Trigenys/loveink/pull/1 (branche `feat/firebase-wif-deploy`, commit `11e8900`) : `hosting.ignore` + `**/gha-creds-*.json`, `.github/appfactory-impact.json` (surfaces `site` → gates `seo-tests`/`hosting`, `firestore` → `firestore`), `firebase-deploy.yml` réécrit (impact → seo-tests → hosting → firestore ; PR = plan, push main = production), `seo-refresh.yml` réécrit (refresh → deploy sur le SHA poussé → IndexNow si `deployed_sha` = SHA poussé, ancien sitemap via artefact), test de garde dans `tests/seo/hosting.test.mjs`. Tests SEO 45/45. Pins vérifiés (checkout/setup-node/upload-artifact v5.0.0, download-artifact v6.0.0).
- Épinglé sur `27421c60e1eca0107ef376408471412c44767770` = commit de la PR AppFactory #147 (https://github.com/EagleFox31/appfactory-project-automation/pull/147, non mergée) : **re-épingler** les quatre `@27421c6…` + `appfactory_ref` sur le SHA mergé.
- Verrous : aucun déploiement, aucun bootstrap GCP, aucun secret créé/supprimé. Tant que les variables `GCP_WORKLOAD_IDENTITY_PROVIDER` / `GCP_DEPLOY_SERVICE_ACCOUNT` sont absentes, tout reste en `plan` (le chemin par clé JSON est retiré) → merger après bootstrap + variables, ou accepter la coupure. Mission SEO/GEO (`1fcd2f2`) toujours non déployée.
- Prochaines étapes (propriétaire) : runbook `docs/gcp-wif-one-time-bootstrap.md` (verify puis apply) sur `love-ink` pour `Trigenys/loveink` ; variables ci-dessus ; environnement `production` (branche `main`) ; merge #147 puis re-pin ; merge PR 1 ; après un run production réussi, supprimer `FIREBASE_SERVICE_ACCOUNT_LOVE_INK` et révoquer la clé.

## 2026-11-07 03:59 — Phase 2 : CI bloquée par la facturation GitHub

- Re-déclenchement (commit vide) : toujours 0 job sur `firebase-deploy.yml` et `project-automation.yml` ; annotation GitHub : paiements de l'organisation Trigenys échoués / limite de dépense. Aucune erreur de workflow identifiée (inputs vérifiés contre les workflows réutilisables à `27421c6`).
- `gcloud` absent de la machine : bootstrap GCP impossible ici de toute façon (action humaine).
- Bloqué sur l'utilisateur : (1) rétablir la facturation GitHub puis relancer les checks de la PR 1 ; (2) bootstrap GCP + variables ; (3) merge AppFactory #147 puis re-pin.

## 2026-11-07 10:20 — Phase 2 : CI verte (plan)

- Dépôt `Trigenys/loveink` passé **public** à la demande de l'utilisateur (Actions bloqué en privé, plan gratuit) ; scan préalable : aucun secret dans fichiers ni historique (clé Firebase web publique par conception).
- Erreur de compilation du workflow réutilisable (`runner.temp` dans `env` de job) corrigée dans AppFactory `b236135` (PR #147, LESSON-2026-019, test structurel) ; Love Ink re-épinglé sur `b236135` (`5bdff0a`).
- Run 42332913072 : impact, seo-tests, hosting (plan) OK, firestore ignoré, étapes d'identité ignorées comme prévu.
- Reste (propriétaire) : bootstrap GCP + variables + environnement `production` ; merge #147 puis re-pin sur SHA mergé ; merge PR 1 ; suppression du secret JSON après run production réussi.
- Demande SEO/GEO reçue de la session expert-seo-geo : P0 déjà largement couvert par `scripts/build-seo-pages.mjs` (pages histoires/genres statiques, sitemap lastmod, JSON-LD Article) mais non déployé ; écarts : `/register` dans le sitemap, pas de pages auteurs, pas de `parentOrganization`, P1 (intros genres, pages ressources) absent.

## 2026-11-07 10:33 — Bootstrap GCP : bloqué par les droits

- Cloud Shell (navigateur, compte connecté du propriétaire) sur `love-ink`, numéro de projet 942272722437. Saisie du terminal : seules les frappes `key` touche par touche passent (`type` est ignoré).
- Vérification en lecture seule : pas de pool WIF, pas de compte `github-deploy`.
- Appliqué : activation de `iamcredentials.googleapis.com` et `sts.googleapis.com` (idempotent).
- Bloqué : `workload-identity-pools create` → IAM_PERMISSION_DENIED. Le compte connecté n'a que `roles/editor` sur le projet ; il faut le compte Owner (ou les rôles Workload Identity Pool Admin + Service Account Admin + Project IAM Admin) pour la suite du runbook (pool, provider, SA, 3 rôles projet, binding workloadIdentityUser sur `Trigenys/loveink`).
- Session SEO lancée par l'utilisateur : `local_db63e3e4-…` (écarts P0/P1 en worktree, PR sans merge).

## 2026-11-07 10:42 — PR SEO/GEO ouverte

- PR 2 (`feat/seo-geo-gaps`, non mergée) : pages auteurs, 3 guides `/ressources/`, genres éditorialisés, JSON-LD enrichi, `/register` hors sitemap ; 57/57 tests SEO annoncés par la session. Issues P2 #3–#6, suivi #7 (pseudo auteur = partie locale de l'e-mail).
- Les checks de la PR 2 ne lancent que sync-project : les tests SEO tourneront en CI après merge de la PR 1 (workflow firebase-deploy).
- Bootstrap GCP toujours bloqué (compte Editor seulement).

## 2026-11-07 11:25 — Bootstrap GCP : attente droits Owner

- Owner (liakoa99@gmail.com) en train d'accorder le rôle Propriétaire à lawrynnjennifer@gmail.com via la console IAM (mobile).
- Ensuite : reprendre le runbook WIF dans Cloud Shell (pool github, provider github-actions, SA github-deploy + 3 rôles, liaison workloadIdentityUser), puis variables GitHub + environnement production via gh.

## 2026-11-07 15:57 — Bootstrap GCP WIF terminé

- Owner accordé à lawrynnjennifer@gmail.com. Créés (Cloud Shell, script idempotent describe||create) : pool `github`, provider `github-actions` (ACTIVE, condition repository_owner==Trigenys), SA `github-deploy@love-ink.iam.gserviceaccount.com` + firebasehosting.admin, firebaserules.admin, datastore.indexAdmin ; workloadIdentityUser limité à Trigenys/loveink.
- GitHub : variables GCP_WORKLOAD_IDENTITY_PROVIDER et GCP_DEPLOY_SERVICE_ACCOUNT posées, environnement `production` limité à `main`.
- Reste (humain) : merger AppFactory #147, re-épingler le SHA, merger PR 1 (le push sur main déploiera en production), puis PR 2 ; supprimer le secret FIREBASE_SERVICE_ACCOUNT_LOVE_INK après un run prod réussi.

## 2026-11-07 15:57 — PR #8 (issue #7) ouverte

- PR 8 : pseudo du profil seul nom d'auteur, publication bloquée sans pseudo ; 64 tests SEO annoncés, aucun check CI sur GitHub. Non mergée.
- Ordre de merge : AppFactory #147 → re-épinglage SHA → PR 1 → PR 2 → PR 8.

## 2026-11-09 07:59 — #147 mergée, PR 1 re-épinglée

- AppFactory #147 squash-mergée : 71149532f5fce30aa24c3e0c6bb312b6ce63f13e. firebase-deploy.yml et seo-refresh.yml re-épinglés sur ce SHA (PR 1).
- Prochaine étape (humain) : merger PR 1 (déploie en production), puis PR 2 et PR 8 ; supprimer le secret JSON après un run prod réussi.
