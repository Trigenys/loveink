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
