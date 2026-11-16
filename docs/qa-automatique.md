# QA automatique (E2E) — Love Ink

Date: 2026-03-31

## Objectif

Executer automatiquement un parcours global de l'application:
- garde d'authentification des pages privees
- inscription, connexion, deconnexion
- chargement feed
- publication d'histoire
- profil + parametres
- notifications
- messagerie temps reel entre 2 comptes (auto-skip si regles Firestore de l'environnement refusent la creation de conversation)
- verification des interfaces roles (optionnelle: modo/censeur)

## Prerequis

1. Node.js 18+
2. Dependances installees:
```bash
npm install
```
3. Navigateur Playwright (Chromium):
```bash
npm run test:e2e:install
```

## Lancer tous les tests

Les e2e creent des comptes et des histoires : ils tournent sur la Firebase Emulator Suite (Auth, Firestore,
Hosting) sous le projet `demo-love-ink`, sans aucune ressource reelle. Prerequis : Java 21 dans le PATH.

```bash
npm test            # = npm run test:e2e : demarre les emulateurs, lance Playwright, arrete tout
```

Sur un hote local (`localhost`, `127.0.0.1`), le client Firebase vise automatiquement les emulateurs. Pour
deboguer a la main : `npm run emulators`, puis `npx playwright test --headed` dans un autre terminal.

Viser un hote distant (prod, canal de previsualisation, staging du projet `love-ink`) cree de vrais comptes :
la configuration Playwright echoue immediatement sauf derogation explicite.

```bash
E2E_ALLOW_PROD=1 E2E_BASE_URL="https://votre-staging.web.app" npm run test:e2e:remote
```

Comptes de test deja crees en production : inventaire en lecture seule avec
`node scripts/e2e-prod-cleanup-plan.mjs` (voir `docs/engineering/lessons-learned.md`).

## Activer les tests roles (facultatif)

```bash
E2E_CENSEUR_EMAIL="censeur@example.com" \
E2E_CENSEUR_PASSWORD="xxxxx" \
E2E_MODO_EMAIL="modo@example.com" \
E2E_MODO_PASSWORD="xxxxx" \
npm test
```

Sans ces variables, les tests roles sont automatiquement ignores.

## Structure

- Config: `playwright.config.js`
- Helpers: `tests/e2e/helpers/app.js`
- Suite globale: `tests/e2e/full-app.spec.js`
- Smoke pages publiques/privees: `tests/e2e/smoke-pages.spec.js`
- Suite roles optionnelle: `tests/e2e/roles-optional.spec.js`

## Resultats

- Rapport HTML: `playwright-report/index.html`
- Traces/screen/videos: generes automatiquement sur echec.

## Couverture pratique

- `docs/qa-checklist.md`: checklist complete manuelle/QA.
- Les tests E2E automatisent les flux les plus critiques et repetables.
- Les scenarios sensibles metier (contenu moderation complexe, decisions humaines) restent a verifier avec la checklist manuelle.
