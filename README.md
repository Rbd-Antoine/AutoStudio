# AutoStudio

Next.js 15 · React 19 · TypeScript · Tailwind CSS · Prisma 7 (Postgres) · NextAuth v5 · Stripe · Gemini

AutoStudio replaces the background of a dealer's vehicle photos with one of four real background
scenes, without touching the vehicle, and turns a render into short social videos.

## What's in the app

| Area | Routes | Notes |
|---|---|---|
| Marketing site | `/`, `/pricing`, `/features`, `/about`, `/contact`, `/blog`, `/guide`, `/legal/*` | French at `/`; `/en`, `/de`, `/es`, `/pt` serve the same French content for now |
| Auth | `/signin`, `/signup`, `/check-email`, `/forgot-password`, `/reset-password` | Email + password (verification email) or Google |
| Editor | `/app/editor` | Up to 5 photos per run, one request per photo, 1 credit per render; retouch; marketing kit |
| Library / dashboard | `/app`, `/app/library` | Renders not downloaded within 30 days are purged |
| Brand kit | `/app/brand-kit` | Name, colour, logo used by the marketing kit |
| Billing | `/app/billing` | Stripe Checkout (plans and credit packs), customer portal |
| Admin | `/app/admin/*` | Accounts listed in `SUPERUSER_EMAILS`, email verified |

The backgrounds live in `src/lib/carBackgrounds.ts` (reference photos in `public/background/`);
the marketing site derives its style cards from the same list (`src/lib/carStyles.ts`).
Blog articles and the guide are Markdown files in `content/`.

## Local development

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env        # fill at least DATABASE_URL, AUTH_SECRET, GEMINI_API_KEY, CRON_SECRET
npx prisma migrate deploy   # creates the schema
npx prisma db seed          # pricing config + AI feature costs
npm run dev
```

No local Postgres? `npx prisma dev` starts a throwaway one and prints its `DATABASE_URL`.

With `DEV_AUTH_BYPASS="true"` in `.env` (`next dev` only), `src/lib/dev-auth.ts` signs you in as
the first `SUPERUSER_EMAILS` address when there is no session, if that account exists in the
database. Never set it on Vercel.

## Deploy (Vercel)

1. Import the repository in Vercel (framework preset: Next.js).
2. Add a Postgres database (Neon from the Vercel Marketplace, or Supabase) and a Blob store,
   both connected to the project.
3. Set the environment variables listed in `.env.example`.
4. Run `npx prisma migrate deploy && npx prisma db seed` once against the production database.
5. Point the Stripe webhook at `https://<domain>/api/webhooks/stripe` with the events
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.

The daily jobs in `vercel.json` (`/api/cron/*`) require `CRON_SECRET`.

## Database changes

`prisma/migrations` starts from a single baseline matching `schema.prisma`. For a schema
change, run `npx prisma migrate dev --name <change>` against a development database and
commit the generated migration; production applies it with `npx prisma migrate deploy`.
