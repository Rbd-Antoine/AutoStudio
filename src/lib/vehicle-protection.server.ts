import sharp from 'sharp'

/**
 * Optional vehicle protection: the car comes back exactly as photographed in the render.
 *
 * Contract version 2 (docs/vehicle-protection.md): POST {imageBase64, generatedImageBase64,
 * mimeType} to VEHICLE_PROTECTION_URL; the provider (services/vehicle-protection, a GPU service
 * on Modal) returns {version: 2, imageBase64}, the render with the vehicle restored from the
 * photo, in the render's own frame and resolution. It does the alignment (a small shift is
 * corrected, a moved car refused), leaves the glass to the render (the new scene shows through
 * the windows), and matches the photo's colour grade to the new light, clamped so the paint
 * colour never changes. Adapted from Florelis's house protection.
 *
 * A request that changes the vehicle itself (hide the plate, other wheels, another colour) turns
 * protection off for that render: it would paste the original back over the change.
 *
 * With no configured provider, or on any failure, the render is returned unchanged.
 */
const MAX_IMAGE_BASE64 = 12 * 1024 * 1024
const MAX_RESULT_BASE64 = 24 * 1024 * 1024
/** Never longer than this, whatever the route has left. */
const MAX_TIMEOUT_MS = 90_000
/** Below this, a cold provider cannot answer: not worth the call. */
const MIN_TIMEOUT_MS = 15_000

export type VehicleProtectionSkip =
  | 'not_configured'
  | 'request_targets_vehicle'
  | 'no_time'
  | 'framing'
  | 'provider'
  | 'invalid_result'

/** Plain JSON, so the diagnostics can be stored as they are in Photo.generationInput. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

export interface VehicleProtectionResult {
  image: Buffer
  mimeType: string
  protected: boolean
  skipped?: VehicleProtectionSkip
  reason?: string
  diagnostics?: { [key: string]: Json }
}

function providerUrl(): URL | null {
  const raw = process.env.VEHICLE_PROTECTION_URL?.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      console.warn('[vehicle-protection] provider URL must use HTTPS')
      return null
    }
    return url
  } catch {
    console.warn('[vehicle-protection] invalid provider URL')
    return null
  }
}

export function vehicleProtectionConfigured(): boolean {
  return providerUrl() !== null
}

function authHeaders(): Record<string, string> {
  const token = process.env.VEHICLE_PROTECTION_TOKEN
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * Starts the GPU container while Gemini draws (20 s and more), so the cold start is mostly
 * hidden by the time the render is ready. Fire and forget: a failure only means a slower call.
 */
export function warmVehicleProtection(): void {
  const url = providerUrl()
  if (!url) return
  const warmup = new URL(url)
  warmup.pathname = warmup.pathname.replace(/\/segment\/?$/, '/warmup')
  if (warmup.pathname === url.pathname) return
  fetch(warmup, { method: 'POST', headers: authHeaders(), signal: AbortSignal.timeout(MAX_TIMEOUT_MS) })
    .catch(() => {})
}

// Words a dealer uses when the vehicle itself is to change. Accents and case are ignored; the
// list errs on the side of switching off: an unprotected render is today's behaviour, a request
// undone is a lost credit.
const VEHICLE_CHANGE = [
  // French
  'plaque', 'immatriculation', 'flouter', 'masquer', 'cacher', 'jante', 'roue', 'pneu', 'couleur de la voiture',
  'couleur du vehicule', 'couleur de la carrosserie', 'peinture', 'repeindre', 'carrosserie', 'logo', 'badge',
  'sigle', 'calandre', 'retroviseur', 'phare', 'vitre teintee', 'teinter', 'rayure', 'bosse', 'enlever le',
  'retirer le', 'supprimer le', 'nettoyer', 'lustrer', 'briller', 'reflet',
  // English
  'plate', 'license', 'licence', 'blur', 'hide', 'wheel', 'rim', 'tyre', 'tire', 'paint', 'colour of the car',
  'color of the car', 'bodywork', 'logo', 'grille', 'mirror', 'headlight', 'tint', 'scratch', 'dent', 'remove the',
]

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`]/g, '\'').toLowerCase()
}

/** Whether the dealer's characteristics ask to change the vehicle itself, not only the scene. */
export function requestTargetsVehicle(requests: string | null | undefined): boolean {
  if (!requests?.trim()) return false
  const text = normalize(requests)
  return VEHICLE_CHANGE.some(term => new RegExp(`(^|[^a-z])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(text))
}

