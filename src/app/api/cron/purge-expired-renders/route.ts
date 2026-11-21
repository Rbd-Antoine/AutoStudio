import { NextRequest, NextResponse } from 'next/server'
import { rejectUnauthorizedCron } from '@/lib/cron-auth'
import { del } from '@vercel/blob'
import { db } from '@/lib/db'
import { isOwnBlobUrl } from '@/lib/photo-url'
import { RATE_LIMIT_RETENTION_MS } from '@/lib/rate-limit'
import { failStaleGenerations } from '@/lib/stale-generations'

const RETENTION_DAYS = 30
// Bounded per run so one invocation stays well within the function's time limit; any rest is
// picked up the next day.
const BATCH_SIZE = 1000

// Scheduled daily via vercel.json (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`).
export async function GET(req: NextRequest) {
  const denied = rejectUnauthorizedCron(req)
  if (denied) return denied

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)

  const expiring = await db.photo.findMany({
    where: {
      status: 'ENHANCED',
      downloadedAt: null,
      createdAt: { lt: cutoff },
    },
    select: { id: true, enhancedUrl: true, thumbnailUrl: true },
    take: BATCH_SIZE,
  })

  // The render files themselves are deleted from Blob, not just unlinked: they are public URLs.
  // A retouch keeps the render it started from as its "before" image (its originalUrl), so a
  // file still referenced that way stays. Originals are kept: the library shows them in place
  // of an expired render.
  const renderUrls = [...new Set(expiring.flatMap(p => [p.enhancedUrl, p.thumbnailUrl]).filter(isOwnBlobUrl))]
  const stillReferenced = new Set(
    (await db.photo.findMany({ where: { originalUrl: { in: renderUrls } }, select: { originalUrl: true } }))
      .map(p => p.originalUrl),
  )
  const filesToDelete = renderUrls.filter(url => !stillReferenced.has(url))

  if (filesToDelete.length > 0) {
    try {
      await del(filesToDelete)
    } catch (err) {
      // Rows are only marked expired once their files are gone, so the next run retries them
      // instead of losing track of files that are still online.
      console.error('[cron/purge-expired-renders] Blob deletion failed:', err)
      return NextResponse.json({ error: 'Blob deletion failed' }, { status: 500 })
    }
  }

  const purged = await db.photo.updateMany({
    where: { id: { in: expiring.map(p => p.id) } },
    data: {
      status:       'EXPIRED',
      enhancedUrl:  null,
      thumbnailUrl: null,
    },
  })

  // Renders cut off mid-flight (deploy, crash): marked failed and their credit given back.
  const stuck = await failStaleGenerations()

  const rateLimitRows = await db.rateLimitHit.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - RATE_LIMIT_RETENTION_MS) } },
  })

  return NextResponse.json({
    purged: purged.count,
    filesDeleted: filesToDelete.length,
    stuckMarkedFailed: stuck,
    rateLimitRowsDeleted: rateLimitRows.count,
  })
}
