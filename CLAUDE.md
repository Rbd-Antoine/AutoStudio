# AutoStudio

SaaS de photos de véhicules par IA pour concessionnaires : la photo d'une voiture du stock reçoit
l'un des 4 décors de référence (studio, showroom…) sans que le véhicule change, puis retouches et
vidéos pour les réseaux. Site en français (`/`), éditeur basé au Portugal (pages légales).
Pas encore en production. Même socle technique que Florelis (`benitavo/Verdia`, rendus de
jardins), dont les correctifs génériques ont été repris le 21/11/2026 (branche
`feat/socle-florelis`).

## Règles absolues

- **Base de données** : le CLI Prisma et `prisma/seed.ts` lisent `.env`, qui vise la base
  partagée (Prisma Postgres). Ne jamais lancer `npx prisma migrate dev|reset`, `db push` ni
  `db seed` directement. En local : `npx tsx scripts/local-db.ts migrate|new <nom>|seed <email>
  <mdp>`, qui refuse toute URL non locale. La production se migre avec `migrate deploy` par la
  connexion directe, à la main (docs/mise-en-ligne.md).
- Le dev local appelle la **vraie clé Gemini** : chaque rendu coûte (~0,05 € l'image). Demander un
  budget en euros avant une série de rendus de test.
- Pas de commit, push, déploiement ni écriture en base partagée sans demande explicite.

## Stack (package.json)

- Next.js `^15.5.27` (App Router, Turbopack en dev), React `^19.1.0`, TypeScript `^5.7.3`
- Prisma `^7.8.0` avec `@prisma/adapter-pg` + `pg` (pool borné, `src/lib/db.ts`) ; client généré
  dans `src/generated/prisma` (import `@/generated/prisma/client`) ; migrations dans
  `prisma/migrations`
- NextAuth `5.0.0-beta.32` + `@auth/prisma-adapter`, bcryptjs ; next-intl `^4` (français seul)
- Stripe `^17.5.0`, Resend `^4.8.0`, `@vercel/blob`, `@vercel/functions` 3.10.4, client-zip 2.5.1
- posthog-js / posthog-node, sharp ; Gemini en REST direct (`fetch`, pas de SDK) ; service GPU
  Python sur Modal (`services/vehicle-protection`)

## Commandes

| Commande | Rôle |
|---|---|
| `node C:\Users\BenoitRibeaud\.florelis-dev-db\start.mjs` | Postgres 17 local (port 54329, base `autostudio`) |
| `npm run dev` | `next dev --turbopack` ; `.env.local` surcharge `DATABASE_URL`, vide `RESEND_API_KEY` (emails journalisés) |
| `npm run build`, `npm run lint`, `npx tsc --noEmit` | build, lint, types |
| `npm run check:watchdog`, `npm run check:vehicle-protection` | tests hors ligne (`node:assert`, sans réseau ni base) |
| `python -m pytest services/vehicle-protection/tests -q` | composition du service GPU, sans GPU |
| `npx tsx scripts/check-production.ts https://<domaine>` | état de la production vu de l'extérieur (lecture seule) |

## Architecture

- `src/app/[locale]/(marketing)/` : site public, blog, guide, tarifs, pages légales,
  `/unsubscribe`. `/en`, `/de`, `/es`, `/pt` redirigent vers le français (`middleware.ts`).
- `src/app/(auth)/`, `src/auth.ts`, `src/auth.config.ts`, `src/lib/auth-url-guard.ts`.
- `src/app/app/` : application connectée. `editor/EditorClient.tsx` (une requête par photo),
  `library` (zip groupé), `billing` (filet de paiement, annulation), `brand-kit`, `admin/*`.
- `src/app/api/` : `background-swap` (rendu), `retouch`, `photos/[id]/marketing-*`,
  `billing/{checkout,fulfill,cancel,portal,history}`, `webhooks/stripe`, `cron/*`, `health`,
  `unsubscribe`, `admin/*`.
- `src/lib/` : `.server.ts` = serveur uniquement.
  - `gemini.ts` : `IMAGE_MODEL` (`gemini-nano-banana-2.1`), limites de temps, erreurs
    (`GeminiBlockedError`, `GeminiUnavailableError`), une relance, cadre de la photo imposé.
  - `carPrompts.ts`, `carBackgrounds.ts`, `carStyles.ts` : prompts et décors.
  - `watchdog.ts`, `stale-generations.ts` : un rendu finit toujours (285 s) et rend son crédit.
  - `vehicle-protection.server.ts` : remet la voiture photographiée dans le rendu (inactif sans
    `VEHICLE_PROTECTION_URL`), docs/vehicle-protection.md.
  - `credits.ts`, `pricing.ts`, `fulfillment.ts`, `stripe.ts` : crédits et paiements.
  - `email.ts` (`marketing: true` = lien de désinscription, jamais envoyé à un désinscrit),
    `unsubscribe.ts`.
  - `analytics/` : PostHog (`events.ts` = liste typée ; serveur envoyé via `after()`, en
    production Vercel seulement).

### Flux d'un rendu (`POST /api/background-swap`)

1. L'éditeur envoie une photo (base64, réduite dans le navigateur) avec le décor et la consigne.
2. Vérifications avant débit : session, membre du workspace, format réel de l'image, email
   vérifié (un seul rendu gratuit sans vérification).
3. `deductCredits` (UPDATE atomique, 402 si le solde manque ; superutilisateurs non débités),
   `Photo` en `PROCESSING`, débit lié à la photo aussitôt.
4. `swapBackground` (photo + image du décor, format de la photo imposé), envoi de l'original sur
   Blob en parallèle ; puis `protectVehicle` si le service est configuré.
5. Rendu sur Blob, `Photo` en `ENHANCED` avec `generationInput` (modèle, décor, cadre, consigne,
   issue de la protection).
6. En cas d'échec ou à 285 s : remboursement, `Photo` en `FAILED`, `Render Failed`, message en
   clair (422 refus, 503 surcharge, 504 délai). Un rendu tué quand même est remboursé par
   `failStaleGenerations` (bibliothèque, tâche de nuit).

### Crédits et paiements

- Crédits portés par le **Workspace** : `monthlyCredits` (dépensés d'abord) + `bonusCredits`
  (packs). Tout mouvement passe par `credits.ts` ou `fulfillment.ts` et crée une `CreditTransaction`.
- Coûts et allocations dans `AiFeature` et `PricingConfig` (page admin) : jamais en dur.
- `fulfillment.ts` est le **seul** endroit qui accorde un plan ou des crédits payés, idempotent
  (colonne unique `fulfillmentKey`), appelé par le webhook ET par `/api/billing/fulfill` au retour
  de Stripe.

## Conventions et pièges

- Commentaires de code en anglais, messages de commit en français. Expliquer le pourquoi.
- Les textes de l'interface sont en français dans le code (pas encore de `messages/` complet).
- Une nouvelle colonne : modifier `schema.prisma`, puis `npx tsx scripts/local-db.ts new <nom>`
  (écrit la migration et l'applique en local ; `migrate dev` refuse de tourner sans terminal).
- Restes de CarGlow : modèle `Vehicle`, `ShareLink` (aucune route ne s'en sert encore).
- Mise en ligne ou site cassé : lire docs/mise-en-ligne.md, lancer
  `scripts/check-production.ts`, guider étape par étape pour chaque échec seulement.
