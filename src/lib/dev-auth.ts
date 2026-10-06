import { auth } from '@/auth'
import { db } from '@/lib/db'
import { superuserEmails } from '@/lib/superusers'

// TEMPORARY: lets /app be reached locally without signing in, so the editor can be tested
// before auth is wired back in. Never runs in production (NODE_ENV guard below). Revert by
// switching call sites back to `auth()` from '@/auth' and deleting this file.
// Signs in as the first superuser address, which must already have an account locally.

export async function getSessionOrDevBypass() {
  const session = await auth()
  if (session?.user?.id) return session
  if (process.env.NODE_ENV === 'production') return session

  const user = await db.user.findUnique({ where: { email: superuserEmails()[0] } })
  if (!user) return session

  return { user: { id: user.id, email: user.email, name: user.name } } as typeof session
}
