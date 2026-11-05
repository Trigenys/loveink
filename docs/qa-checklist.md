# QA Checklist — Love Ink

Date: 2026-03-31
Reference: `docs/scope.md`, `docs/pert.md` (T1–T17)

Cocher chaque item après vérification manuelle ou test en conditions réelles (émulateur Firebase ou projet Firebase de staging).

---

## 1. Auth & Session

- [ ] Inscription email/mot de passe réussie → redirection feed
- [ ] Connexion email/mot de passe réussie
- [ ] Connexion Google (OAuth) réussie
- [ ] Déconnexion effective sur toutes les pages privées → redirection `index.html`
- [ ] Accès direct à une page privée sans session → redirection `index.html`
- [ ] Session persistée après rechargement de page (pas de flash de redirection)
- [ ] `requireAuth` appelé sur toutes les pages privées : `feed`, `profil`, `histoire`, `publier`, `messagerie`, `notifications`, `parametres`, `candidature-modo`

---

## 2. Feed & Histoires

- [ ] Feed affiche uniquement les histoires `statut == publie`
- [ ] Filtre par catégorie fonctionne
- [ ] Recherche par titre fonctionne (côté client)
- [ ] Pagination correcte (bouton "Suivant")
- [ ] Clic sur une histoire → `histoire.html?id=<id>` correct

---

## 3. Lecture histoire

