import { db } from '@/lib/db'

// Accounts with admin access and unlimited credits. Override with a comma-separated
// SUPERUSER_EMAILS env var; these addresses apply when it is unset.
const DEFAULT_SUPERUSER_EMAILS = ['ribeaudb38@gmail.com', 'antoine.rbd.38@gmail.com']

export function superuserEmails(): string[] {
  const fromEnv = process.env.SUPERUSER_EMAILS?.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  return fromEnv?.length ? fromEnv : DEFAULT_SUPERUSER_EMAILS
}

function isSuperuserEmail(email: string | null | undefined): boolean {
  return !!email && superuserEmails().includes(email.toLowerCase())
}

// An address on the list only counts once its owner has proven they control it. Signing up
// doesn't require verification, so without this check anyone could register a superuser
// address on a fresh database and get the admin APIs. Reads the account from the database
// rather than trusting the email baked into the session token.
export async function isSuperuserAccount(user: { id?: string | null } | null | undefined): Promise<boolean> {
  if (!user?.id) return false
  const account = await db.user.findUnique({ where: { id: user.id }, select: { email: true, emailVerified: true } })
  return !!account?.emailVerified && isSuperuserEmail(account.email)
}
