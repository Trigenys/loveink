# Runbook Admin — Love Ink

Date: 2026-03-31
Audience: censeurs, administrateurs Firebase, développeurs de garde

---

## 1. Accès et prérequis

### Firebase Console
- Projet : `love-ink`
- Console : https://console.firebase.google.com/project/love-ink
- Auth, Firestore, Hosting accessibles depuis la console.

### CLI Firebase
```bash
npm install -g firebase-tools
firebase login
firebase use love-ink
```

### Déploiements
```bash
# Règles + index Firestore uniquement
npm run deploy:firestore

# Hosting uniquement
npm run deploy:hosting

# Tout (hosting + firestore)
firebase deploy
```

---

## 2. Rôles utilisateurs

| Rôle | Valeur `role` | Droits |
|---|---|---|
| Utilisateur standard | `user` | Lecture feed, publication, commentaires, messagerie |
| Modérateur | `moderateur` | + Lecture toutes histoires, approbation/rejet, édition éditoriale |
| Censeur | `censeur` | + Sanctions, promotion rôles, candidatures, journal ops |

### Promouvoir un utilisateur

**Via l'interface :** Onglet "Ops Censeur" dans `profil.html` (réservé aux censeurs).

**Via la console Firestore** (intervention d'urgence uniquement) :
1. Aller dans `utilisateurs/{uid}`
2. Modifier le champ `role` : `user` → `moderateur` ou `moderateur` → `censeur`
3. Ajouter `roleUpdatedBy: "<uid-censeur>"` et `dateRoleUpdate: <timestamp>`

> Transitions autorisées : `user → moderateur`, `moderateur → censeur`. Rétrograder un rôle n'est possible que via la console Firebase directement (pas d'interface UI pour la rétrogradation).

### Premier censeur

Le tout premier compte censeur doit être promu manuellement via la console Firebase (pas encore de censeur pour le promouvoir) :
1. Créer un compte via `index.html` (email/mdp)
2. Dans Firestore console : `utilisateurs/{uid}` → modifier `role` → `censeur`

---

## 3. Sanctions

### Créer une sanction (interface)
1. Se connecter avec un compte `censeur`
2. Ouvrir le profil de l'utilisateur cible
3. Bouton "Sanctionner" → remplir le formulaire (type + motif + durée)

### Types de sanctions

| Type | Effet | `dateFin` |
|---|---|---|
| `avertissement` | Notification, pas de blocage | `null` |
| `suspension_temporaire` | Bloque les écritures pendant la durée | timestamp de fin |
| `bannissement` | Bloque toutes les écritures indéfiniment | `null` |

### Désactiver une sanction
1. Onglet Ops Censeur → section "Historique sanctions"
2. Bouton "Désactiver" → `actif` passe à `false`
3. Penser à remettre manuellement `statut: "actif"` sur le document utilisateur si nécessaire (la désactivation de sanction ne le fait pas automatiquement — voir dette technique ci-dessous).

### Via console Firebase (urgence)
- `sanctions/{id}` → `actif: false`
- `utilisateurs/{uid}` → `statut: "actif"`, supprimer `suspensionJusqua` si présent

---

## 4. Modération des histoires

### Flux normal
1. Auteur publie → `statut: en_attente`
2. Modérateur voit l'histoire dans l'onglet Modération de son profil
3. Options : **Approuver** (`statut → publie`) / **Rejeter** (motif requis, `statut → rejete`) / **Modifier** (`publier.html?edit=<id>`)
4. L'auteur voit le statut de ses histoires dans `profil.html?tab=histoires`

### Édition éditoriale (T15)
- Accessible via `publier.html?edit=<id>` (modo uniquement)
- La `versionOriginale` est capturée automatiquement à la première édition
- Option "Enregistrer et approuver" publie directement

### Débloquer une histoire bloquée (console)
Si une histoire est coincée dans `en_attente` sans modérateur disponible :
1. Console Firestore → `histoires/{id}`
2. Modifier `statut: "publie"`, ajouter `moderateurId: "admin"`, `dateModeration: <now>`

---

## 5. Candidatures modérateur

### Flux
1. Utilisateur soumet depuis `candidature-modo.html`
2. Document créé dans `candidatures_moderateur` avec `statut: en_attente`
3. Censeur traite depuis l'onglet Ops Censeur de son profil
4. Approuver → `promouvoirUtilisateurRole(uid, 'moderateur')` + `statut: approuvee`
5. Refuser → `statut: refusee` (aucun changement de rôle)

### Consulter les candidatures (console)
Collection `candidatures_moderateur`, filtrer `statut == en_attente`.

---

## 6. Journal ops

Chaque action censeur (promotion, sanction, candidature) génère un document dans `ops_logs` :
- `action` : type d'action
- `acteurId` : UID du censeur
- `message` : description lisible
- `metadata` : données contextuelles
- `date` : timestamp

Consultable depuis l'onglet Ops Censeur (section "Journal ops") ou directement dans la console Firestore.

---

## 7. Présence utilisateurs

- `enLigne: true` dans `utilisateurs/{uid}` = actif dans les 105 dernières secondes
- `lastSeen` = dernière déconnexion propre
- En mode Spark : pas de cleanup serveur. Un heartbeat manqué (crash navigateur) peut laisser `enLigne: true` jusqu'à 105 s.
- Pour réinitialiser manuellement : console Firebase → `utilisateurs/{uid}` → `enLigne: false`

---

## 8. Firestore — Limites et quotas (mode Spark)

| Limite | Valeur |
|---|---|
| Lectures/jour | 50 000 |
| Écritures/jour | 20 000 |
| Suppressions/jour | 20 000 |
| Stockage | 1 GiB |

> En cas d'approche des limites : désactiver temporairement le heartbeat (commenter `startUserPresence` dans `auth-session.js`) — c'est la principale source d'écritures répétées.

---

## 9. Dette technique connue

| Priorité | Description | Fichier |
|---|---|---|
| P1 | Désactivation sanction ne remet pas automatiquement `statut: actif` sur l'utilisateur | `profil.html`, `firebase-data.js` |
| P2 | Badge cloche notifications pas visible en permanence dans la navbar principale | `nav-component.js` |
| P3 | Compteurs `likes`/`commentaires` incrémentés côté client (pas atomic en cas de concurrence) | `firebase-data.js` |
| P4 | Notifications cross-user non fiables sans Cloud Functions (mode Spark) | `firebase-data.js` |
| P5 | Pas de cleanup serveur pour `enLigne` en cas de crash navigateur | `presence.js` |

---

## 10. Déploiement initial (premier setup)

```bash
# 1. Cloner le dépôt
git clone <repo-url>
cd loveink

# 2. Installer les dépendances (pour les scripts npm)
npm install

# 3. Configurer le projet Firebase
firebase use love-ink   # ou firebase use --add pour ajouter le projet

# 4. Déployer les règles et indexes Firestore
npm run deploy:firestore

# 5. Déployer le hosting
npm run deploy:hosting

# 6. Créer le premier compte censeur
# → Inscription via index.html
# → Console Firebase : utilisateurs/{uid} → role: "censeur"
```
