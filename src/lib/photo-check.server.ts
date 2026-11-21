import sharp from 'sharp'
import { generateJson } from './gemini'

// A photo with no vehicle in it (a document, a screenshot, a picture of the showroom only) used to
// be charged a credit, then rendered into nonsense. A small, cheap reading by the text model
// (well under a thousandth of a euro, a couple of seconds) now refuses it before any credit is
// taken. It only ever refuses on a clear "no vehicle": a failed, slow or unsure reading lets the
// render go ahead as before — this check must never stand between a dealer and a real car photo.

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    vehicle_present: { type: 'BOOLEAN' },
    is_photograph: { type: 'BOOLEAN' },
  },
  required: ['vehicle_present', 'is_photograph'],
}

const PROMPT = `You check a picture uploaded to a tool that replaces the background behind a vehicle.
Answer in JSON:
- vehicle_present: true if at least one road vehicle (car, SUV, van, pickup, truck, motorcycle)
  is clearly visible as a main subject, even partly; false only if there is clearly none.
- is_photograph: true for a real photograph, false for a drawing, a document or a screenshot of text.`

/** Downscaled before sending: the question needs no detail, and a smaller image answers faster. */
const CHECK_SIDE = 768
const CHECK_TIMEOUT_MS = 8_000

export type PhotoCheck =
  | { ok: true; checked: boolean }
  | { ok: false; reason: 'no_vehicle'; message: string }

export const NO_VEHICLE_MESSAGE =
  "Aucun véhicule n'a été reconnu sur cette photo : aucun crédit n'a été consommé. Importez une photo où la voiture est bien visible."

/** Whether the photo may be rendered. `checked: false` = the reading did not answer (allowed). */
export async function checkVehiclePhoto(apiKey: string, base64: string): Promise<PhotoCheck> {
  let small: Buffer
  try {
    small = await sharp(Buffer.from(base64, 'base64'))
      .rotate()
      .resize({ width: CHECK_SIDE, height: CHECK_SIDE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer()
  } catch {
    return { ok: true, checked: false } // HEIC on a sharp build without it: not readable here
  }

  const answer = await generateJson(
    apiKey,
    [{ text: PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: small.toString('base64') } }],
    SCHEMA,
    { timeoutMs: CHECK_TIMEOUT_MS },
  ) as { vehicle_present?: unknown; is_photograph?: unknown } | null

  if (!answer || typeof answer.vehicle_present !== 'boolean') return { ok: true, checked: false }
  if (answer.vehicle_present === false) return { ok: false, reason: 'no_vehicle', message: NO_VEHICLE_MESSAGE }
  return { ok: true, checked: true }
}
