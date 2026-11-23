import sharp from 'sharp'

// The dealer's logo on a render. Placed by code after the AI has drawn the image, never asked of
// the model: an image model redraws a logo approximately (wrong letters, wrong colours), and a
// dealer's mark must come out exactly as uploaded in the brand kit.

export const LOGO_CORNERS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'] as const
export type LogoCorner = (typeof LOGO_CORNERS)[number]

export function isLogoCorner(v: unknown): v is LogoCorner {
  return typeof v === 'string' && (LOGO_CORNERS as readonly string[]).includes(v)
}

/** The logo's bytes, from the brand kit's stored URL (a Blob URL, or a data URI fallback). */
async function loadLogo(logoUrl: string): Promise<Buffer> {
  if (logoUrl.startsWith('data:')) {
    const comma = logoUrl.indexOf(',')
    if (comma < 0) throw new Error('Logo illisible')
    return Buffer.from(logoUrl.slice(comma + 1), 'base64')
  }
  if (!/^https:\/\//.test(logoUrl)) throw new Error('Adresse du logo invalide')
  const res = await fetch(logoUrl, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Logo inaccessible (${res.status})`)
  return Buffer.from(await res.arrayBuffer())
}

/**
 * Composites the logo in a corner of the render: at most 18 % of the width and 12 % of the
 * height, with a margin of 3 % of the width. SVG logos are rasterised at that size. Returns a PNG.
 */
export async function applyLogo(imageBase64: string, logoUrl: string, corner: LogoCorner): Promise<{ base64: string; mimeType: 'image/png' }> {
  const image = sharp(Buffer.from(imageBase64, 'base64'))
  const { width = 0, height = 0 } = await image.metadata()
  if (!width || !height) throw new Error('Rendu illisible pour le logo')

  const boxW = Math.round(width * 0.18)
  const boxH = Math.round(height * 0.12)
  const logo = await sharp(await loadLogo(logoUrl), { density: 300 })
    .resize({ width: boxW, height: boxH, fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer({ resolveWithObject: true })

  const margin = Math.round(width * 0.03)
  const left = corner.endsWith('left') ? margin : width - margin - logo.info.width
  const top = corner.startsWith('top') ? margin : height - margin - logo.info.height

  const out = await image.composite([{ input: logo.data, left, top }]).png().toBuffer()
  return { base64: out.toString('base64'), mimeType: 'image/png' }
}