/** The time the protection call may take, from what the route has left; null to skip it. */
export function protectionTimeout(remainingMs: number): number | null {
  const timeout = Math.min(MAX_TIMEOUT_MS, remainingMs)
  return timeout >= MIN_TIMEOUT_MS ? timeout : null
}

/**
 * Restores the photographed vehicle in the generated render. Never throws: any refusal or
 * failure returns the render untouched, with the reason, so the route can record it.
 */
export async function protectVehicle(
  original: Buffer,
  generated: { data: Buffer; mimeType: string },
  options: { mimeType?: string; requests?: string | null; remainingMs: number },
): Promise<VehicleProtectionResult> {
  const unchanged = (skipped: VehicleProtectionSkip, reason?: string): VehicleProtectionResult =>
    ({ image: generated.data, mimeType: generated.mimeType, protected: false, skipped, reason })

  const url = providerUrl()
  if (!url) return unchanged('not_configured')
  if (requestTargetsVehicle(options.requests)) return unchanged('request_targets_vehicle')
  const timeoutMs = protectionTimeout(options.remainingMs)
  if (timeoutMs === null) return unchanged('no_time')

  try {
    const [originalMeta, generatedMeta] = await Promise.all([
      sharp(original).rotate().metadata(),
      sharp(generated.data).metadata(),
    ])
    if (!originalMeta.width || !originalMeta.height || !generatedMeta.width || !generatedMeta.height) {
      return unchanged('invalid_result', 'image dimensions unavailable')
    }
    // EXIF orientations 5 to 8 swap width and height.
    const rotated = (originalMeta.orientation ?? 1) >= 5
    const sourceRatio = rotated ? originalMeta.height / originalMeta.width : originalMeta.width / originalMeta.height
    const generatedRatio = generatedMeta.width / generatedMeta.height
    // Gemini answers in the nearest supported frame (4:3, 3:2…): a few percent off is normal and
    // the provider's alignment absorbs it; beyond, the picture was reframed.
    if (Math.abs(sourceRatio - generatedRatio) / sourceRatio > 0.05) {
      return unchanged('framing', 'render framing differs from the photo')
    }

    const imageBase64 = original.toString('base64')
    const generatedImageBase64 = generated.data.toString('base64')
    if (imageBase64.length > MAX_IMAGE_BASE64 || generatedImageBase64.length > MAX_IMAGE_BASE64) {
      return unchanged('provider', 'image exceeds provider payload limit')
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ imageBase64, generatedImageBase64, mimeType: options.mimeType ?? 'image/jpeg' }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) {
      const detail = await response.json().then((b: { detail?: unknown }) => String(b.detail ?? ''), () => '')
      // 422 is the provider refusing on purpose (car moved, no vehicle found).
      return unchanged(response.status === 422 && /viewpoint|alignment|stable points|features/i.test(detail) ? 'framing' : 'provider',
        `HTTP ${response.status}${detail ? `: ${detail}` : ''}`)
    }

    const payload = await response.json() as { version?: unknown; imageBase64?: unknown; diagnostics?: unknown }
    if (payload.version !== 2 || typeof payload.imageBase64 !== 'string'
      || payload.imageBase64.length === 0 || payload.imageBase64.length > MAX_RESULT_BASE64) {
      return unchanged('invalid_result', 'unexpected provider response')
    }
    const image = Buffer.from(payload.imageBase64, 'base64')
    const resultMeta = await sharp(image).metadata()
    // The provider works in the render's frame: anything else would shift the whole picture.
    if (resultMeta.width !== generatedMeta.width || resultMeta.height !== generatedMeta.height) {
      return unchanged('invalid_result', 'result size differs from the render')
    }
    const diagnostics = payload.diagnostics && typeof payload.diagnostics === 'object' && !Array.isArray(payload.diagnostics)
      ? payload.diagnostics as { [key: string]: Json }
      : undefined
    return { image, mimeType: 'image/png', protected: true, diagnostics }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    console.warn('[vehicle-protection] skipped; keeping the generated image:', reason)
    return unchanged('provider', reason)
  }
}
