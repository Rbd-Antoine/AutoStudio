# Mise en ligne d'AutoStudio

Ce document dit tout ce qu'il faut régler pour que le site soit entièrement opérationnel, et
comment le vérifier. Tout se fait dans les tableaux de bord de Vercel, Prisma, Resend, Google Cloud
et Stripe : **aucune modification de code n'est nécessaire**.

## Pour Claude

1. Mettre le dépôt à jour : `git checkout main && git pull`.
2. Lancer `npx tsx scripts/check-production.ts https://<domaine>`. Chaque ligne `ÉCHEC` ou
   `À VOIR` indique l'action à faire.
3. Guider la personne pas à pas, dans l'ordre des sections ci-dessous, **seulement pour ce qui
   échoue**. Relancer le script après chaque étape pour confirmer.
4. Une fois tout au vert, lancer une fois le script avec `--email` : il envoie un seul message de
   test via le formulaire de contact, vers l'adresse de contact.
5. Ne jamais afficher, recopier dans une conversation ni committer une valeur secrète (clés API,
   secrets Stripe, `AUTH_SECRET`, `DATABASE_URL`).

`https://<domaine>/api/health` indique aussi, sans jamais montrer de valeur, le commit en ligne, la
valeur de `NEXTAUTH_URL`, le modèle d'image utilisé et les variables d'environnement absentes.

## 1. Base de données (Prisma Postgres)

1. Dans la console Prisma (console.prisma.io), créer la base de **production**, distincte de celle
   des tests. Récupérer deux adresses : la connexion **pooled** (`pooled.db.prisma.io`) pour le
   site, la connexion **directe** (`db.prisma.io`) pour les migrations.
2. Créer les tables, une fois, depuis un poste qui a le dépôt à jour :

   ```bash
   DATABASE_URL="<connexion directe de production>" npx prisma migrate deploy
   DATABASE_URL="<connexion directe de production>" npx prisma db seed
   ```

   Le seed écrit les prix (`PricingConfig`), les coûts en crédits (`AiFeature`) et les styles.
3. Ensuite, chaque commit qui ajoute un dossier dans `prisma/migrations` demande de relancer
   `migrate deploy` (pas le seed) **avant** de déployer ce commit. `migrate deploy` n'applique que
   les migrations manquantes et ne supprime rien.
4. Ne jamais lancer `prisma migrate dev`, `migrate reset` ni `db push` sur la production. En local,
   `npx tsx scripts/local-db.ts` fait tout cela sur la base de la machine et refuse toute autre.

## 2. Vercel

### Projet et stockage

1. Importer le dépôt dans Vercel (preset Next.js). Branche de production : `main`.
2. Storage : créer un store **Blob** et le relier au projet (bouton Connect Project, qui crée
   `BLOB_READ_WRITE_TOKEN`). Sans lui, les rendus sont stockés en data URI dans la base.
3. Les quatre tâches planifiées de `vercel.json` (purge des rendus, crédits gratuits, relances)
   tournent une fois par jour : rien à faire, sinon définir `CRON_SECRET`.

### Variables d'environnement

Settings, Environment Variables, environnement **Production**. Toute modification ne s'applique
qu'au déploiement suivant : finir par **Redeploy**. **Ne pas recopier le `.env` local** : il vise
la base de test et contient `DEV_AUTH_BYPASS`.

