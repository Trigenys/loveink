# Lessons learned — Love Ink

Mémoire des erreurs, near misses et pièges du projet (standard RAIDER, « failure memory »). À consulter avant
tout travail sur Hosting, SEO, déploiement ou mailer. Une entrée = contexte, cause, résolution, prévention.

## 2026-11-06 — `/.well-known/` jamais servi par Firebase Hosting

- **Contexte** : clé IndexNow prévue en `/.well-known/indexnow.txt`.
- **Cause** : `hosting.ignore` contient `**/.*` (nécessaire pour ne pas publier `.git`, `.claude`, `.env`…),
  ce qui exclut tout dossier commençant par un point, `.well-known` compris.
- **Résolution** : clé publiée en `/<clé>.txt` à la racine (forme acceptée par IndexNow).
- **Prévention** : `tests/seo/indexnow.test.mjs` vérifie que le fichier de clé est à la racine et non ignoré ;
  `tests/seo/hosting.test.mjs` vérifie qu'aucune URL `.well-known` n'est promise dans le sitemap.

## 2026-11-06 — `Disallow: /feed` bloque tout chemin commençant par `/feed`

- **Contexte** : flux Atom envisagé en `/feed.xml`.
- **Cause** : `robots.txt` interdit par préfixe ; `/feed` (page privée) masquait aussi `/feed.xml`.
- **Résolution** : flux publié en `/histoires/flux.xml`.
- **Prévention** : `tests/seo/hosting.test.mjs` échoue si le sitemap référence `/feed.` ou `/feed/`.

## 2026-11-06 — Un générateur qui lit une source vide supprime toutes les pages

- **Contexte** : `build-seo-pages.mjs` supprime les pages des histoires dépubliées (idempotence).
  Une panne Firestore ou une règle de sécurité modifiée renverrait 0 histoire et effacerait le site.
- **Résolution** : garde-fou `shrinkGuard` (0 histoire alors que des pages existent, ou > 50 % supprimées)
  → arrêt code 2, contournable explicitement avec `--allow-shrink` (entrée `allow_shrink` du workflow).
- **Prévention** : testé dans `tests/seo/generator.test.mjs`.

## 2026-11-06 — Déploiement CI avec `FIREBASE_TOKEN` et `firebase deploy` complet

- **Contexte** : l'ancien workflow déployait Hosting + règles Firestore + index à chaque push avec un token
  utilisateur déprécié.
- **Risque** : un push anodin pouvait écraser des règles ; token lié à un compte personnel.
- **Résolution** : compte de service dédié (`FIREBASE_SERVICE_ACCOUNT_LOVE_INK`), Hosting toujours, Firestore
  seulement si `firestore.rules` / `firestore.indexes.json` changent, `concurrency: hosting-deploy` partagé
  avec `seo-refresh.yml` pour éviter deux déploiements croisés.
- **Prévention** : échec explicite et actionnable si le secret est absent.

## 2026-11-06 — CSP : passer par `Report-Only` avant de bloquer

- **Contexte** : Firebase Auth (popup Google), Firestore (WebSocket), fonts, FontAwesome, mailer.
- **Règle** : toute CSP est d'abord en `Content-Security-Policy-Report-Only`, observée en prod (console du
  navigateur) sur login, publication, messagerie, puis seulement basculée en bloquante.
- **Prévention** : `tests/seo/hosting.test.mjs` refuse une CSP bloquante tant que cette validation n'est pas documentée ici.

## 2026-11-07 — Pages auteurs : risque de publier un e-mail ou un uid

- **Contexte** : ajout de pages publiques `/histoires/auteur/<slug>` et d'un `Person` JSON-LD par histoire.
- **Cause (near miss)** : le champ `auteur` d'une histoire est saisi côté client ; un repli sur l'e-mail
  (ou sa partie locale) et l'`auteurId` (uid Firebase) sont présents dans le document Firestore.
  Les exposer dans une URL, un slug ou du JSON-LD les rendrait indexables et cachés par les moteurs.
- **Classification** : vie privée / donnée personnelle, détecté avant publication.
- **Résolution** : `publicName()` masque toute valeur contenant `@` (« Auteur inconnu », sans page ni
  `Person`) ; l'`auteurId` sert uniquement à regrouper en mémoire, jamais écrit ; slug dérivé du pseudonyme.
- **Prévention** : `tests/seo/pages.test.mjs` (« vie privée ») échoue si `uid-` ou un e-mail apparaît dans
  une sortie générée. Règle générale : toute donnée utilisateur rendue publique passe par une liste
  blanche de champs, testée sur un jeu contenant des valeurs sensibles.
- **Reste ouvert** : `publier.html` remplit `auteur` avec `email.split('@')[0]` quand le compte n'a pas de
  `displayName` ; cette partie locale n'est pas détectable par le générateur. Correctif côté saisie suivi
  en issue (pseudonyme obligatoire avant publication).

## 2026-11-07 — Nom d'auteur public dérivé de l'e-mail à la saisie (issue #7)

