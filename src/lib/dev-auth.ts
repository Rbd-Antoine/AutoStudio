import { auth } from '@/auth'
import { db } from '@/lib/db'

// TEMPORARY: lets /app be reached locally without signing in, so the editor can be tested
// before auth is wired back in. Never runs in production (NODE_ENV guard below). Revert by
// switching call sites back to `auth()` from '@/auth' and deleting this file.
const DEV_BYPASS_EMAIL = 'ribeaudb38@gmail.com'

export async function getSessionOrDevBypass() {
  const session = await auth()
  if (session?.user?.id) return session
  if (process.env.NODE_ENV === 'production') return session

  const user = await db.user.findUnique({ where: { email: DEV_BYPASS_EMAIL } })
  if (!user) return session

  return { user: { id: user.id, email: user.email, name: user.name } } as typeof session
}
