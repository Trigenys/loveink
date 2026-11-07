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