- **Contexte** : suite de l'entrée « Pages auteurs : risque de publier un e-mail ou un uid » (PR #2).
  `publier.html` remplissait `auteur` avec `displayName || email.split('@')[0]`.
- **Cause racine** : un repli « pratique » à la saisie transformait une donnée privée (identifiant d'e-mail) en
  nom public ; le générateur SEO ne peut pas reconnaître une partie locale d'e-mail (pas de `@`), donc la
  défense en aval était insuffisante. Même repli dans le pré-remplissage du pseudo de `parametres.html`.
- **Classification** : vie privée / donnée personnelle, near miss (corrigé avant fusion des pages auteurs).
- **Résolution** : `js/core/public-author.js` → `resolvePublicAuthorName(profile, user)` : seul le pseudo du
  profil Firestore devient public ; vide, contenant `@` ou égal à l'identifiant de l'e-mail → publication
  bloquée avec un message et un lien vers `parametres.html`. Pré-remplissage de `parametres.html` sans e-mail.
- **Prévention** : `tests/seo/author-name.test.mjs` (exécuté par la CI `tests/seo/*.test.mjs`) échoue si
  `publier.html` ou `parametres.html` découpent l'e-mail, ou si la résolution renvoie un nom issu de l'e-mail.
- **Leçon** : une donnée rendue publique se valide à la source (saisie), pas seulement à la sortie ; aucun nom
  public n'est jamais dérivé d'un identifiant privé, même en repli.
- **Reste à faire** : histoires déjà enregistrées avec ce repli (recensement + invitation des auteurs à choisir
  un pseudo), suivi dans l'issue #7.
## 2026-11-16 — `test:seo` rouge en local Windows à cause du CRLF

- **Contexte** : refonte des catégories du fil ; `npm run test:seo` lancé sur un worktree Windows.
- **Cause** : `core.autocrlf=true` et aucun `.gitattributes`, donc `robots.txt` est extrait en CRLF. Les tests
  `seo.test.mjs` cherchent `Disallow: /feed\n`. Deux tests échouent sans aucun changement (faux rouge), alors
  que la CI Linux est verte.
- **Classification** : near miss d'outillage / environnement ; risque de masquer une vraie régression.
- **Résolution** : vérification de la suite sur une copie en LF (`git -c core.autocrlf=false worktree add`).
- **Prévention proposée** : ajouter un `.gitattributes` (`* text=auto eol=lf`) ou normaliser `\r\n` dans les tests
  qui lisent des fichiers texte. Ce changement est transversal et fait l'objet d'une PR dédiée.

## 2026-11-16 — Wizard « Écrire une histoire » : collision `data-step` et couleur imposée par `app.css`

- **Contexte** : refonte de `publier.html` en parcours par étapes (sections `[data-step="..."]`).
- **Cause 1** : l'étape courante était posée sur la racine en `root.dataset.step`. La racine correspondait alors
  elle aussi à `[data-step="categorie"]`, ce qui cassait tous les sélecteurs e2e (violation strict mode) et
  aurait pu cibler le mauvais nœud en CSS.
- **Cause 2** : `body.li-app label { color: var(--ink) }` dans `css/app.css` l'emporte sur `.li-genre { color }`,
  ce qui rendait les noms de genres illisibles sur les photos. Les tests passaient : seule la capture l'a montré.
- **Classification** : bug d'intégration (espace de noms d'attributs) et régression visuelle d'accessibilité.
- **Résolution** : état courant renommé `data-current-step` ; règle `body.li-app .li-genre` (spécificité
  supérieure) et dégradé plus sombre sous le texte.
- **Prévention** : un attribut de sélection (`data-step`) n'est jamais réutilisé comme attribut d'état sur un
  ancêtre ; tout composant posé dans `body.li-app` qui fixe une couleur de `label` le fait avec le préfixe
  `body.li-app`. Revue visuelle sur captures desktop + mobile avant PR.
## 2026-11-16 — Les e2e écrivaient dans la production

- **Contexte** : `playwright.config.js` prenait `https://loveink.site` par défaut et le code servi en local
  parlait au vrai projet Firebase `love-ink`. Chaque lancement de `npm test` créait des comptes
  `*@loveink-e2e.test`, des profils et des histoires en production.
- **Cause** : la cible des tests et celle du client n'étaient pas des décisions explicites. La valeur par défaut
  était la prod, aucun environnement isolé n'existait et la CI ne lançait pas les e2e.
