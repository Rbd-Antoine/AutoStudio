import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { attachDatabasePool } from '@vercel/functions'
import pg from 'pg'

// Each Vercel instance has its own pool, and an instance that goes to sleep keeps its idle
// connections open. On the sister product Florelis (same stack) pg's default pool
// of 10 per instance let a handful of instances take every connection the database role allows:
// each query then failed with P2037 "too many connections", and renders answered a bare HTTP 500
// before doing anything (2026-11-13). Hence: few connections per instance, closed soon once idle,
// closed before the instance sleeps (attachDatabasePool), and a connection refused for that
// reason is asked for again rather than failing the request.
const POOL_MAX = 3
const IDLE_TIMEOUT_MS = 5_000
// Waits between attempts when the database refuses a new connection (SQLSTATE 53300): about 7 s in
// all, the time other instances take to close their idle ones.
const RETRY_DELAYS_MS = [300, 800, 1_500, 2_000, 2_500]

/** "too many connections" / "remaining connection slots are reserved": the server is full, for now. */
export function isTooManyConnections(err: unknown): boolean {
  const e = err as { code?: unknown; message?: unknown } | null
  return e?.code === '53300' || (typeof e?.message === 'string' && /too many (database )?connections|remaining connection slots/i.test(e.message))
}

// The adapter takes its connections through connect() — pool.query() too goes through it, with a
// callback — so this is the one place a refused connection can be asked for again. Only a refused
// connection is retried: no query has run on it, so nothing can run twice.
class RetryingPool extends pg.Pool {
  connect(): Promise<pg.PoolClient>
  connect(callback: (err: Error | undefined, client: pg.PoolClient | undefined, done: (release?: boolean | Error) => void) => void): void
  connect(callback?: (err: Error | undefined, client: pg.PoolClient | undefined, done: (release?: boolean | Error) => void) => void): Promise<pg.PoolClient> | void {
    const attempt = async (): Promise<pg.PoolClient> => {
      for (let i = 0; ; i++) {
        try {
          return await super.connect()
        } catch (err) {
          if (!isTooManyConnections(err) || i >= RETRY_DELAYS_MS.length) throw err
          const wait = RETRY_DELAYS_MS[i] * (0.75 + Math.random() * 0.5)
          console.warn(`[db] database full, connection asked again in ${Math.round(wait)} ms (attempt ${i + 2})`)
          await new Promise(resolve => setTimeout(resolve, wait))
        }
      }
    }
    const pending = attempt()
    if (!callback) return pending
    pending.then(client => callback(undefined, client, client.release), err => callback(err, undefined, () => {}))
  }
}

function createClient() {
  const pool = new RetryingPool({ connectionString: process.env.DATABASE_URL!, max: POOL_MAX, idleTimeoutMillis: IDLE_TIMEOUT_MS })
  // Keeps a Vercel instance awake until its idle connections are closed (a no-op elsewhere).
  attachDatabasePool(pool)
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
