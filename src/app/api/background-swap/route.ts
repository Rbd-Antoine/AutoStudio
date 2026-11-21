import { NextRequest, NextResponse, after } from 'next/server'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { getSessionOrDevBypass } from '@/lib/dev-auth'
import { db } from '@/lib/db'
import { CAR_BACKGROUNDS } from '@/lib/carBackgrounds'
import { swapBackground, describeRenderFailure, nearestAspectRatio, IMAGE_MODEL, type AspectRatio } from '@/lib/gemini'
import { endWithin, type WatchedRun } from '@/lib/watchdog'
import { protectVehicle, warmVehicleProtection } from '@/lib/vehicle-protection.server'
import { checkVehiclePhoto } from '@/lib/photo-check.server'
import { uploadBase64WithFallback } from '@/lib/blob-storage'
import { deductCredits, refundCredits, getAvailableCredits, InsufficientCreditsError, type DeductResult } from '@/lib/credits'
import { trackServerEvent, captureServerException } from '@/lib/analytics/server'
import { ANALYTICS_EVENTS } from '@/lib/analytics/events'
import { isEmailVerified } from '@/lib/auth-guards'
import { isSuperuserAccount } from '@/lib/superusers'
import { sendWelcomeEmail, sendReviewRequestEmail } from '@/lib/email'
import { base64PhotoType, InvalidImageError, type PhotoMimeType } from '@/lib/image-validation'

export const maxDuration = 300

const MAX_PHOTOS = 5
const FEATURE_KEY = 'imageGeneration'
const RENDER_FAILED_MESSAGE = "Le rendu a échoué, aucun crédit n'a été consommé. Veuillez réessayer."
const TIMEOUT_MESSAGE = "L'IA a mis trop de temps à répondre. Réessayez — votre crédit a été restitué."

// Every request ends before maxDuration (300 s), with the time to refund and record a failure:
// past WATCHDOG_MS a render is given up by the route itself rather than cut by the platform
// with its credit taken. Gemini gets at most GEMINI_TIMEOUT_MS (both tries), and always leaves
// STORE_MARGIN_MS to store the render.
const WATCHDOG_MS = 285_000
const GEMINI_TIMEOUT_MS = 200_000
const STORE_MARGIN_MS = 30_000

// The car photo's own frame, passed to Gemini so the render keeps it (see nearestAspectRatio).
// Undefined when the photo cannot be read here (HEIC on a sharp build without it): the model
// then picks the frame itself, as before.
async function photoAspectRatio(base64: string): Promise<AspectRatio | undefined> {
  try {
    const { width, height, orientation } = await sharp(Buffer.from(base64, 'base64')).metadata()
    // EXIF orientations 5-8 are rotated a quarter turn: the picture shows height x width.
    return orientation && orientation >= 5 ? nearestAspectRatio(height, width) : nearestAspectRatio(width, height)
  } catch {
    return undefined
  }
}

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
  code?: 'insufficient_credits' | 'unsuitable_photo'
  /** HTTP status this photo's failure would have on its own (422 refused, 503 overloaded, 504 timeout). */
  status?: number
  available?: number
  required?: number
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

