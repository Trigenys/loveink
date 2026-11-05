Parfait ! Voici un cahier des charges détaillé pour l'intégration des fonctionnalités avancées : messagerie fonctionnelle, notifications, profil complet avec options, et système de modération (modérateurs, censeurs, workflows de validation des histoires). Ce document servira de guide pour le développement futur.

---

📋 CAHIER DES CHARGES - LOVE INK

Extension fonctionnelle : Messagerie, Notifications, Profil avancé et Modération

---

🎯 1. OBJECTIFS GÉNÉRAUX

· Rendre la messagerie privée entièrement fonctionnelle (envoi, réception, conversations persistantes).
· Ajouter une cloche de notifications avec compteur en temps réel.
· Transformer la page profil en un hub complet avec sous-onglets fonctionnels (Paramètres, Mes histoires, etc.).
· Mettre en place un système de modération pour valider les histoires avant publication.
· Introduire des rôles : Modérateurs (modos) et Censeurs (avec pouvoirs spécifiques).
· Permettre aux auteurs de suivre l’état de leurs histoires (publiées, en révision, rejetées).

---

👥 2. RÔLES ET PERMISSIONS

2.1. Utilisateurs classiques

· Lecteurs : peuvent lire, commenter, liker, suivre des auteurs.
· Auteurs (peuvent publier) : leurs histoires passent par validation avant publication.

2.2. Modérateurs (Modos)

· Peuvent approuver ou rejeter des histoires.
· Peuvent éditer le contenu d’une histoire (correction mineure).
· Peuvent voir toutes les histoires en attente.
· Peuvent voir les statistiques des auteurs (nombre de rejets, etc.).
· N’ont pas le pouvoir de sanctionner les utilisateurs.

2.3. Censeurs (choisis parmi les modos)

· Tous les droits des modérateurs.
· Peuvent avertir un utilisateur (message privé + notification).
· Peuvent suspendre temporairement un utilisateur (bannissement).
· Peuvent bannir définitivement un utilisateur.
· Peuvent consulter l’historique des sanctions.

2.4. Administrateur

· Gère les promotions (modo → censeur).
· Accès à tous les logs.

---

📬 3. MESSAGERIE FONCTIONNELLE

3.1. Base de données Firestore

Collection conversations :

```js
{
    id: string,
    participants: [userId1, userId2],
    derniereActivite: timestamp,
    dernierMessage: string
}
```

Collection messages :

```js
{
    conversationId: string,
    expediteurId: string,
    contenu: string,
    date: timestamp,
    lu: boolean
}
```

3.2. Interface

· Page messagerie.html divisée en deux colonnes : liste des conversations et zone de chat.
· Les conversations s’affichent triées par date du dernier message.
· Un indicateur de non‑lu apparaît sur la conversation (badge) et dans la liste.
· Envoi de messages en temps réel (utilisation de onSnapshot de Firestore).
· Possibilité d’envoyer des messages à un auteur depuis sa page de profil (bouton "Envoyer un message").

---

🔔 4. SYSTÈME DE NOTIFICATIONS

4.1. Base de données Firestore

Collection notifications :

```js
{
    utilisateurId: string,
    type: 'commentaire' | 'like' | 'follow' | 'publication_approuvee' | 'rejet' | 'sanction',
    message: string,
    histoireId: string,        // optionnel
    lien: string,              // url de redirection
    lu: boolean,
    date: timestamp
}
```

4.2. Interface

· Icône de cloche dans la barre de navigation.
· Badge indiquant le nombre de notifications non lues.
· Clic → ouvre un panneau latéral ou une page dédiée notifications.html.
· Les notifications sont marquées comme lues au clic sur l’élément ou via un bouton "Tout marquer comme lu".
· Notifications en temps réel via onSnapshot sur la collection.

4.3. Déclencheurs

· Commentaire sur une histoire que l’on suit ou dont on est l’auteur.
· Like sur une histoire que l’on a publiée.
· Nouvel abonné.
· Publication approuvée / rejetée (avec raison).
· Sanction (avertissement, suspension) envoyée par un censeur.

---

👤 5. PROFIL UTILISATEUR COMPLET

5.1. Structure de la page profil.html

La page de profil devient un hub avec plusieurs sous‑onglets :

1. Mes histoires
   · Trois sous‑catégories :
     · Publiées
     · En cours de révision
     · Rejetées (avec motif affiché)
   · Pour les modérateurs/censeurs : apparaît également une vue des histoires en attente de validation.
2. Favoris
   · Histoires que l’utilisateur a ajoutées en favori.
3. Abonnements
   · Liste des auteurs suivis.
4. Paramètres
   · Modifier pseudo, bio, mot de passe, avatar (upload vers Firebase Storage).
   · Option pour supprimer son compte (après confirmation).
   · Notifications par email (optionnel).
   · Mode nuit (toggle).
   · Pour les modérateurs : section réservée avec des options de modération (accès au tableau de bord).
5. Notifications (on peut aussi avoir une page dédiée, mais l’onglet dans le profil redirige).
6. Pour les modérateurs et censeurs :
   · Onglet supplémentaire “Modération” :
     · Liste des histoires en attente de validation.
     · Boutons “Approuver” / “Rejeter” (avec champ pour motif).
     · Possibilité de modifier le texte avant approbation (éditeur).
     · Pour les censeurs : accès à la liste des utilisateurs signalés et possibilité d’avertir/suspendre/bannir.

5.2. Sous‑onglets fonctionnels

