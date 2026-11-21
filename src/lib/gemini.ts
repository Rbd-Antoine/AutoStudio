import { buildRetouchPrompt, buildBackgroundSwapPrompt } from './carPrompts'

// Gemini, called over REST (no SDK). Every image of the product goes through callGeminiImage,
// which bounds the call in time, tells refusals from overloads, and retries once when a second
// request has a real chance — the same rules as the sister product Florelis, where each one
// came from a failed customer render.

export interface StyledImage {
  base64: string
  mimeType: string
}

interface ImageInput {
  mimeType: string
  data: string
}

// Every image is drawn by this one model. Nano Banana 2.1 replaced Nano Banana 2
// (gemini-3.1-flash-image) on Florelis on 2026-11-19 after a side-by-side run on real cases:
// closer to the input photo, fewer redraws, about a third of the cost per image. Nano Banana Pro
// (gemini-3-pro-image) lost there: it moved the camera and redrew buildings, at three times the
// cost. To be confirmed on vehicles (badges, plates, wheels) before launch.
export const IMAGE_MODEL = 'gemini-nano-banana-2.1'
const TEXT_MODEL = 'gemini-3.1-flash-lite'
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

// The output frames Gemini accepts. With two input images (the car and the reference
// background) the model no longer infers the frame from "the" photo and may take the
// background's: it has to be told to keep the car photo's framing.
export const ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const
export type AspectRatio = (typeof ASPECT_RATIOS)[number]

/** The supported ratio closest to width:height, compared on a log scale (2:1 and 1:2 equally far from 1:1). */
export function nearestAspectRatio(width?: number, height?: number): AspectRatio | undefined {
  if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return undefined
  const target = Math.log(width / height)
  let best: AspectRatio | undefined
  let bestDistance = Infinity
  for (const ratio of ASPECT_RATIOS) {
    const [w, h] = ratio.split(':').map(Number)
    const distance = Math.abs(Math.log(w / h) - target)
    if (distance < bestDistance) {
      best = ratio
      bestDistance = distance
    }
  }
  return best
}

// Gemini declined the request or produced no image. `userMessage` is said to the dealer as is,
// with a 422, after the credit is refunded.
export class GeminiBlockedError extends Error {
  constructor(readonly reason: string, readonly userMessage: string) {
    super(`Gemini: no image (${reason})`)
    this.name = 'GeminiBlockedError'
  }
}

// Gemini overloaded or out of reach — an HTTP 429 or 5xx, or a connection dropped mid-answer.
// Not about the request: worth one more try, and said to the dealer as such.
export class GeminiUnavailableError extends Error {
  readonly userMessage = "L'IA est très sollicitée en ce moment et n'a pas répondu. Réessayez dans un instant — votre crédit a été restitué."
  constructor(readonly status: number | null, detail: string) {
    super(`Gemini unavailable (${status ?? 'network'}): ${detail}`)
    this.name = 'GeminiUnavailableError'
  }
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])
// A second try needs room: under this, the route's deadline would cut it short anyway.
const MIN_RETRY_MS = 30_000

const SAFETY_REASONS = new Set([
  'SAFETY', 'IMAGE_SAFETY', 'PROHIBITED_CONTENT', 'IMAGE_PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII',
])
const RECITATION_REASONS = new Set(['RECITATION', 'IMAGE_RECITATION'])

// `promptBlocked`: the request itself was refused (promptFeedback.blockReason, where even
// "OTHER" means blocked) — as opposed to a candidate that simply ended without an image.
function blockedError(reason: string, { promptBlocked = false } = {}): GeminiBlockedError {
  if (RECITATION_REASONS.has(reason)) {
    // A manufacturer's press photo or a much-published picture of a model comes back as
    // "recitation": the model refuses to reproduce an image it has seen.
    return new GeminiBlockedError(reason, "L'IA n'a pas pu traiter cette photo : elle ressemble trop à une image déjà publiée (photo constructeur, annonce existante). Utilisez une photo du véhicule prise par vous. Votre crédit a été restitué.")
  }
  if (promptBlocked || SAFETY_REASONS.has(reason)) {
    return new GeminiBlockedError(reason, "L'IA a refusé cette demande : la photo ou la consigne a été jugée sensible (personnes visibles, texte…). Retirez l'élément concerné puis réessayez. Votre crédit a été restitué.")
  }
  return new GeminiBlockedError(reason, "L'IA n'a pas produit d'image cette fois-ci. Réessayez — votre crédit a été restitué.")
}

