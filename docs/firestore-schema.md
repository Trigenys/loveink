# Firestore Schema — Love Ink

Date: 2026-03-31 (synchronise avec le code)
Reference: `firestore.rules`, `firestore.indexes.json`, `js/core/firebase-data.js`

---

## Collections

### `utilisateurs/{uid}`

| Champ | Type | Notes |
|---|---|---|
| `uid` | string | = document ID (auth uid) |
| `pseudo` | string | 1–40 chars, obligatoire |
| `email` | string | email de connexion |
| `bio` | string | ≤ 600 chars, optionnel |
| `aPropos` | string | ≤ 4 000 chars, optionnel |
| `genres` | string | ≤ 300 chars, optionnel |
| `avatar` | string\|null | URL ou null (Storage Blaze / initiales en mode Spark) |
| `type` | string | `lecteur` \| `auteur` \| `lesdeux` |
| `role` | string | `user` (défaut) \| `moderateur` \| `censeur`. Seul un censeur peut modifier ce champ via `promouvoirUtilisateurRole`. |
| `statut` | string | `actif` (défaut) \| `suspendu` \| `banni`. Positionné par un censeur via `creerSanction`. |
| `suspensionJusqua` | timestamp\|null | Fin de suspension temporaire. |
| `dateInscription` | timestamp | Posé à la création. |
| `preferences` | map | `{ emailNotifications: bool, darkMode: bool }` |
| `enLigne` | bool | Présence temps réel (heartbeat 45 s). |
| `lastHeartbeat` | timestamp | Dernière écriture heartbeat. |
| `lastSeen` | timestamp | Posé au déconnect/pagehide. |
| `presenceSessionId` | string | UUID de session courante. |
| `presencePage` | string | Pathname de la page active, ≤ 120 chars. |
| `roleUpdatedBy` | string | UID du censeur ayant promu. |
| `dateRoleUpdate` | timestamp | Date de la promotion. |
| `updatedAt` | timestamp | Dernière mise à jour profil. |

**Règles Firestore :**
- Lecture : tout utilisateur connecté.
- Création : propriétaire uniquement, `role` forcé à `user`, `statut` forcé à `actif`.
- Mise à jour : propriétaire (ne peut pas toucher `role`, `statut`, `suspensionJusqua`). Champs présence autorisés en update.
- Suppression : interdite.

---

### `histoires/{histoireId}`

| Champ | Type | Notes |
|---|---|---|
| `titre` | string | 1–140 chars |
| `auteur` | string | Pseudo snapshot à la publication |
| `auteurId` | string | UID de l'auteur |
| `categorie` | string | 1–80 chars |
| `contenu` | string | 1–200 000 chars |
| `extrait` | string | 150 premiers chars + "..." |
| `image` | string | URL image de couverture par catégorie |
| `date` | timestamp | Date de soumission |
| `likes` | number | ≥ 0, incrémenté côté client |
| `commentaires` | number | ≥ 0, incrémenté côté client |
| `statut` | string | `en_attente` (défaut) \| `publie` \| `rejete` |
| `motifRejet` | string\|null | ≤ 1 000 chars, posé par un modo |
| `moderateurId` | string | UID du modérateur ayant agi |
| `dateModeration` | timestamp | Date de la décision |
| `dateEditionModeration` | timestamp | Date de l'édition éditoriale (T15) |
| `versionOriginale` | map\|null | Snapshot avant première édition modo : `{ titre, categorie, contenu, extrait, image, dateSoumission, captureParModerationLe }` |

**Règles Firestore :**
- Lecture : histoires publiées (ou sans statut) = publiques. L'auteur lit toujours ses propres histoires. Les modos lisent tout.
- Création : utilisateur connecté + actif, `statut` initialisé à `en_attente` ou `publie`, `likes`/`commentaires` à 0.
- Mise à jour (auteur) : ne peut pas modifier `statut`, `motifRejet`, `moderateurId`, `dateModeration`.
- Mise à jour (contador) : uniquement `likes` ±1 ou `commentaires` +1 (fonction `storyCountersOnly`).
- Mise à jour (modo) : uniquement `statut`/`motifRejet`/`moderateurId`/`dateModeration` (approbation/rejet).
- Mise à jour éditoriale (modo) : champs contenu + champs modération + `versionOriginale`, uniquement si `statut == en_attente`.
- Suppression : auteur uniquement.

---

### `commentaires/{commentaireId}`

| Champ | Type | Notes |
|---|---|---|
| `histoireId` | string | Référence à l'histoire |
| `auteur` | string | Pseudo snapshot |
| `auteurId` | string | UID de l'auteur |
| `contenu` | string | 1–2 000 chars |
| `date` | timestamp | |

**Règles :** Lecture publique. Création : connecté + actif. Update/delete : auteur uniquement.

---

### `likes/{histoireId}_{userId}`

| Champ | Type | Notes |
|---|---|---|
| `histoireId` | string | |
| `userId` | string | UID |
| `date` | timestamp | |

**ID composé :** `{histoireId}_{userId}` — garantit l'unicité par paire.
**Règles :** Création et suppression par l'utilisateur propriétaire uniquement. Pas de mise à jour.

---

### `abonnements/{abonneId}_{auteurId}`

| Champ | Type | Notes |
|---|---|---|
| `abonneId` | string | UID abonné |
| `auteurId` | string | UID auteur suivi |
| `date` | timestamp | |

**ID composé :** `{abonneId}_{auteurId}`.
**Règles :** Création et suppression par l'abonné. Pas de mise à jour.

---

### `notifications/{notificationId}`

