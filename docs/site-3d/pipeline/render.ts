// Real AutoStudio renders for the home page and the guides, made the way the product makes them:
// the car photo + the editor's reference background + the product's own prompt
// (src/lib/carPrompts.ts), sent to Gemini. Every call is recorded in gemini-ledger.json with a
// cautious cost estimate, and no call starts once the budget is spent.
//
//   npx tsx docs/site-3d/pipeline/render.ts <car> <decor> [--model=<id>] [--size=1K|2K] [--tag=x]
//   npx tsx docs/site-3d/pipeline/render.ts --spent
//   npx tsx docs/site-3d/pipeline/render.ts --scene=<name> [--tag=x]   (an empty scene from SCENES,
//     text only: the sample "own background" of a dealer, for the custom-background demo)
//
// <car>: voiture-01..04 (public/showcase/voitures/<car>/before.webp) or a path to a photo.
// <decor>: garage-neon | hangar-industriel | parking-souterrain | piece-vide
// Output: docs/site-3d/pipeline/renders/<car>__<decor>__<model>__<tag>.png (not committed).
// The key is read from .env (GEMINI_API_KEY) and never printed.
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import sharp from 'sharp'
import { buildBackgroundSwapPrompt } from '../../../src/lib/carPrompts'
import { CAR_BACKGROUNDS } from '../../../src/lib/carBackgrounds'

dotenv.config({ quiet: true })

const ROOT = process.cwd()
const HERE = path.join(ROOT, 'docs/site-3d/pipeline')
const LEDGER = path.join(HERE, 'gemini-ledger.json')
const OUT = path.join(HERE, 'renders')
/** The budget the user gave for this work (2026-11-22), with a margin kept back. */
const BUDGET_EUR = 3
const STOP_AT_EUR = 2.9
/** Cautious: Florelis measured about 0.05 EUR per image with the previous model; the newer one is cheaper. */
const EST_EUR_PER_IMAGE = 0.05

// Empty scenes generated from text, standing in for a dealer's own background photo in the demo.
// Generic on purpose: no brand, no sign, no car.
const SCENES: Record<string, string> = {
  showroom: 'A photograph of an empty, modern independent car dealership showroom in France, shot at eye level from the entrance: large glass front on the left with soft daylight, light grey polished concrete floor, white walls with warm wood slat panels on the back wall, a small reception desk far in the background, recessed ceiling lights. No cars, no people, no logos, no text, no signs, no brand names anywhere. Realistic photo, 4:3, natural colours, sharp, wide empty floor space in the centre where a car could be parked.',
}

interface Entry { at: string; model: string; size: string; car: string; decor: string; tag: string; ok: boolean; estEur: number; usage?: unknown; note?: string }

function ledger(): Entry[] {
  return fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : []
}
const spent = () => ledger().reduce((sum, e) => sum + e.estEur, 0)

async function jpegBase64(file: string, maxSide = 1600): Promise<string> {
  const buf = await sharp(file).rotate().resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer()
  return buf.toString('base64')
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--spent')) {
    const l = ledger()
    console.log(`${l.length} appels, ${spent().toFixed(3)} EUR estimés sur ${BUDGET_EUR} EUR (réussis : ${l.filter(e => e.ok).length})`)
    return
  }
  const opt = (k: string, d: string) => args.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? d
  const scene = opt('scene', '')
  const [car, decor] = scene ? ['scene', scene] : args.filter(a => !a.startsWith('--'))
  const model = opt('model', 'gemini-nano-banana-2.1')
  const size = opt('size', '2K')
  const tag = opt('tag', '1')
  const bg = CAR_BACKGROUNDS.find(b => b.slug === decor)
  if (scene && !SCENES[scene]) throw new Error(`scène inconnue : ${scene}`)
  if (!scene && (!car || !bg)) throw new Error('usage: render.ts <car> <decor> [--model=] [--size=] [--tag=]')
  if (spent() + EST_EUR_PER_IMAGE > STOP_AT_EUR) throw new Error(`budget atteint : ${spent().toFixed(2)} EUR estimés`)
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY absent de .env')

  const carFile = car.includes('/') || car.includes('\\') ? car : path.join(ROOT, 'public/showcase/voitures', car, 'before.webp')
  const carName = scene ? 'scene' : path.basename(car.includes('/') ? path.dirname(carFile) : car)
  const parts = scene ? [{ text: SCENES[scene] }] : [
    { text: buildBackgroundSwapPrompt() },
    { inline_data: { mime_type: 'image/jpeg', data: await jpegBase64(carFile) } },
    { inline_data: { mime_type: 'image/jpeg', data: await jpegBase64(path.join(ROOT, 'public', bg!.image)) } },
  ]
  const generationConfig: Record<string, unknown> = { responseModalities: ['IMAGE', 'TEXT'], imageConfig: { aspectRatio: '4:3', ...(size ? { imageSize: size } : {}) } }

  const started = Date.now()
  const entry: Entry = { at: new Date().toISOString(), model, size, car: carName, decor, tag, ok: false, estEur: EST_EUR_PER_IMAGE }
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts }], generationConfig }),
      signal: AbortSignal.timeout(200_000),
    })
    const data = await res.json()
    entry.usage = data?.usageMetadata
    if (!res.ok) {
      entry.note = `HTTP ${res.status}: ${JSON.stringify(data?.error?.message ?? data).slice(0, 200)}`
      // A refused request (4xx before generation) is most likely not billed; kept cautious anyway.
      if (res.status === 400 || res.status === 404) entry.estEur = 0
      throw new Error(entry.note)
    }
    const partsOut = (data?.candidates?.[0]?.content?.parts ?? []) as Array<{ inlineData?: { data: string; mimeType: string }; thought?: boolean }>
    const img = [...partsOut].reverse().find(p => p.inlineData?.data && !p.thought)
    if (!img?.inlineData) {
      entry.note = `pas d'image (${data?.candidates?.[0]?.finishReason ?? 'inconnu'})`
      throw new Error(entry.note)
    }
    fs.mkdirSync(OUT, { recursive: true })
    const file = path.join(OUT, `${carName}__${decor}__${model}__${tag}.png`)
    fs.writeFileSync(file, Buffer.from(img.inlineData.data, 'base64'))
    const meta = await sharp(file).metadata()
    entry.ok = true
    entry.note = `${meta.width}x${meta.height}, ${((Date.now() - started) / 1000).toFixed(0)} s`
    console.log(`OK ${path.relative(ROOT, file)} ${entry.note}`)
  } finally {
    fs.writeFileSync(LEDGER, JSON.stringify([...ledger(), entry], null, 2))
    console.log(`dépense estimée : ${spent().toFixed(3)} EUR / ${BUDGET_EUR} EUR`)
  }
}

main().catch(err => { console.error('ÉCHEC', err instanceof Error ? err.message : err); process.exit(1) })