Chaque sous‑onglet doit avoir sa propre URL (hash ou query parameter) pour permettre le partage et le retour en arrière.

Exemple : profil.html?tab=mes-histoires&status=rejetees

---

🛡️ 6. SYSTÈME DE MODÉRATION DES HISTOIRES

6.1. Workflow de publication

1. L’auteur publie une histoire via publier.html.
2. L’histoire est enregistrée avec un champ statut = "en_attente".
3. L’histoire n’est pas visible dans le feed public.
4. Les modérateurs voient la liste des histoires en attente dans leur espace de modération.
5. Le modérateur peut :
   · Approuver : le statut passe à "publie", l’histoire apparaît dans le feed.
   · Rejeter : le statut passe à "rejete", un champ motifRejet est rempli, l’auteur reçoit une notification avec le motif.
   · Modifier : le modérateur peut éditer le texte avant d’approuver (une copie de l’original est conservée).
6. L’auteur peut consulter l’état de ses histoires dans son profil (onglet “Mes histoires” avec filtres).

6.2. Base de données

Ajout de champs dans la collection histoires :

```js
{
    // ... autres champs
    statut: "en_attente" | "publie" | "rejete",
    motifRejet: string | null,
    moderateurId: string | null,
    dateModeration: timestamp | null
}
```

6.3. Interface de modération

· Page ou onglet réservé aux modérateurs : liste paginée des histoires en attente.
· Chaque ligne : titre, auteur, date de soumission, boutons “Approuver”, “Rejeter”, “Modifier”.
· Un clic sur “Rejeter” ouvre une fenêtre modale pour saisir le motif.
· Un clic sur “Modifier” ouvre un éditeur (similaire à publier.html) pré‑rempli.

---

🚨 7. GESTION DES SANCTIONS (CENSEURS)

7.1. Base de données

Collection sanctions :

```js
{
    utilisateurId: string,
    type: "avertissement" | "suspension_temporaire" | "bannissement",
    motif: string,
    dateDebut: timestamp,
    dateFin: timestamp | null,   // pour suspension temporaire
    censeurId: string,
    actif: boolean
}
```

Collection utilisateurs enrichie :

```js
{
    // ... autres champs
    statut: "actif" | "suspendu" | "banni",
    suspensionJusqua: timestamp | null
}
```

7.2. Interface censeur

· Depuis la liste des utilisateurs (ou profil d’un auteur), bouton “Sanctionner”.
· Choix du type, saisie du motif.
· En cas de suspension, durée (heures/jours).
· Les utilisateurs bannis ne peuvent plus se connecter (authentification bloquée via règles Firestore et vérification dans auth.onAuthStateChanged).
· Les sanctions sont notifiées à l’utilisateur via une notification (cloche).

---

🔗 8. OPTION “DEVENIR MODÉRATEUR”

· Lien en bas de page : “Devenir modérateur” (visible par tous).
· Formulaire de candidature (pseudo, email, motivation) envoyé à l’administrateur (via Firestore).
· L’administrateur peut promouvoir un utilisateur en modérateur via la console Firebase (modification du champ role dans la collection utilisateurs).

Ajout du champ role dans utilisateurs :

```js
{
    // ...
    role: "user" | "moderateur" | "censeur"
}
```

---

📱 9. MISE EN ŒUVRE TECHNIQUE

9.1. Mises à jour des pages

· messagerie.html : utilisation des listeners Firestore pour l’affichage des conversations.
· profil.html : restructuration en onglets, chargement dynamique selon le rôle.
· publier.html : enregistrement avec statut = "en_attente".
· feed.html : afficher uniquement les histoires avec statut = "publie".
· histoire.html : vérifier que l’histoire est publiée avant affichage (redirection si en attente/rejetée).

9.2. Règles Firestore (sécurité)

· Seuls les modérateurs et censeurs peuvent lire/écrire dans la collection histoires pour les documents en attente.
· Les sanctions ne sont modifiables que par les censeurs.
· Les notifications sont en lecture seule par l’utilisateur ciblé.

9.3. Gestion de l’état en ligne

· Pour les utilisateurs connectés, on peut utiliser un champ enLigne: true mis à jour dans Firestore avec onDisconnect (Firestore ne supporte pas directement, on peut utiliser Cloud Functions ou une simple présence via la session).

---

🗺️ 10. ROADMAP DE DÉVELOPPEMENT

Étape Description Durée estimée
1 Mise en place de la messagerie fonctionnelle (Firestore, UI, temps réel) 2 jours
2 Notifications (création des triggers, UI cloche, badge) 1 jour
3 Refonte de la page profil avec tous les onglets 1 jour
4 Système de modération : workflow des histoires, interface modérateur 2 jours
5 Gestion des sanctions (censeurs) 1 jour
6 Option “Devenir modérateur” et promotion 0.5 jour
7 Tests d’intégration et corrections 1 jour

---

✅ 11. LIVRABLES

· Code source complet (fichiers HTML/JS/CSS) mis à jour.
· Documentation des nouvelles collections Firestore et règles de sécurité.
· Fichiers de configuration Firebase à jour.
· Guide pour l’administrateur : gestion des rôles, modération.

---

📌 12. REMARQUES

· Toutes les nouvelles fonctionnalités doivent respecter la charte graphique existante.
· Les interfaces modérateurs/censeurs doivent être intuitives et s’intégrer harmonieusement dans l’existant.
· Le système de messagerie doit être léger et ne pas surcharger Firestore (optimisation des requêtes).