| Champ | Type | Notes |
|---|---|---|
| `utilisateurId` | string | UID destinataire |
| `type` | string | `system` \| `info` \| `warning` \| `commentaire` \| `follow` \| `like` \| `publication` \| `publication_approuvee` \| `rejet` \| `sanction` |
| `message` | string | 1–280 chars |
| `histoireId` | string\|null | Référence optionnelle |
| `lu` | bool | `false` à la création |
| `date` | timestamp | |

**Règles :** Lecture réservée au destinataire. Création par l'émetteur (son propre UID uniquement — les notifs cross-user passent par Cloud Functions ou sont dérivées côté app). Mise à jour : uniquement `lu` (bool) par le destinataire. Suppression : interdite.

> **Note mode Spark :** En l'absence de Cloud Functions actives, les notifications sont dérivées côté client à partir des collections existantes (histoires, commentaires, likes, abonnements, sanctions). Le badge en temps réel utilise `onSnapshot` sur les notifications `lu == false`.

---

### `conversations/{conversationId}`

| Champ | Type | Notes |
|---|---|---|
| `participants` | array\<string\> | 2 UIDs |
| `dernierMessage` | string | Extrait du dernier message |
| `derniereActivite` | timestamp | Mis à jour à chaque envoi |
| `expediteurDernierMessage` | string | UID expéditeur — permet le badge non-lu sans query messages |

**Règles :** Lecture/écriture réservées aux participants.

---

### `messages/{messageId}`

| Champ | Type | Notes |
|---|---|---|
| `conversationId` | string | |
| `participants` | array\<string\> | Copie pour les règles (array-contains) |
| `expediteurId` | string | UID expéditeur |
| `contenu` | string | |
| `date` | timestamp | |
| `lu` | bool | `false` → `true` par le destinataire |

**Règles :** Lecture par participants. Création par expéditeur actif. Mise à jour (`lu` uniquement) par le destinataire.

---

### `sanctions/{sanctionId}`

| Champ | Type | Notes |
|---|---|---|
| `utilisateurId` | string | UID sanctionné |
| `type` | string | `avertissement` \| `suspension_temporaire` \| `bannissement` |
| `motif` | string | 1–500 chars |
| `censeurId` | string | UID du censeur |
| `dateDebut` | timestamp | |
| `dateFin` | timestamp\|null | Null pour bannissement permanent |
| `actif` | bool | `true` à la création, peut être désactivé |

**Règles :** Lecture : censeur ou utilisateur concerné. Création : censeur uniquement. Mise à jour : uniquement `actif` (bool) par un censeur.

---

### `candidatures_moderateur/{docId}`

| Champ | Type | Notes |
|---|---|---|
| `userId` | string | UID candidat |
| `pseudo` | string | Snapshot |
| `email` | string | |
| `motivation` | string | ≤ 2 000 chars |
| `date` | timestamp | |
| `statut` | string | `en_attente` \| `approuvee` \| `refusee` |
| `dateTraitement` | timestamp | Posé par le censeur lors du traitement |
| `promotionRole` | string\|null | Rôle accordé si approuvée |

**Règles :** Création par tout utilisateur connecté + actif. Lecture/update/delete : interdits côté client (traitement exclusivement par censeur via `getCandidaturesModerateur` + `traiteCandidatureModerateur`).

---

### `ops_logs/{logId}` *(collection technique)*

| Champ | Type | Notes |
|---|---|---|
| `acteurId` | string | UID du censeur ayant effectué l'action |
| `action` | string | `role_promotion` \| `candidature_approuvee` \| `candidature_refusee` \| `sanction_creee` \| `sanction_desactivee` |
| `message` | string | Description lisible |
| `date` | timestamp | |
| `metadata` | map | Données contextuelles (UID cible, ancien/nouveau rôle, etc.) |

---

## Index composites (firestore.indexes.json)

| Collection | Champs | Ordre |
|---|---|---|
| `commentaires` | `histoireId` ASC, `date` ASC | — |
| `notifications` | `utilisateurId` ASC, `date` DESC | — |
| `notifications` | `utilisateurId` ASC, `lu` ASC | — |
| `likes` | `histoireId` ASC, `userId` ASC | — |
| `abonnements` | `abonneId` ASC, `auteurId` ASC | — |
| `histoires` | `statut` ASC, `date` DESC | Feed principal |
| `histoires` | `statut` ASC, `date` ASC | — |
| `histoires` | `statut` ASC, `categorie` ASC, `date` DESC | Filtre catégorie |
| `histoires` | `auteurId` ASC, `date` DESC | Histoires auteur |
| `histoires` | `auteurId` ASC, `statut` ASC, `date` DESC | Histoires auteur par statut |
| `sanctions` | `utilisateurId` ASC, `actif` ASC | — |
| `conversations` | `participants` ARRAY_CONTAINS, `derniereActivite` DESC | — |
| `messages` | `conversationId` ASC, `date` ASC | — |

---

## Notes techniques

- **Compteurs `likes`/`commentaires`** : incrémentés côté client avec protection Firestore (`storyCountersOnly`). En production à forte charge, migrer vers Cloud Functions avec `FieldValue.increment`.
- **Présence** : heartbeat toutes les 45 s, grace window de 105 s. Pas de cleanup serveur (mode Spark) — l'état `enLigne` peut rester `true` jusqu'à 105 s après une déconnexion brutale.
- **Notifications cross-user** : en mode Spark, les notifications vers d'autres utilisateurs sont dérivées côté app. Pour des notifications fiables en production, activer les Cloud Functions (plan Blaze).
- **Storage avatars** : désactivé en mode Spark. Activable sur plan Blaze avec upload vers `avatars/{uid}/avatar.{ext}` (max 2 MB).
