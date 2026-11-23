import { NextRequest, NextResponse, after } from 'next/server'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { getSessionOrDevBypass } from '@/lib/dev-auth'
import { db } from '@/lib/db'
import { CAR_BACKGROUNDS } from '@/lib/carBackgrounds'
import { swapBackground } from '@/lib/gemini'
import { uploadBase64WithFallback } from '@/lib/blob-storage'
import { deductCredits, refundCredits, getAvailableCredits, InsufficientCreditsError, type DeductResult } from '@/lib/credits'
import { trackServerEvent, captureServerException } from '@/lib/analytics/server'
import { ANALYTICS_EVENTS } from '@/lib/analytics/events'
import { isEmailVerified } from '@/lib/auth-guards'
import { isSuperuserAccount } from '@/lib/superusers'
import { sendWelcomeEmail, sendReviewRequestEmail } from '@/lib/email'
import { base64PhotoType, InvalidImageError, type PhotoMimeType } from '@/lib/image-validation'
import { getDefaultBrandKit } from '@/lib/brand-kit'
import { applyLogo, isLogoCorner, type LogoCorner } from '@/lib/logo-overlay.server'

export const maxDuration = 300

const MAX_PHOTOS = 5
const FEATURE_KEY = 'imageGeneration'
const RENDER_FAILED_MESSAGE = "Le rendu a échoué, aucun crédit n'a été consommé. Veuillez réessayer."
/** The dealer's own background photo (showroom, workshop) sent with the request instead of a preset. */
const CUSTOM_BACKGROUND = 'custom'
/** What the library shows for a render made on the dealer's own background. */
const CUSTOM_BACKGROUND_LABEL = 'Fond personnalisé'
/** A background photo is downscaled by the editor (2000 px); this bounds what a client can send. */
const MAX_BACKGROUND_BYTES = 6 * 1024 * 1024

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
  code?: 'insufficient_credits'
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
  const session = await getSessionOrDevBypass()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const userId = session.user.id

  const body = await req.json()
  const { images, backgroundSlug, workspaceId, characteristics, customBackground, logo } = body as {
    images: ImagePayload[]
    backgroundSlug: string
    workspaceId: string
    characteristics?: string
    customBackground?: ImagePayload
    logo?: { corner?: string }
  }
  const isCustom = backgroundSlug === CUSTOM_BACKGROUND

  if (!Array.isArray(images) || images.length === 0 || images.length > MAX_PHOTOS) {
    return NextResponse.json({ error: `Envoyez entre 1 et ${MAX_PHOTOS} photos.` }, { status: 400 })
  }
  if (!backgroundSlug || (!isCustom && !CAR_BACKGROUNDS.some(b => b.slug === backgroundSlug))) {
    return NextResponse.json({ error: 'Fond invalide.' }, { status: 400 })
  }
  let logoCorner: LogoCorner | null = null
  if (logo) {
    if (!isLogoCorner(logo.corner)) return NextResponse.json({ error: 'Position du logo invalide.' }, { status: 400 })
    logoCorner = logo.corner
  }
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId requis' }, { status: 400 })
  }

  // Each photo is retyped from its own bytes before anything is charged or stored, and so is the
  // dealer's own background photo.
  let photos: { base64: string; mimeType: PhotoMimeType }[]
  let ownBackground: { base64: string; mimeType: PhotoMimeType } | null = null
  try {
    photos = images.map(image => ({ base64: image?.base64, mimeType: base64PhotoType(image?.base64) }))
    if (isCustom) {
      ownBackground = { base64: customBackground?.base64 as string, mimeType: base64PhotoType(customBackground?.base64, MAX_BACKGROUND_BYTES) }
    }
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

  // The logo comes from the workspace's brand kit, never from the request: checked before any
  // credit is taken, so asking for a logo without one costs nothing.
  let logoUrl: string | null = null
  if (logoCorner) {
    logoUrl = (await getDefaultBrandKit(workspaceId)).logoUrl
    if (!logoUrl) {
      return NextResponse.json({ error: 'no_logo', message: 'Ajoutez votre logo dans le kit de marque pour l\'afficher sur vos rendus.' }, { status: 400 })
    }
  }

  const background = ownBackground ?? await loadBackgroundReference(backgroundSlug)
  const styleLabel = isCustom ? CUSTOM_BACKGROUND_LABEL : backgroundSlug
  const analyticsIdentity = { userId, email: session.user.email ?? null, plan: member.workspace.plan, workspaceId }

  const results = await Promise.all(photos.map(async (image, index): Promise<SwapResult> => {
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
    const photo = await db.photo.create({
      data: {
        workspaceId,
        originalUrl: 'car-direct-upload',
        status: 'PROCESSING',
        styleUsed: styleLabel,
        toolsUsed: ['gemini_background_swap', ...(isCustom ? ['custom_background'] : []), ...(logoUrl ? ['logo_overlay'] : [])],
        createdById: userId,
      },
    })

    try {
      const [rendered, originalUrl] = await Promise.all([
        swapBackground(apiKey, image.base64, image.mimeType, background.base64, background.mimeType, characteristics),
        uploadBase64WithFallback(image.base64, image.mimeType, `original-${photo.id}.jpg`),
      ])
      // A logo that cannot be placed fails the render (and refunds it): the dealer asked for it.
      const swapped = logoUrl && logoCorner ? await applyLogo(rendered.base64, logoUrl, logoCorner) : rendered
      const enhancedUrl = await uploadBase64WithFallback(swapped.base64, swapped.mimeType, `enhanced-${photo.id}.png`)
      const processingMs = Date.now() - startMs

      await db.photo.update({
        where: { id: photo.id },
        data: { originalUrl, enhancedUrl, thumbnailUrl: enhancedUrl, status: 'ENHANCED', processingMs },
      })
      if (deduction) {
        await db.creditTransaction.updateMany({
          where: { id: { in: deduction.transactionIds } },
          data: { photoId: photo.id },
        })
      }

      return { index, photoId: photo.id, originalUrl, enhancedUrl, processingMs }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('[background-swap]', msg)
      captureServerException(err, userId)
      await db.photo.update({ where: { id: photo.id }, data: { status: 'FAILED', errorMessage: msg } })
      if (deduction) {
        await refundCredits(workspaceId, deduction, { featureKey: FEATURE_KEY, photoId: photo.id })
      }
      // The detailed cause (often a raw Gemini response) stays in the Photo row and the logs.
      return { index, error: RENDER_FAILED_MESSAGE }
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