// The editor sends one request per photo (several photos in one body exceed Vercel's 4.5 Mo
// request limit), but the route still accepts up to MAX_PHOTOS. Each photo is charged on its
// own, and refunded if its render fails.
export async function POST(req: NextRequest) {
  const requestStart = Date.now()
  const session = await getSessionOrDevBypass()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const userId = session.user.id

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

  // Each photo is retyped from its own bytes before anything is charged or stored.
  let photos: { base64: string; mimeType: PhotoMimeType }[]
  try {
    photos = images.map(image => ({ base64: image?.base64, mimeType: base64PhotoType(image?.base64) }))
  } catch (err) {
    if (err instanceof InvalidImageError) return NextResponse.json({ error: err.message }, { status: 400 })
    throw err
  }

  const [member, verified, isSuperuser] = await Promise.all([
    db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      include: { workspace: { select: { plan: true } } },
    }),
    isEmailVerified(userId),
    isSuperuserAccount(session.user),
  ])
  if (!member) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  // An unverified account gets exactly one free render — enough to
  // see the product work — then every further one needs a verified email. Bounds disposable-
  // email credit farming to one render per fake account.
  if (!verified) {
    const priorRenders = await db.creditTransaction.count({
      where: { workspaceId, featureKey: FEATURE_KEY, reason: 'ENHANCEMENT' },
    })
    if (priorRenders > 0 || images.length > 1) {
      return NextResponse.json(
        { error: 'email_not_verified', message: 'Vérifiez votre adresse e-mail pour générer un nouveau rendu.' },
        { status: 403 },
      )
    }
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY absent' }, { status: 500 })

  const background = await loadBackgroundReference(backgroundSlug)
  // The GPU container wakes while Gemini draws, so its cold start is mostly hidden.
  warmVehicleProtection()
  const analyticsIdentity = { userId, email: session.user.email ?? null, plan: member.workspace.plan, workspaceId }

  const results = await Promise.all(photos.map(async (image, index): Promise<SwapResult> => {
    // Before any credit: a photo with no vehicle in it is refused, not charged then rendered into
    // nonsense. Only a clear "no vehicle" refuses; an unanswered check lets the render go ahead.
    const photoCheck = await checkVehiclePhoto(apiKey, image.base64)
    if (!photoCheck.ok) {
      return { index, error: photoCheck.message, code: 'unsuitable_photo', status: 422 }
    }

    let deduction: DeductResult | null = null
    if (!isSuperuser) {
      try {
        deduction = await deductCredits(workspaceId, FEATURE_KEY)
      } catch (err) {
        if (err instanceof InsufficientCreditsError) {
          trackServerEvent(ANALYTICS_EVENTS.OUT_OF_CREDITS, {
            ...analyticsIdentity,
            remainingCredits: err.available,
            featureKey: FEATURE_KEY,
            required: err.required,
            available: err.available,
          })
          return { index, error: 'Crédits insuffisants', code: 'insufficient_credits', available: err.available, required: err.required }
        }
        captureServerException(err, userId)
        return { index, error: RENDER_FAILED_MESSAGE }
      }
    }

    const startMs = Date.now()
    let photoId: string | null = null
    // Set by whoever gives the credit back, before doing it: never twice.
    let refunded = false
    const giveBack = async (reason: string) => {
      if (!deduction || refunded) return
      refunded = true
      await refundCredits(workspaceId, deduction, { featureKey: FEATURE_KEY, photoId: photoId ?? undefined, notes: `Automatic refund: ${reason}` })
    }

    const run: WatchedRun = { finishing: false, abandoned: false }
    const work = async (): Promise<SwapResult> => {
      const photo = await db.photo.create({
        data: {
          workspaceId,
          originalUrl: 'car-direct-upload',
          status: 'PROCESSING',
          styleUsed: backgroundSlug,
          toolsUsed: ['gemini_background_swap'],
          createdById: userId,
        },
      })
      photoId = photo.id
      // Linked at once, not after success: if the function is killed mid-render, the stale-render
      // cleanup (stale-generations.ts) reads from the ledger what this photo still owes.
      if (deduction) {
        await db.creditTransaction.updateMany({ where: { id: { in: deduction.transactionIds } }, data: { photoId: photo.id } })
      }

      const left = WATCHDOG_MS - (Date.now() - requestStart)
      const aspectRatio = await photoAspectRatio(image.base64)
      const [swapped, originalUrl] = await Promise.all([
        swapBackground(
          apiKey,
          { data: image.base64, mimeType: image.mimeType },
          { data: background.base64, mimeType: background.mimeType },
          characteristics,
          { aspectRatio, timeoutMs: Math.min(GEMINI_TIMEOUT_MS, left - STORE_MARGIN_MS) },
        ),
        uploadBase64WithFallback(image.base64, image.mimeType, `original-${photo.id}.jpg`),
      ])
      if (run.abandoned) return { index, error: RENDER_FAILED_MESSAGE }

      // The photographed car put back over Gemini's redraw (badges, wheels, plate), when the
      // GPU service is configured; otherwise, or on any refusal, the render as drawn.
      const protection = await protectVehicle(
        Buffer.from(image.base64, 'base64'),
        { data: Buffer.from(swapped.base64, 'base64'), mimeType: swapped.mimeType },
        { mimeType: image.mimeType, requests: characteristics, remainingMs: WATCHDOG_MS - (Date.now() - requestStart) - STORE_MARGIN_MS },
      )
      if (run.abandoned) return { index, error: RENDER_FAILED_MESSAGE }
      run.finishing = true

      const enhancedUrl = await uploadBase64WithFallback(protection.image.toString('base64'), protection.mimeType, `enhanced-${photo.id}.png`)
      const processingMs = Date.now() - startMs
      await db.photo.update({
        where: { id: photo.id },
        data: {
          originalUrl, enhancedUrl, thumbnailUrl: enhancedUrl, status: 'ENHANCED', processingMs,
          // How this render was made, to compare renders and diagnose a complaint later.
          generationInput: {
            imageModel: IMAGE_MODEL,
            backgroundSlug,
            photoChecked: photoCheck.checked,
            aspectRatio: aspectRatio ?? null,
            characteristics: characteristics?.trim() || null,
            vehicleProtection: protection.protected
              ? { protected: true, ...(protection.diagnostics ? { diagnostics: protection.diagnostics } : {}) }
              : { protected: false, skipped: protection.skipped ?? null, reason: protection.reason ?? null },
          },
        },
      })
      return { index, photoId: photo.id, originalUrl, enhancedUrl, processingMs }
    }

    const fail = async (err: unknown, message: string, status: number, reason: 'refused' | 'unavailable' | 'timeout' | 'error'): Promise<SwapResult> => {
      const detail = err instanceof Error ? err.message : String(err)
      console.error('[background-swap]', detail)
      if (reason === 'error') captureServerException(err, userId)
      if (photoId) {
        await db.photo.update({ where: { id: photoId }, data: { status: 'FAILED', errorMessage: detail.slice(0, 1000) } })
          .catch(recordErr => console.error(`[background-swap] failed render ${photoId} not recorded:`, recordErr))
      }
      await giveBack(reason)
      trackServerEvent(ANALYTICS_EVENTS.RENDER_FAILED, {
        ...analyticsIdentity,
        remainingCredits: 0,
        featureKey: FEATURE_KEY,
        reason,
        refunded: !!deduction,
        processingMs: Date.now() - startMs,
      })
      // The detailed cause (often a raw Gemini response) stays in the Photo row and the logs.
      return { index, photoId: photoId ?? undefined, error: message, status }
    }

    try {
      const watched = await endWithin(work(), WATCHDOG_MS - (Date.now() - requestStart), run)
      if (watched.ended) return watched.value
      return await fail(new Error(`watchdog: no end after ${WATCHDOG_MS / 1000} s`), TIMEOUT_MESSAGE, 504, 'timeout')
    } catch (err) {
      const failure = describeRenderFailure(err)
      return await fail(err, failure.message, failure.status, failure.reason)
    }
  }))

  const successes = results.filter(r => r.enhancedUrl)
  if (successes.length > 0) {
    const remainingCredits = isSuperuser ? 0 : (await getAvailableCredits(workspaceId)).total
    for (const r of successes) {
      trackServerEvent(ANALYTICS_EVENTS.IMAGE_GENERATED, { ...analyticsIdentity, remainingCredits, styleSlug: backgroundSlug, processingMs: r.processingMs })
    }
    if (!isSuperuser) {
      trackServerEvent(ANALYTICS_EVENTS.CREDITS_CONSUMED, { ...analyticsIdentity, remainingCredits, featureKey: FEATURE_KEY, amount: successes.length })
    }

    // Counted after this request's renders are saved, so whichever request finishes the
    // workspace's first render sends the welcome email — the editor fires one request per
    // photo in parallel, and a count taken before rendering would have them all claim "first".
    const enhancedCount = await db.photo.count({ where: { workspaceId, status: 'ENHANCED' } })
    const email = session.user.email
    const name = session.user.name ?? email?.split('@')[0] ?? ''
    if (enhancedCount === successes.length) {
      trackServerEvent(ANALYTICS_EVENTS.FIRST_IMAGE_GENERATED, { ...analyticsIdentity, remainingCredits })
      if (email) after(() => sendWelcomeEmail(email, name, successes[0].enhancedUrl))
    }
    // Ask for a review once the workspace has real usage behind it. The conditional
    // updateMany only claims while reviewRequestedAt is still null, so it sends at most once.
    if (enhancedCount >= 3 && email) {
      const claimed = await db.workspace.updateMany({
        where: { id: workspaceId, reviewRequestedAt: null },
        data: { reviewRequestedAt: new Date() },
      })
      if (claimed.count > 0) after(() => sendReviewRequestEmail(email, { name: session.user?.name ?? undefined }))
    }
  }

  const insufficient = results.find(r => r.code === 'insufficient_credits')
  if (insufficient && successes.length === 0) {
    return NextResponse.json(
      { error: 'insufficient_credits', message: 'Crédits insuffisants', available: insufficient.available, required: insufficient.required, results },
      { status: 402 },
    )
  }

  return NextResponse.json({ results })
}
