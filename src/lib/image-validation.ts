import sharp from 'sharp'

// Uploads are typed from their own bytes, never from the mimeType the client sends: the
// original is stored on the public Blob store with that type, so trusting the client would let
// anyone host arbitrary content (an HTML page, say) under the app's storage.

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 // the editor's "jusqu'à 20 Mo"

export type PhotoMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic' | 'image/heif'

export class InvalidImageError extends Error {}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx']
const HEIF_BRANDS = ['mif1', 'msf1', 'heif']

export function sniffImageType(buffer: Buffer): PhotoMimeType | null {
  if (buffer.length < 12) return null
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png'
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  // HEIC/HEIF (iPhone photos): an ISO-BMFF `ftyp` box whose major brand names the format.
  if (buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12)
    if (HEIC_BRANDS.includes(brand)) return 'image/heic'
    if (HEIF_BRANDS.includes(brand)) return 'image/heif'
  }
  return null
}

// Checks a base64 photo from a request body and returns its real type. Only the first 12 bytes
// (16 base64 characters) are decoded: the signature is all the sniffing needs.
export function base64PhotoType(base64: unknown, maxBytes = MAX_UPLOAD_BYTES): PhotoMimeType {
  if (typeof base64 !== 'string' || base64.length === 0) throw new InvalidImageError('Image manquante.')
  if (Math.floor(base64.length * 3 / 4) > maxBytes) throw new InvalidImageError('Image trop volumineuse (20 Mo max).')
  const mimeType = sniffImageType(Buffer.from(base64.slice(0, 16), 'base64'))
  if (!mimeType) throw new InvalidImageError('Ce fichier n\'est pas une image. Formats acceptés : JPG, PNG, WEBP, HEIC.')
  return mimeType
}

export const MAX_LOGO_BYTES = 5 * 1024 * 1024

// Logos are kept as PNG/JPEG/WEBP. An SVG is rasterized to PNG: the stored file then carries no
// script, and the marketing-video renderer gets a format it reliably draws.
export async function normalizeLogo(buffer: Buffer): Promise<{ buffer: Buffer; mimeType: 'image/png' | 'image/jpeg' | 'image/webp' }> {
  if (buffer.length > MAX_LOGO_BYTES) throw new InvalidImageError('Logo trop volumineux (5 Mo max).')
  const sniffed = sniffImageType(buffer)
  if (sniffed === 'image/png' || sniffed === 'image/jpeg' || sniffed === 'image/webp') return { buffer, mimeType: sniffed }

  const head = buffer.subarray(0, 1024).toString('utf8')
  if (/<svg[\s>]/i.test(head) || (/^\s*(<\?xml|<!--)/.test(head) && /<svg[\s>]/i.test(buffer.toString('utf8')))) {
    try {
      const png = await sharp(buffer, { density: 300 })
        .resize({ width: 1024, height: 1024, fit: 'inside' })
        .png()
        .toBuffer()
      return { buffer: png, mimeType: 'image/png' }
    } catch {
      throw new InvalidImageError('Ce SVG n\'a pas pu être lu.')
    }
  }
  throw new InvalidImageError('Format de logo non supporté (PNG, JPG, WEBP ou SVG).')
}
