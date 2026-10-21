import { NextRequest, NextResponse } from 'next/server'
import { getSessionOrDevBypass } from '@/lib/dev-auth'
import { db } from '@/lib/db'
import { getDefaultBrandKit } from '@/lib/brand-kit'
import { generateText } from '@/lib/gemini'
import { CAR_STYLES, buildSocialCaptionPrompt } from '@/lib/carPrompts'
import { CAR_BACKGROUNDS } from '@/lib/carBackgrounds'
import { isEmailVerified } from '@/lib/auth-guards'
import { checkRateLimit, tooManyRequests, DAY } from '@/lib/rate-limit'

export const maxDuration = 30

const MAX_CTA_LENGTH = 120
const DAILY_CAPTIONS_PER_WORKSPACE = 30

// Free — a short text completion is cheap relative to the video render, which already costs
// a credit; gating this too would just add friction to something meant to lower it. Still
// bounded (verified email, daily cap, short CTA) so it can't be used as a free Gemini proxy.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrDevBypass()
  if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { ctaText } = body as { ctaText?: string }
  if (ctaText !== undefined && (typeof ctaText !== 'string' || ctaText.length > MAX_CTA_LENGTH)) {
    return NextResponse.json({ error: `Appel à l'action trop long (${MAX_CTA_LENGTH} caractères max).` }, { status: 400 })
  }

  const photo = await db.photo.findUnique({
    where: { id },
    select: {
      workspaceId: true,
      styleUsed: true,
      workspace: { select: { members: { where: { userId: session.user.id }, select: { userId: true } } } },
    },
  })

  if (!photo || photo.workspace.members.length === 0) {
    return NextResponse.json({ error: 'Rendu introuvable' }, { status: 404 })
  }

  if (!(await isEmailVerified(session.user.id))) {
    return NextResponse.json(
      { error: 'email_not_verified', message: 'Vérifiez votre adresse e-mail pour générer un texte.' },
      { status: 403 },
    )
  }
  if (!(await checkRateLimit(`marketing-caption:${photo.workspaceId}`, DAILY_CAPTIONS_PER_WORKSPACE, DAY))) {
    return tooManyRequests('Limite quotidienne de textes atteinte. Réessayez demain.')
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Configuration serveur manquante' }, { status: 500 })

  try {
    const brandKit = await getDefaultBrandKit(photo.workspaceId)
    // Renders from the editor record the background slug; older ones a CAR_STYLES slug.
    const styleName = (photo.styleUsed && (CAR_STYLES[photo.styleUsed]?.name
      ?? CAR_BACKGROUNDS.find(bg => bg.slug === photo.styleUsed)?.name)) || photo.styleUsed || 'véhicule'
    const prompt = buildSocialCaptionPrompt(styleName, brandKit.businessName ?? undefined, ctaText)
    const caption = await generateText(apiKey, prompt)
    return NextResponse.json({ caption })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[marketing-caption]', msg)
    return NextResponse.json({ error: 'Génération du texte échouée, veuillez réessayer.' }, { status: 500 })
  }
}