export function isUnavailableError(err: unknown): err is GeminiUnavailableError {
  return err instanceof GeminiUnavailableError
}

// AbortSignal.timeout() rejects with a DOMException named "TimeoutError".
export function isTimeoutError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'TimeoutError'
}

/** What a failed render is said and counted as: the message for the dealer, the reason for analytics. */
export function describeRenderFailure(err: unknown): { status: number; message: string; reason: 'refused' | 'unavailable' | 'timeout' | 'error' } {
  if (err instanceof GeminiBlockedError) return { status: 422, message: err.userMessage, reason: 'refused' }
  if (err instanceof GeminiUnavailableError) return { status: 503, message: err.userMessage, reason: 'unavailable' }
  if (isTimeoutError(err)) {
    return { status: 504, message: "L'IA a mis trop de temps à répondre. Réessayez — votre crédit a été restitué.", reason: 'timeout' }
  }
  return { status: 500, message: "Le rendu a échoué, aucun crédit n'a été consommé. Veuillez réessayer.", reason: 'error' }
}

type Part = { text: string } | { inline_data: { mime_type: string; data: string } }

interface ResponsePart {
  text?: string
  thought?: boolean
  inlineData?: { data: string; mimeType: string }
}

// An answer that ends normally ("STOP") with no image is the model's whim, not a refusal: the
// same request, replayed, usually comes back with an image. So does a "recitation" (the answer is
// sampled), and an overload: a 503 after two minutes was drawn in fifteen seconds on a second try.
const FLUKE_REASONS = new Set(['STOP', 'NO_IMAGE'])
const RETRIED_REFUSALS = new Set([...FLUKE_REASONS, ...RECITATION_REASONS])

interface ImageCallOptions {
  aspectRatio?: AspectRatio
  /** Bounds the whole call (both tries), well inside the route's maxDuration. */
  timeoutMs?: number
}

async function callGeminiImage(apiKey: string, parts: Part[], opts: ImageCallOptions = {}): Promise<StyledImage> {
  const start = Date.now()
  try {
    return await callGeminiImageOnce(apiKey, parts, opts)
  } catch (err) {
    const left = opts.timeoutMs ? opts.timeoutMs - (Date.now() - start) : Infinity
    const fluke = err instanceof GeminiBlockedError && RETRIED_REFUSALS.has(err.reason) && !(opts.timeoutMs && left < opts.timeoutMs / 2)
    const unavailable = err instanceof GeminiUnavailableError && left >= MIN_RETRY_MS
    if (!fluke && !unavailable) throw err
    console.warn(`[gemini] ${err instanceof GeminiUnavailableError ? `unavailable (${err.status ?? 'network'})` : `no image (${(err as GeminiBlockedError).reason})`}, trying once more`)
    if (unavailable) await new Promise(resolve => setTimeout(resolve, 1500))
    const elapsed = Date.now() - start
    return callGeminiImageOnce(apiKey, parts, { ...opts, timeoutMs: opts.timeoutMs ? opts.timeoutMs - elapsed : undefined })
  }
}