| Variable | Valeur ou origine |
|---|---|
| `DATABASE_URL` | Connexion **pooled** de la base de production (section 1). |
| `AUTH_SECRET` | Nouvelle valeur aléatoire (`npx auth secret` ou `openssl rand -base64 32`). Elle signe les sessions et les liens de désinscription des emails : ne plus jamais la changer ensuite. |
| `NEXTAUTH_URL` | `https://<domaine>`, sans `www` ni barre finale. Jamais `http://localhost:3000`. |
| `NEXT_PUBLIC_SITE_URL` | La même adresse : liens des emails, sitemap, adresses canoniques. |
| `GEMINI_API_KEY` | Google AI Studio, aistudio.google.com/apikey, sur un projet avec facturation. |
| `RESEND_API_KEY` | Resend, API Keys, clé du **même compte** que celui où le domaine est ajouté. |
| `EMAIL_FROM` | `AutoStudio <noreply@<domaine>>`, une adresse du domaine vérifié dans Resend. Sans elle, les emails ne partent que vers le propriétaire du compte Resend. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Adresse de contact affichée sur les pages légales, réponse des emails, boîte du formulaire. |
| `STRIPE_SECRET_KEY` | Stripe, mode production, Développeurs, Clés API : `sk_live_…`. |
| `STRIPE_WEBHOOK_SECRET` | Stripe, Développeurs, Webhooks, l'endpoint du site : `whsec_…` (section 5). |
| `STRIPE_PRICE_ESSENTIAL`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS` | Identifiant `price_…` du prix mensuel récurrent de chaque abonnement. |
| `STRIPE_PRICE_PACK_50`, `STRIPE_PRICE_PACK_150`, `STRIPE_PRICE_PACK_400` | Identifiant du prix unique de chaque pack de crédits. |
| `CRON_SECRET` | Valeur aléatoire longue (`openssl rand -hex 32`). Vercel l'envoie aux tâches planifiées, qui refusent de tourner sans elle. |
| `SUPERUSER_EMAILS` | Adresses des administrateurs (crédits illimités, pages admin), séparées par des virgules. Comptent seulement une fois l'email vérifié. |

Facultatives :

| Variable | Rôle |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Connexion Google (section 4). Sans elles, le bouton n'apparaît pas. |
| `OPS_ALERT_EMAIL` | Où partent les alertes d'exploitation (webhook Stripe en retard). Par défaut : l'adresse de contact. |
| `INTERNAL_EMAILS` | Adresses de test, marquées `is_internal` dans PostHog. |
| `SHOTSTACK_API_KEY` | Vidéos du kit marketing. |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Statistiques. Le serveur n'envoie qu'en production Vercel. |
| `NEXT_PUBLIC_META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`, `FACEBOOK_DOMAIN_VERIFICATION` | Meta. |
| `NEXT_PUBLIC_CALENDLY_URL` | Prise de rendez-vous sur l'accueil (masquée sans elle). |

Les variables `NEXT_PUBLIC_*` sont lues à la construction : redéployer après les avoir ajoutées.

### Déploiement de main

Chaque push sur `main` crée un déploiement de production. Si `/api/health` répond 404 ou annonce
un commit plus ancien que `origin/main`, ouvrir l'onglet Deployments :

- **Statut Blocked** : Vercel attend que le propriétaire du projet l'autorise. C'est le cas quand
  l'auteur du commit n'est pas membre de l'équipe Vercel (vécu sur Florelis). Ajouter chaque
  personne qui commite à l'équipe Vercel, ou relancer le déploiement depuis le compte propriétaire.
- **Statut Error** : lire le journal de build, la cause y est écrite.

## 3. Domaine et Resend

1. Vercel, Settings, Domains : ajouter `<domaine>` (Production) et `www.<domaine>` en redirection
   308 vers lui. Chez le registrar, créer les enregistrements affichés par Vercel (`A @`,
   `CNAME www`).
2. Resend, Domains, Add Domain : `<domaine>`, région Ireland (eu-west-1). Créer chez le registrar
   les enregistrements affichés (`resend._domainkey`, `send` en TXT et MX), plus `_dmarc` en TXT :
   `v=DMARC1; p=none;`. Puis « Verify DNS Records » : le statut doit passer à **Verified**. Tant
   qu'il ne l'est pas, aucun email ne part (vérification de compte, mot de passe, reçus, contact).

## 4. Google Cloud (connexion Google, facultative)

1. Google Cloud, API et services, Identifiants : créer un « ID client OAuth 2.0 », type
   « Application Web ».
   - Origines JavaScript autorisées : `https://<domaine>`
   - URI de redirection autorisés : `https://<domaine>/api/auth/callback/google`
2. Google Auth Platform, Branding : nom AutoStudio, page d'accueil `https://<domaine>`,
   confidentialité `https://<domaine>/legal/privacy`, conditions `https://<domaine>/legal/terms`,
   domaine autorisé `<domaine>`. Pas de logo au début : il impose une vérification par Google.
3. Audience : statut de publication **En production** (en mode Test, seuls les testeurs listés
   peuvent se connecter).
4. Copier l'identifiant et le secret dans `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`.

## 5. Stripe

En **mode production** :

1. **Produits** : trois abonnements mensuels (Essentiel, Pro, Business) et trois packs à paiement
   unique (50, 150, 400 crédits), en euros, aux prix de la page admin « Tarifs » (table
   `PricingConfig`). Copier chaque identifiant `price_…` dans sa variable.
2. **Webhook** : Développeurs, Webhooks, Ajouter un endpoint `https://<domaine>/api/webhooks/stripe`
   avec les événements `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. Un seul endpoint.
   Copier son secret de signature dans `STRIPE_WEBHOOK_SECRET`.
3. **Portail client** : Paramètres, Facturation, Portail client : activer le changement de moyen de
   paiement et l'historique des factures. L'annulation se fait aussi depuis l'application
   (`/api/billing/cancel`), quel que soit ce réglage.
4. **Informations publiques** : nom AutoStudio, adresse de contact, adresse du site, libellé de
   relevé bancaire.

Si le webhook est cassé, les clients sont quand même crédités au retour du paiement
(`/api/billing/fulfill`) et une alerte part vers `OPS_ALERT_EMAIL`. Mais les renouvellements et
les annulations ne sont rattrapés que par le webhook : traiter l'alerte le jour même.

## 6. Avant d'ouvrir au public

- Pages légales : remplir `LEGAL_ENTITY` dans `src/lib/site-config.ts` (nom, NIF, TVA, directeur
  de la publication). Obligatoire avant d'encaisser.
- Faire un vrai parcours : inscription, email de vérification reçu, un rendu, une retouche, un
  achat de pack avec une vraie carte (puis remboursement dans Stripe), désinscription depuis un
  email de relance.
- Relancer `npx tsx scripts/check-production.ts https://<domaine> --email`.
