import { CAR_BACKGROUNDS } from './carBackgrounds'

// Marketing view of the backgrounds the editor actually offers (src/lib/carBackgrounds.ts), so
// the site never advertises a style a customer can't pick. Each image is a real render made
// with that background by the editor's own background swap.
const EMOJI: Record<(typeof CAR_BACKGROUNDS)[number]['slug'], string> = {
  'showroom-lumiere': '☀️',
  'studio-noir': '⬛',
  'studio-blanc': '⬜',
  'showroom-nuit': '✨',
}

export const CAR_STYLES = CAR_BACKGROUNDS.map(bg => ({
  slug: bg.slug,
  name: bg.name,
  emoji: EMOJI[bg.slug],
  desc: bg.desc,
  image: `/styles/${bg.slug}.jpg`,
}))