async function callGeminiImageOnce(apiKey: string, parts: Part[], { aspectRatio, timeoutMs }: ImageCallOptions): Promise<StyledImage> {
  const generationConfig: Record<string, unknown> = { responseModalities: ['IMAGE', 'TEXT'] }
  if (aspectRatio) generationConfig.imageConfig = { aspectRatio }

  let data
  try {
    const response = await fetch(`${API_BASE}/${IMAGE_MODEL}:generateContent`, {
      method: 'POST',
      // The key goes in a header, not the URL, so it never ends up in logged request URLs.
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ parts }], generationConfig }),
      // A slow model still lands in the route's catch (which refunds the credit) instead of
      // the function being killed by the platform with the credit taken.
      signal: timeoutMs ? AbortSignal.timeout(Math.max(1, timeoutMs)) : undefined,
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      if (RETRYABLE_STATUS.has(response.status)) throw new GeminiUnavailableError(response.status, errText.slice(0, 300))
      throw new Error(`Gemini API ${response.status}: ${errText.slice(0, 500)}`)
    }

    data = await response.json()
  } catch (err) {
    // A connection dropped while sending or reading — not a timeout, not an answer.
    if (err instanceof TypeError) throw new GeminiUnavailableError(null, err.message)
    throw err
  }

  const blockReason = data?.promptFeedback?.blockReason as string | undefined
  if (blockReason) throw blockedError(blockReason, { promptBlocked: true })

  const candidate = data?.candidates?.[0]
  const responseParts = (candidate?.content?.parts ?? []) as ResponsePart[]
  // Gemini 3 image models can emit interim "thought" images before the final one — keep the
  // last image that isn't one of those.
  const imgPart = [...responseParts].reverse().find(p => p.inlineData?.data && !p.thought)

  if (!imgPart?.inlineData) {
    const modelText = responseParts.filter(p => p.text && !p.thought).map(p => p.text).join(' ').slice(0, 300)
    if (modelText) console.warn('[gemini] no image returned, model said:', modelText)
    throw blockedError((candidate?.finishReason as string | undefined) ?? 'NO_IMAGE')
  }

  return {
    base64: imgPart.inlineData.data,
    mimeType: imgPart.inlineData.mimeType ?? 'image/png',
  }
}

const imagePart = (img: ImageInput): Part => ({ inline_data: { mime_type: img.mimeType, data: img.data } })

export async function retouchImage(
  apiKey: string,
  imageData: string,
  mimeType: string,
  instruction: string,
  opts: ImageCallOptions = {},
): Promise<StyledImage> {
  return callGeminiImage(apiKey, [{ text: buildRetouchPrompt(instruction) }, imagePart({ mimeType, data: imageData })], opts)
}

// Sends the car photo alongside an actual reference background photo (rather than a text
// description) so the model matches that specific scene instead of a generic style category.
// Pass the car photo's aspect ratio: with two images, the model may otherwise take the frame of
// the background.
export async function swapBackground(
  apiKey: string,
  car: ImageInput,
  background: ImageInput,
  characteristics: string | undefined,
  opts: ImageCallOptions = {},
): Promise<StyledImage> {
  return callGeminiImage(apiKey, [{ text: buildBackgroundSwapPrompt(characteristics) }, imagePart(car), imagePart(background)], opts)
}

// Plain text completion (no image in/out) — used for the Marketing Kit's social-post caption.
export async function generateText(apiKey: string, prompt: string, { timeoutMs = 30_000 }: { timeoutMs?: number } = {}): Promise<string> {
  const response = await fetch(`${API_BASE}/${TEXT_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gemini API ${response.status}: ${errText.slice(0, 500)}`)
  }

  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined
  if (!text) throw new Error('Gemini n\'a renvoyé aucun texte')
  return text.trim()
}

// A text-model call constrained to a JSON schema, for structured readings (the photo check).
// Returns the parsed JSON, or null when the call failed, timed out or answered something
// unparsable — callers validate the shape themselves, and none of them may fail a render over it.
// Ported from Florelis, where it reads plans, palettes and render checks.
export async function generateJson(
  apiKey: string,
  parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }>,
  responseSchema: Record<string, unknown>,
  { timeoutMs = 30_000, temperature = 0, model = TEXT_MODEL }: { timeoutMs?: number; temperature?: number; model?: string } = {},
): Promise<unknown> {
  try {
    const response = await fetch(`${API_BASE}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseMimeType: 'application/json', responseSchema, temperature },
      }),
    })
    if (!response.ok) {
      console.warn(`[gemini] JSON call failed: ${response.status} ${(await response.text()).slice(0, 300)}`)
      return null
    }
    const data = await response.json()
    const text = (data?.candidates?.[0]?.content?.parts as ResponsePart[] | undefined)?.find(p => p.text && !p.thought)?.text
    return typeof text === 'string' ? JSON.parse(text) : null
  } catch (err) {
    console.warn('[gemini] JSON call failed:', err instanceof Error ? err.message : err)
    return null
  }
}
