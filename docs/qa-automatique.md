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

```bash
npm test
```

## Cibler un autre environnement

```bash
E2E_BASE_URL="https://votre-staging.web.app" npm test
```

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
