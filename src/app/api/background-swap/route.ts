import { NextRequest, NextResponse } from 'next/server'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { getSessionOrDevBypass } from '@/lib/dev-auth'
import { db } from '@/lib/db'
import { CAR_BACKGROUNDS } from '@/lib/carBackgrounds'
import { swapBackground } from '@/lib/gemini'
import { uploadBase64WithFallback } from '@/lib/blob-storage'
import { captureServerException } from '@/lib/analytics/server'

export const maxDuration = 300

const MAX_PHOTOS = 5

interface ImagePayload {
  base64: string
  mimeType: string
}

interface SwapResult {
  index: number
  photoId?: string
  originalUrl?: string
  enhancedUrl?: string
  processingMs?: number
  error?: string
}

// The four background reference photos live in /public — read once per cold start and cached
// in memory rather than re-reading + re-encoding disk on every request, since they never change
// at runtime. Normalized to JPEG regardless of source format (a couple are .avif) so Gemini
// always receives a format it's known to accept.
const backgroundCache = new Map<string, Promise<{ base64: string; mimeType: string }>>()

async function loadBackgroundReference(slug: string): Promise<{ base64: string; mimeType: string }> {
  const cached = backgroundCache.get(slug)
  if (cached) return cached

  const promise = (async () => {
    const bg = CAR_BACKGROUNDS.find(b => b.slug === slug)
    if (!bg) throw new Error(`Fond inconnu : ${slug}`)
    const filePath = path.join(process.cwd(), 'public', bg.image)
    const buffer = await readFile(filePath)
    const jpeg = await sharp(buffer).jpeg({ quality: 90 }).toBuffer()
    return { base64: jpeg.toString('base64'), mimeType: 'image/jpeg' }
  })()

  backgroundCache.set(slug, promise)
  return promise
}

export async function POST(req: NextRequest) {
  const session = await getSessionOrDevBypass()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const body = await req.json()
  const { images, backgroundSlug, workspaceId, characteristics } = body as {
    images: ImagePayload[]
    backgroundSlug: string
    workspaceId: string
    characteristics?: string
  }

  if (!Array.isArray(images) || images.length === 0 || images.length > MAX_PHOTOS) {
    return NextResponse.json({ error: `Envoyez entre 1 et ${MAX_PHOTOS} photos.` }, { status: 400 })
  }
  if (!backgroundSlug || !CAR_BACKGROUNDS.some(b => b.slug === backgroundSlug)) {
    return NextResponse.json({ error: 'Fond invalide.' }, { status: 400 })
  }
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId requis' }, { status: 400 })
  }

  const member = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
  })
  if (!member) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY absent' }, { status: 500 })

  const background = await loadBackgroundReference(backgroundSlug)

  const results = await Promise.all(images.map(async (image, index): Promise<SwapResult> => {
    const startMs = Date.now()
    const photo = await db.photo.create({
      data: {
        workspaceId,
        originalUrl: 'car-direct-upload',
        status: 'PROCESSING',
        styleUsed: backgroundSlug,
        toolsUsed: ['gemini_background_swap'],
        createdById: session.user.id,
      },
    })

    try {
      const [swapped, originalUrl] = await Promise.all([
        swapBackground(apiKey, image.base64, image.mimeType, background.base64, background.mimeType, characteristics),
        uploadBase64WithFallback(image.base64, image.mimeType, `original-${photo.id}.jpg`),
      ])
      const enhancedUrl = await uploadBase64WithFallback(swapped.base64, swapped.mimeType, `enhanced-${photo.id}.png`)
      const processingMs = Date.now() - startMs

      await db.photo.update({
        where: { id: photo.id },
        data: { originalUrl, enhancedUrl, thumbnailUrl: enhancedUrl, status: 'ENHANCED', processingMs },
      })

      return { index, photoId: photo.id, originalUrl, enhancedUrl, processingMs }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('[background-swap]', msg)
      captureServerException(err, session.user.id)
      await db.photo.update({ where: { id: photo.id }, data: { status: 'FAILED', errorMessage: msg } })
      return { index, error: msg }
    }
  }))

  return NextResponse.json({ results })
}
