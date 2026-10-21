export interface CarStyle {
  name: string
  description: string
  keywords: string
  elements: string
}

export const CAR_STYLES: Record<string, CarStyle> = {
  'studio-blanc': {
    name: 'Studio Blanc',
    description: 'a seamless white studio cyclorama background, like a professional automotive catalog shoot, with soft even lighting and a subtle graduated shadow under the car.',
    keywords: 'clean seamless white backdrop, soft studio lighting, catalog-ready',
    elements: 'infinity white cyclorama, soft box lighting reflections, faint contact shadow',
  },
  'showroom': {
    name: 'Showroom',
    description: 'a premium indoor dealership showroom with a polished reflective floor, soft architectural spotlighting, and glass walls typical of a high-end car dealership.',
    keywords: 'polished floor reflections, warm spotlighting, premium indoor showroom feel',
    elements: 'glossy polished concrete or tile floor, ceiling spotlights, glass storefront, subtle reflections of the car on the floor',
  },
  'urbain': {
    name: 'Urbain',
    description: 'a modern city street backdrop with softly blurred contemporary architecture, clean pavement, and natural daylight, giving a lifestyle "in the city" feel.',
    keywords: 'soft bokeh city background, contemporary buildings, natural daylight',
    elements: 'blurred modern street architecture, clean asphalt or pavement, soft daylight shadows',
  },
  'route-panoramique': {
    name: 'Route Panoramique',
    description: 'an open scenic road background with a wide dramatic landscape (mountains, coastline, or countryside) suited to premium and performance vehicles.',
    keywords: 'wide open road, dramatic scenic backdrop, premium travel feel',
    elements: 'open asphalt road, distant scenic landscape, golden-hour or bright daylight sky',
  },
  'parking-concession': {
    name: 'Devant la Concession',
    description: 'the paved forecourt in front of a clean, modern dealership building, with branded architecture visible but not overwhelming, in natural daylight.',
    keywords: 'dealership forecourt, modern branded architecture, natural daylight',
    elements: 'clean paved lot, modern dealership facade in soft focus, flagpoles or signage kept generic and unreadable',
  },
  'nuit-neon': {
    name: 'Ambiance Nocturne',
    description: 'a dramatic night scene with city lights or neon reflections, moody premium lighting that highlights the car\'s silhouette and paint.',
    keywords: 'night city lights, moody premium lighting, dramatic reflections',
    elements: 'soft neon or streetlight bokeh, dark blue-black night sky, subtle rim lighting on the car body',
  },
}

export function buildBackgroundSwapPrompt(characteristics?: string) {
  const userText = characteristics?.trim() || 'Aucune demande particulière.'

  return `You will receive two images. IMAGE 1 is a vehicle photo. IMAGE 2 is a reference
background/scene photo.

TASK: Replace the background of IMAGE 1 with the exact scene shown in IMAGE 2. This is a
BACKGROUND REPLACEMENT ONLY — the vehicle itself must remain completely untouched.

SCENE: Keep the exact camera angle, framing, and perspective of IMAGE 1. Segment the
vehicle precisely and replace only what is behind and around it with the scene from
IMAGE 2 — the ground plane directly under the car may be adapted to match that scene, but
the vehicle's position, size, and pose in frame must stay identical.

MOOD: Photorealistic, professional automotive photography — not illustrative, not
stylized, not cartoon-like. Match the lighting and perspective of IMAGE 2 as closely as
possible while keeping the result fully believable as an unedited photo.

USER CHARACTERISTICS (optional, provided by the dealer):
"${userText}"
→ Incorporate these requests as closely as possible without conflicting with the
constraints below.

CONSTRAINTS (always apply):
- Never alter the vehicle itself: body panels, paint color and finish, wheels, glass,
  badges, lights, and the license plate must be pixel-identical to IMAGE 1 in shape and
  detail — only relighting/color-grading them to match the new scene's ambient light and
  reflections is allowed, never structural changes.
- Do not add, remove, or move any part of the vehicle, and never invent or alter text on
  badges, plates, or dealership markings.
- Generate realistic contact shadows and, where the scene calls for it, plausible
  reflections of the vehicle on the new ground surface — mismatched or missing shadows
  break the illusion immediately.
- Never place the vehicle in a physically implausible position (floating, wrong scale
  relative to the new background, tilted ground plane that doesn't match its wheels).
- No hallucinated people, other vehicles, or logos in the new background unless already
  present in IMAGE 1 or IMAGE 2.

OUTPUT: a single photorealistic image, same resolution/aspect ratio as IMAGE 1, showing
the vehicle from IMAGE 1 placed believably into the scene from IMAGE 2.`
}

export function buildRetouchPrompt(instruction: string) {
  return `Edit this already-rendered vehicle photo with one specific, targeted change.

INSTRUCTION FROM THE USER:
"${instruction.trim()}"

SCOPE: Apply only the change described above. Keep everything else in the image —
camera angle, framing, the vehicle itself, background, lighting, and overall composition
— exactly as it is in the provided image.

MOOD: Match the photorealistic style, lighting, and quality already present in the
source image. The edit must blend in seamlessly, as if it were part of the original
rendering.

CONSTRAINTS:
- Do not regenerate or restyle areas unrelated to the instruction.
- Never alter the vehicle's body panels, paint, wheels, glass, badges, or license plate
  unless the instruction explicitly asks for it.
- No hallucinated objects, impossible proportions, or elements that would break the
  dealer's trust in the rendering.

OUTPUT: a single photorealistic image, same resolution/aspect ratio as the input image.`
}

export function buildSocialCaptionPrompt(styleName: string, businessName?: string, ctaText?: string) {
  return `Tu es community manager pour une concession automobile.

Écris une légende Instagram/Facebook courte (3 à 5 phrases maximum), professionnelle et
engageante, pour accompagner une vidéo présentant un véhicule mis en valeur dans un style
"${styleName}".
${businessName ? `\nLa concession s'appelle "${businessName}".` : ''}
${ctaText ? `\nTermine par un appel à l'action reprenant l'idée : "${ctaText}".` : ''}

Ajoute ensuite, sur une ligne séparée, 4 à 6 hashtags pertinents en français (automobile,
concession, vente de voitures, occasion/neuf selon le contexte, etc.).

Réponds uniquement avec le texte de la légende et les hashtags, sans introduction ni
commentaire, sans guillemets autour du texte.`
}
