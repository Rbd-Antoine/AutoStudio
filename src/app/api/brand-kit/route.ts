import { NextRequest, NextResponse } from 'next/server'
import { getSessionOrDevBypass } from '@/lib/dev-auth'
import { getWorkspaceSummary } from '@/lib/workspace-summary'
import { saveBrandKit } from '@/lib/brand-kit'
import { uploadBuffer } from '@/lib/blob-storage'
import { normalizeLogo, InvalidImageError, MAX_LOGO_BYTES } from '@/lib/image-validation'

export async function POST(req: NextRequest) {
  const session = await getSessionOrDevBypass()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const summary = await getWorkspaceSummary(session.user.id, session.user.email, session.user.name)
  if (!summary) {
    return NextResponse.json({ error: 'Espace de travail introuvable' }, { status: 404 })
  }

  const formData = await req.formData()
  const businessName = formData.get('businessName')
  const primaryColor = formData.get('primaryColor')
  const logo = formData.get('logo') as File | null

  let logoUrl: string | undefined
  if (logo && logo.size > 0) {
    if (logo.size > MAX_LOGO_BYTES) {
      return NextResponse.json({ error: 'Logo trop volumineux (5 Mo max).' }, { status: 400 })
    }
    let normalized: Awaited<ReturnType<typeof normalizeLogo>>
    try {
      normalized = await normalizeLogo(Buffer.from(await logo.arrayBuffer()))
    } catch (err) {
      if (err instanceof InvalidImageError) return NextResponse.json({ error: err.message }, { status: 400 })
      throw err
    }
    try {
      logoUrl = await uploadBuffer(normalized.buffer, normalized.mimeType, `brand-logo-${summary.workspaceId}-${Date.now()}`)
    } catch (err) {
      // Most often a missing BLOB_READ_WRITE_TOKEN: answer in JSON so the page can show it
      // instead of failing to parse a bare 500.
      console.error('[brand-kit] logo upload failed:', err)
      return NextResponse.json({ error: "Le logo n'a pas pu être enregistré. Réessayez dans quelques instants." }, { status: 503 })
    }
  }

  const brandKit = await saveBrandKit(summary.workspaceId, {
    ...(typeof businessName === 'string' && businessName.trim() ? { businessName: businessName.trim() } : {}),
    ...(typeof primaryColor === 'string' && primaryColor.trim() ? { primaryColor: primaryColor.trim() } : {}),
    ...(logoUrl ? { logoUrl } : {}),
  })

  return NextResponse.json(brandKit)
}
