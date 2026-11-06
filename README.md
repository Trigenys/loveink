# Love Ink

Application web statique (HTML/CSS/JS) avec Firebase Auth + Firestore + Firebase Hosting.

## Prerequis
- Node.js 18+
- Compte Firebase avec projet `love-ink`

## Installation et verification
```bash
npm install
npx firebase-tools --version
npm run test:e2e:install
```

## Configuration Firebase
Le projet est deja configure avec:
- `firebase.json`
- `.firebaserc` (projet par defaut `love-ink`)
- `firestore.rules`
- `firestore.indexes.json`

## Deploiement manuel
```bash
npm run firebase:login
npm run deploy:firestore
npm run deploy:hosting
```

ou en une seule commande:
```bash
npm run deploy
```

## Mode Spark (sans Blaze)
- Le projet est configure pour fonctionner sans Cloud Functions.
- `npm run deploy:functions` est desactive et affiche un message informatif.
- `npm run deploy:storage` est desactive (Storage non deploye en mode gratuit).
- Les notifications sont agregees cote client a partir de Firestore (commentaires, likes, follows, moderation, sanctions).
- L'avatar utilise un rendu par initiales (sans Firebase Storage).
- La presence en ligne est geree cote client via heartbeat Firestore (`enLigne`, `lastHeartbeat`, `lastSeen`).

## CI/CD (GitHub Actions)
Workflow: `.github/workflows/firebase-deploy.yml`

Secret requis:
- `FIREBASE_TOKEN` (genere via `firebase login:ci`)

## Commandes utiles
```bash
npm run emulators
npm run deploy:backend
npm run test
npm run test:e2e:headed
npm run test:e2e:ui
```

## Tests des regles Firestore (emulateur)

Prerequis : Java 11+ dans le PATH (ex. `winget install EclipseAdoptium.Temurin.21.JRE`).

```bash
npm run test:rules
```

A lancer avant tout `deploy:firestore` : chaque faille corrigee a un test d'attaque dans `tests/rules/`.

## Tests automatiques E2E (Playwright)

Par defaut, les tests tournent contre `https://loveink.site`.

```bash
npm test
```

Pour cibler un autre environnement:

```bash
E2E_BASE_URL="https://votre-staging.web.app" npm test
```

Tests de roles (optionnels) avec comptes existants:

```bash
E2E_CENSEUR_EMAIL="censeur@example.com" \
E2E_CENSEUR_PASSWORD="xxxxx" \
E2E_MODO_EMAIL="modo@example.com" \
E2E_MODO_PASSWORD="xxxxx" \
npm test
```

Notes:
- Le suite principale cree des comptes e2e temporaires via l'inscription UI.
- Les tests roles sont ignores tant que les variables `E2E_*` ne sont pas definies.
- Rapport HTML genere dans `playwright-report/`.

## Notes
- Les pages privees utilisent `onAuthStateChanged` pour la protection de session.
- Le feed et la lecture d'histoire sont relies a Firestore via `firebaseAPI`.
