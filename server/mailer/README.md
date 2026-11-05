# loveink-mailer

Service d'envoi des e-mails transactionnels (vérification d'adresse, réinitialisation de mot de passe)
aux couleurs Love Ink. Firebase Auth ne permet pas d'e-mails HTML personnalisés sur le plan Spark :
ce service génère les liens d'action avec l'Admin SDK et les envoie via Resend.

```
navigateur ──POST /v1/auth/verification (Bearer ID token)──▶ mailer ──▶ Resend ──▶ boîte mail
navigateur ──POST /v1/auth/password-reset {email}─────────▶ mailer      │
                                                                        └─ lien → APP_BASE_URL/auth-action.html
```

Le front (`js/core/mailer-client.js`) se replie sur `sendEmailVerification` / `sendPasswordResetEmail`
(e-mails texte Firebase) si le service est injoignable : aucune régression possible.

## Endpoints

| Méthode | Chemin | Auth | Effet |
|---|---|---|---|
| GET | `/healthz` | – | `{ ok: true }` |
| POST | `/v1/auth/verification` | `Authorization: Bearer <ID token>` ; body `{ pseudo? }` | e-mail de vérification à l'adresse du compte |
| POST | `/v1/auth/password-reset` | body `{ email }` | e-mail de réinitialisation si le compte existe ; réponse toujours `200` |
| GET | `/preview/verification`, `/preview/passwordReset` | `MAILER_PREVIEW=1` | rendu HTML du gabarit |

Limitation de débit : `RATE_MAX` demandes par `RATE_WINDOW_MS` (par uid, par IP et par adresse).

## Développement

```bash
cd server/mailer
npm install
cp .env.example .env            # renseigner RESEND_API_KEY, APP_BASE_URL=http://127.0.0.1:5178, MAILER_PREVIEW=1
export GOOGLE_APPLICATION_CREDENTIALS=/chemin/service-account.json
npm run preview                 # rend preview/*.html sans Firebase ni envoi
npm start                       # http://127.0.0.1:8787
```

Sans domaine vérifié chez Resend, `MAIL_FROM` doit être `onboarding@resend.dev` et seule l'adresse
du compte Resend reçoit les messages.

## Déploiement (VPS, Docker)

```bash
mkdir -p secrets && cp ~/firebase-service-account.json secrets/
cp .env.example .env            # valeurs de production
docker compose up -d --build
curl -s http://127.0.0.1:8787/healthz
```

Reverse proxy (exemple Caddy) :

```
mail.loveink.site {
    reverse_proxy 127.0.0.1:8787
}
```

Puis côté app : renseigner l'URL publique dans `js/core/mailer-client.js` (`MAILER_URL`) et, dans la
console Firebase → Authentication → Templates, mettre l'URL d'action sur `https://<app>/auth-action.html`
pour que les e-mails de repli Firebase ouvrent la même page.

## Compte de service Firebase

Console Firebase → Paramètres du projet → Comptes de service → « Générer une nouvelle clé privée ».
Le fichier reste hors dépôt (`secrets/` est ignoré) et n'est jamais journalisé.
