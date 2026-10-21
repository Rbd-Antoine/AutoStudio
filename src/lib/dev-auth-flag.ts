// Edge-safe (imported by the middleware): whether the local sign-in bypass of dev-auth.ts is on.
// Explicit opt-in on top of the dev-server check, because `next dev` also listens on the local
// network: without the flag, anyone on the same Wi-Fi would be signed in as the superuser.
export const DEV_AUTH_BYPASS_ENABLED =
  process.env.NODE_ENV !== 'production' && process.env.DEV_AUTH_BYPASS === 'true'
