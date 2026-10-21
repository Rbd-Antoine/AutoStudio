import { NextRequest, NextResponse } from 'next/server'
import { getSessionOrDevBypass } from '@/lib/dev-auth'
import { db } from '@/lib/db'
import { isSuperuserAccount } from '@/lib/superusers'
import { retouchImage } from '@/lib/gemini'
import { uploadBase64WithFallback } from '@/lib/blob-storage'
import { deductCredits, refundCredits, getAvailableCredits, InsufficientCreditsError } from '@/lib/credits'
import { trackServerEvent, captureServerException } from '@/lib/analytics/server'
import { ANALYTICS_EVENTS } from '@/lib/analytics/events'
import { isEmailVerified } from '@/lib/auth-guards'
import { isOwnBlobUrl } from '@/lib/photo-url'
import { base64PhotoType, sniffImageType, InvalidImageError, MAX_UPLOAD_BYTES } from '@/lib/image-validation'

export const maxDuration = 120

const FEATURE_KEY = 'imageRetouch'
const MAX_INSTRUCTION_LENGTH = 1000

export async function POST(req: NextRequest) {
  const session = await getSessionOrDevBypass()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const body = await req.json()
  const { imageData, imageUrl, instruction, workspaceId, styleSlug } = body as {
    imageData?: string
    imageUrl?: string
    instruction: string
    workspaceId: string
    styleSlug?: string
  }

  if ((!imageData && !imageUrl) || !workspaceId || !instruction?.trim()) {
    return NextResponse.json({ error: 'imageData (ou imageUrl), workspaceId et instruction sont requis' }, { status: 400 })
  }
  if (instruction.length > MAX_INSTRUCTION_LENGTH) {
    return NextResponse.json({ error: `Instruction trop longue (${MAX_INSTRUCTION_LENGTH} caractères max).` }, { status: 400 })
  }

  const isSuperuser = await isSuperuserAccount(session.user)

  const member = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
    include: { workspace: { select: { plan: true } } },
  })

  if (!member) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  // Retouching only ever applies to a photo from a prior generation, so an unverified
  // account has already used its one free generate by the time it could reach this route.
  if (!(await isEmailVerified(session.user.id))) {
    return NextResponse.json(
      { error: 'email_not_verified', message: 'Vérifiez votre adresse e-mail pour retoucher un rendu.' },
      { status: 403 },
    )
  }

  // The photo being retouched is normally a hosted Vercel Blob URL by this point (that's the
  // whole point of the Blob migration), not a base64 data: URI — fetching it server-side keeps
  // the request body tiny regardless of the image's size, instead of asking the client to
  // download and re-upload it as base64 (which is exactly the payload-size trap the upload flow
  // itself was just fixed for). The URL is only fetched when it is one of this workspace's own
  // renders on Blob, so the route can't be used to make the server request any other address.
  let resolvedImageData: string
  let resolvedMimeType: string
  let reusableOriginalUrl: string | null = null

  try {
    if (imageData) {
      resolvedImageData = imageData
      resolvedMimeType = base64PhotoType(imageData)
    } else {
      const ownPhoto = isOwnBlobUrl(imageUrl) && await db.photo.findFirst({
        where: { workspaceId, OR: [{ enhancedUrl: imageUrl }, { originalUrl: imageUrl }] },
        select: { id: true },
      })
      if (!ownPhoto) {
        return NextResponse.json({ error: 'Ce rendu est introuvable dans votre espace.' }, { status: 400 })
      }
      const imgRes = await fetch(imageUrl!)
      const declaredLength = Number(imgRes.headers.get('content-length') ?? 0)
      if (!imgRes.ok || declaredLength > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ error: 'Impossible de récupérer le rendu à retoucher.' }, { status: 400 })
      }
      const buffer = Buffer.from(await imgRes.arrayBuffer())
      const sniffed = buffer.length <= MAX_UPLOAD_BYTES ? sniffImageType(buffer) : null
      if (!sniffed) {
        return NextResponse.json({ error: 'Impossible de récupérer le rendu à retoucher.' }, { status: 400 })
      }
      resolvedImageData = buffer.toString('base64')
      resolvedMimeType = sniffed
      reusableOriginalUrl = imageUrl!
    }
  } catch (err) {
    if (err instanceof InvalidImageError) return NextResponse.json({ error: err.message }, { status: 400 })
    throw err
  }

  const analyticsIdentity = { userId: session.user.id, email: session.user.email ?? null, plan: member.workspace.plan, workspaceId }

  let deduction: Awaited<ReturnType<typeof deductCredits>> | null = null
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
        return NextResponse.json(
          { error: 'insufficient_credits', message: 'Crédits insuffisants', available: err.available, required: err.required },
          { status: 402 },
        )
      }
      throw err
    }
  }

  const photo = await db.photo.create({
    data: {
      workspaceId,
      originalUrl: 'car-retouche',
      status: 'PROCESSING',
      styleUsed: styleSlug,
      toolsUsed: ['gemini_image_retouch'],
      createdById: session.user.id,
    },
  })

  const startMs = Date.now()

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY absent')

    // reusableOriginalUrl means the "before" image was already a hosted Blob URL — reuse it
    // instead of re-uploading a byte-identical duplicate copy under a new name.
    const [retouched, originalUrl] = await Promise.all([
      retouchImage(apiKey, resolvedImageData, resolvedMimeType, instruction.trim()),
      reusableOriginalUrl
        ? Promise.resolve(reusableOriginalUrl)
        : uploadBase64WithFallback(resolvedImageData, resolvedMimeType, `original-${photo.id}.png`),
    ])
    const enhancedUrl = await uploadBase64WithFallback(retouched.base64, retouched.mimeType, `enhanced-${photo.id}.png`)
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

    console.log(`[retouch] done in ${processingMs}ms`)
    const credits = isSuperuser ? null : await getAvailableCredits(workspaceId)
    const remainingCredits = credits?.total ?? 0

    trackServerEvent(ANALYTICS_EVENTS.IMAGE_RETOUCHED, { ...analyticsIdentity, remainingCredits, processingMs })
    if (deduction) {
      trackServerEvent(ANALYTICS_EVENTS.CREDITS_CONSUMED, {
        ...analyticsIdentity, remainingCredits, featureKey: FEATURE_KEY, amount: deduction.monthlySpent + deduction.bonusSpent,
      })
    }

    return NextResponse.json({ photoId: photo.id, originalUrl, enhancedUrl, processingMs, credits })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[retouch]', msg)
    captureServerException(err, session.user.id)
    await db.photo.update({
      where: { id: photo.id },
      data: { status: 'FAILED', errorMessage: msg },
    })

    if (deduction) {
      await refundCredits(workspaceId, deduction, { featureKey: FEATURE_KEY, photoId: photo.id })
    }

    // The detailed cause (often a raw Gemini response) stays in the Photo row and the logs.
    return NextResponse.json({ error: 'Retouche échouée, veuillez réessayer.' }, { status: 500 })
  }
}