- [ ] Histoire publiée visible par tous les utilisateurs connectés
- [ ] Histoire `en_attente` → visible uniquement par l'auteur et les modos
- [ ] Histoire `rejete` → visible uniquement par l'auteur (avec bannière rouge + motif)
- [ ] Histoire `en_attente` → bannière orange visible pour l'auteur
- [ ] Modo peut accéder à toute histoire via `?preview` (bannière informative)
- [ ] Like toggle fonctionne (compteur mis à jour, bouton change d'état)
- [ ] Double like impossible (idempotent)
- [ ] Ajout commentaire → apparaît dans la liste + compteur incrémenté
- [ ] Commentaire vide refusé

---

## 4. Publication

- [ ] Formulaire publier → histoire créée avec `statut = en_attente`
- [ ] Redirection vers `profil.html?tab=histoires&status=en_attente` après publication
- [ ] Validation côté client : titre, catégorie, contenu obligatoires
- [ ] Utilisateur suspendu/banni ne peut pas publier (règle Firestore)

---

## 5. Profil

- [ ] Onglets URL params (`?tab=histoires`, `?tab=apropos`, `?tab=abonnements`, `?tab=moderation`) fonctionnels
- [ ] Filtre histoires par statut (`?status=publie`, `en_attente`, `rejete`) fonctionnel
- [ ] Compteurs abonnés/histoires affichés correctement
- [ ] Abonnement/désabonnement fonctionnel depuis profil tiers
- [ ] Bouton "Envoyer un message" redirige vers `messagerie.html?with=<uid>`
- [ ] Onglet Modération affiché uniquement pour `moderateur` et `censeur`
- [ ] Onglet Ops Censeur affiché uniquement pour `censeur`

---

## 6. Modération (T7, T8, T15)

- [ ] Liste des histoires `en_attente` visible pour les modos
- [ ] Approuver → `statut` passe à `publie`, histoire visible dans le feed
- [ ] Rejeter → modal motif → `statut` passe à `rejete`, motif enregistré
- [ ] Lien "Modifier avant approbation" → `publier.html?edit=<id>` accessible aux modos
- [ ] Édition modération → `versionOriginale` conservé à la première édition
- [ ] Édition + "Enregistrer et approuver" → publie directement
- [ ] Règle Firestore bloque l'édition si `statut != en_attente`
- [ ] L'auteur ne peut pas modifier `statut` via son propre update

---

## 7. Sanctions (T9)

- [ ] Bouton "Sanctionner" visible uniquement pour les censeurs
- [ ] Création sanction → document dans `sanctions/`, `statut` utilisateur mis à jour
- [ ] Utilisateur suspendu : lecture OK, écriture bloquée (`isActif()` = false)
- [ ] Désactivation sanction → `actif` passe à `false`
- [ ] Historique sanctions visible dans le profil (auteur ou censeur)

---

## 8. Candidature modérateur (T10)

- [ ] Lien "Devenir modérateur" visible dans le footer (feed, profil)
- [ ] Formulaire candidature → document écrit dans `candidatures_moderateur`
- [ ] État succès affiché après soumission (pas de double soumission)
- [ ] Censeur voit les candidatures dans l'onglet Ops
- [ ] Approuver candidature → `promouvoirUtilisateurRole(uid, 'moderateur')` → role mis à jour
- [ ] Refuser candidature → statut `refusee` enregistré

---

## 9. Messagerie (T2, T3)

- [ ] Liste conversations vide si aucune conversation
- [ ] Ouverture depuis `messagerie.html?with=<uid>` → conversation créée ou récupérée, ouverte
- [ ] Envoi message → apparaît instantanément côté expéditeur
- [ ] Temps réel : message envoyé dans un onglet apparaît dans l'autre sans rechargement
- [ ] Badge non-lu (dot rouge) visible sur la conversation quand le dernier message n'est pas de soi
- [ ] Badge disparaît à l'ouverture de la conversation (`marquerMessagesLus`)
- [ ] Listener messages nettoyé au changement de conversation
- [ ] Listener conversations nettoyé au `beforeunload`

---

## 10. Notifications (T4, T5)

- [ ] Badge cloche dans la navbar reflète le nombre de notifications non lues (temps réel)
- [ ] Page `notifications.html` liste les notifications dérivées (commentaires, likes, abonnements, modération)
- [ ] Marquer comme lu → badge décrémenté
- [ ] Marquer tout comme lu → badge = 0

---

## 11. Paramètres (T13)

- [ ] Modification pseudo → mis à jour dans Firestore + `displayName` Firebase Auth + navbar
- [ ] Bio sauvegardée correctement
- [ ] Mode nuit toggle → appliqué immédiatement + persisté (localStorage)
- [ ] Mode nuit appliqué avant le premier paint (pas de flash)
- [ ] Changement mot de passe : champ mot de passe actuel vérifié (`reauthenticateWithCredential`)
- [ ] Champ mot de passe actuel requis incorrect → message d'erreur clair
- [ ] Suppression de compte : confirmation modale → ré-authentification → cleanup Firestore → `deleteUser`
- [ ] Après suppression → redirection `index.html?compte=supprime`
- [ ] Compte Google : section mot de passe désactivée, ré-auth via popup Google pour la suppression

---

## 12. Présence (T14)

- [ ] `enLigne = true` dans Firestore dans les 5 s après connexion
- [ ] Heartbeat toutes les 45 s (vérifiable via les timestamps dans Firestore)
- [ ] `enLigne = false` + `lastSeen` posé après fermeture/navigation (`pagehide`)
- [ ] `enLigne = false` posé au logout

---

## 13. Robustesse & Sécurité

- [ ] Aucune erreur console bloquante sur toutes les pages
- [ ] Aucun lien interne cassé
- [ ] Toutes les sorties utilisateur passent par `escapeHtml` (pas d'XSS)
- [ ] Écriture Firestore refusée pour utilisateur non authentifié (tester en console)
- [ ] Écriture Firestore refusée si rôle insuffisant (tester avec compte `user` sur endpoints modo)
- [ ] `isActif()` bloque les écritures pour les comptes suspendus/bannis

---

## 14. Déploiement

- [ ] `npm run deploy:firestore` (rules + indexes) → OK
- [ ] `npm run deploy:hosting` → OK
- [ ] `.firebaserc` pointe vers le bon projet (`love-ink`)
- [ ] Headers de sécurité HTTP présents (`firebase.json`)
- [ ] Workflow GitHub Actions deploy passe sur `main`

---

## Légende statuts

| Symbole | Signification |
|---|---|
| `[ ]` | Non testé |
| `[x]` | Validé |
| `[~]` | Partiel / à surveiller |
| `[!]` | Bug trouvé — voir `tasks/todo.md` |