- **Classification** : incident de données (pollution de la production) ; défaut de garde-fou, pas de bug applicatif.
- **Résolution** : e2e sur la Firebase Emulator Suite (Auth, Firestore, Hosting) sous le projet `demo-love-ink`
  (`npm run test:e2e`). Le client vise les émulateurs sur tout hôte local (`js/core/firebase-target.js`).
  Comptes déjà créés : inventaire en lecture seule (`scripts/e2e-prod-cleanup-plan.mjs`), puis suppression
  lancée par l'utilisatrice (`scripts/e2e-prod-cleanup-apply.mjs`, simulation par défaut, `--apply --confirm
  love-ink`), qui revérifie chaque compte et chaque document en direct ; règles partagées et testées dans
  `scripts/lib/e2e-test-accounts.mjs` (`tests/seo/e2e-prod-cleanup.test.mjs`).
- **Prévention vérifiable** :
  - `playwright.config.js` échoue immédiatement sur un hôte non local sans `E2E_ALLOW_PROD=1` ;
  - `registerWithUi` / `loginWithUi` vérifient dans la page que le client vise les émulateurs avant d'écrire ;
  - tests `tests/seo/e2e-isolation.test.mjs` sur ces deux garde-fous ;
  - jobs CI `rules-tests` et `e2e` sur émulateurs, qui conditionnent les déploiements.
- **Leçon généralisée** : un test qui écrit ne doit jamais avoir la production comme cible par défaut. La cible
  s'exprime explicitement, l'environnement isolé est le chemin par défaut, et viser la prod demande une
  dérogation nommée et visible.

## 2026-11-16 — Règle de rôle refusant les profils sans champ `role` (near miss)

- **Contexte** : le nouvel e2e « admin attribue un rôle » échouait sur les émulateurs avec « Impossible de changer
  ce rôle », alors que les tests de règles passaient.
- **Cause** : `register.html` crée le profil sans champ `role` (rôle implicite `user`). Les règles exigeaient
  `diff().changedKeys().hasAny(['role'])` ; or une clé **ajoutée** n'apparaît que dans `addedKeys()` /
  `affectedKeys()`, jamais dans `changedKeys()`. Les tests de règles semaient des profils avec `role` déjà posé.
  Même défaut, déjà en production, sur la promotion par un censeur (`validRolePromotionUpdate`).
- **Classification** : bug de règle Firestore masqué par des données de test non représentatives (near miss,
  détecté avant fusion par l'e2e sur émulateurs).
- **Résolution** : comparaison explicite au rôle implicite (`request.resource.data.role != resource.data.get('role', 'user')`)
  pour l'admin, `affectedKeys().hasAny(['role'])` pour la promotion censeur.
- **Prévention vérifiable** : test de règles « profil sans champ role (créé par register.html) » ; e2e
  `tests/e2e/admin-role.spec.js` qui passe par le vrai parcours d'inscription.
- **Leçon généralisée** : pour détecter qu'un champ change, ne pas utiliser `changedKeys()` seul quand le champ
  peut être absent ; et semer les tests avec les documents tels que l'application les crée réellement.

## 2026-11-16 — E2E : port local déjà servi par une autre copie du site

- **Contexte** : histoires en chapitres ; e2e hermétiques lancés contre `http://127.0.0.1:5178`.
- **Cause** : le port était déjà occupé par un serveur d'un autre worktree (autre version du site). Le nouveau
  serveur n'a pas pu s'y lier, mais les requêtes ont abouti quand même : les tests visaient un code qui
  n'était pas celui de la branche (wizard jamais monté, délais dépassés sans erreur explicite).
- **Classification** : near miss d'outillage local ; faux rouge, et risque symétrique de faux vert.
- **Résolution** : serveur relancé sur un port libre (5191), suite repassée au vert.
- **Prévention** : avant une campagne e2e locale, vérifier que le serveur sert bien ce worktree, par exemple
  `curl -s "$E2E_BASE_URL/js/core/series.js" | cmp - js/core/series.js` (ou tout fichier propre à la branche),
  et choisir un port inutilisé. Toujours fixer `E2E_BASE_URL` (la config vise la production par défaut).
- **Bug annexe trouvé par l'e2e** : `publishStoryImages` impose un minimum d'images par défaut ; un chapitre
  sans image échouait sans message. Le mode chapitre passe `min: 0` et un test e2e couvre l'envoi sans image.

## 2026-11-16 — E2E : suite lancée sans filtre, un test non hermétique a touché la production

- **Contexte** : vérification de non-régression des histoires en chapitres, serveur local `127.0.0.1:5191`.
- **Cause** : `npx playwright test` sans filtre exécute aussi `tests/e2e/full-app.spec.js`. Ce test ne simule
  pas Firebase : servi en local, le site parle quand même au vrai projet `love-ink`. Il a créé un compte
  `flow.<suffixe>@loveink-e2e.test`, publié une histoire de test et modifié des paramètres, puis a échoué à la
  déconnexion. Fixer `E2E_BASE_URL` sur localhost ne rend pas un test hermétique.
- **Classification** : incident de procédure (données de test écrites en production), sans impact utilisateur.
- **Résolution** : signalé à la propriétaire pour suppression manuelle du compte et de l'histoire de test ;
  aucune suppression faite sans son accord. Suite repassée en ne lançant que les specs hermétiques.
- **Prévention** : ne jamais lancer la suite e2e sans liste explicite de specs ; les specs hermétiques
  (`chapitres`, `publier-wizard`) se lancent par nom. Suivi proposé : faire sauter `full-app.spec.js` sauf
  opt-in explicite (`E2E_ALLOW_PROD=1`) pour que l'oubli du filtre ne puisse plus écrire en production.
