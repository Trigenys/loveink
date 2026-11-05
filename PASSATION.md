
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
