// The whole home page is one scene: a studio set up in an old garage, around one real car.
// A single scroll progress p (0 → 1) decides everything on screen — camera, light, decor,
// readability — through the pure function sceneAt(). The canvas renders it, the reduced-motion
// fallback picks its still images from it, and the text never computes anything of its own.
//
// Scene coordinates are the pixels of the source frame (1200 × 900): the real AutoStudio render
// of voiture-01 and its aligned customer photo (public/site-3d, made by
// docs/site-3d/pipeline/prepare_assets.py).

export const SCENE_W = 1200
export const SCENE_H = 900

export const CHAPTERS = ['avant', 'studio', 'fonds', 'tarifs', 'contact'] as const
export type ChapterId = (typeof CHAPTERS)[number]

/** The four backgrounds of the editor (src/lib/carBackgrounds.ts), in the same order. */
export const DECORS = ['garage-neon', 'hangar-industriel', 'parking-souterrain', 'piece-vide'] as const
export type DecorSlug = (typeof DECORS)[number]

/** A box of the scene that the camera must keep in view, and how it shares the screen. */
interface Shot {
  box: [number, number, number, number] // x0, y0, x1, y1 in scene pixels
  /** On wide screens, the share of the width left of the box for the text column (0 = centred). */
  text: number
  /** The picture fills the screen: the view never leaves it at the top, bottom or right (the
   *  left, behind the text, may fade into darkness). Off for the pulled-back final shot. */
  fill?: boolean
  /** With `fill`: the most of the scene's height the view may show (beyond 1, the floor below the
   *  picture: a blurred reflection on glossy floors, darkness on the parking's asphalt). */
  maxH?: number
}

// One stop per chapter: the camera rests there while the chapter is read, and glides between.
// On wide screens the box is fitted into the part of the screen right of the text column, so
// the car never runs under the words, the chapter rail or off the edge.
const SHOTS: Record<ChapterId, Shot> = {
  avant:   { box: [80, 140, 1160, 840], text: 0.37, fill: true, maxH: 1.0 },
  studio:  { box: [-60, -20, 1260, 920], text: 0.35, fill: true, maxH: 1.16 },
  fonds:   { box: [190, 210, 1060, 770], text: 0.44, fill: true, maxH: 1.14 },
  // Pricing: the garage's ceiling and lights, high above the car, behind the dimmed columns.
  tarifs:  { box: [140, -260, 1060, 250], text: 0.0 },
  // The end: the camera pulls far back, the garage small in the dark, to the right of the text.
  contact: { box: [-300, -180, 1500, 1080], text: 0.42 },
}

// The studio's lights, in the order they come on (chapter 2). Positions read on the real render:
// the two vertical neons, the back then the front ceiling panels, the inner neon on the right.
export type Light =
  | { kind: 'segment'; a: [number, number]; b: [number, number]; radius: number; tint: [number, number, number] }
  | { kind: 'point'; at: [number, number]; radius: number; tint: [number, number, number] }

export const LIGHTS: Light[][] = [
  [{ kind: 'segment', a: [59, 142], b: [59, 643], radius: 210, tint: [0.62, 0.7, 1.0] }],
  [{ kind: 'segment', a: [1131, 139], b: [1131, 642], radius: 210, tint: [0.62, 0.7, 1.0] }],
  [
    { kind: 'point', at: [446, 132], radius: 260, tint: [1, 1, 1] },
    { kind: 'point', at: [752, 132], radius: 260, tint: [1, 1, 1] },
    { kind: 'point', at: [600, 195], radius: 220, tint: [1, 1, 1] },
  ],
  [
    { kind: 'point', at: [396, 40], radius: 330, tint: [1, 0.98, 0.95] },
    { kind: 'point', at: [802, 40], radius: 330, tint: [1, 0.98, 0.95] },
  ],
  [{ kind: 'segment', a: [874, 269], b: [874, 379], radius: 160, tint: [0.62, 0.7, 1.0] }],
]

export interface SceneState {
  /** Camera: scene point at the centre of the screen, and scene pixels per screen pixel. */
  camera: { cx: number; cy: number; viewW: number; viewH: number }
  /** 0 = the customer's parking photo, 1 = the studio. */
  studio: number
  /** Intensity of each light group (0 → 1), with a short overshoot as a tube strikes. */
  lights: number[]
  /** Overall light of the studio (0 = lights off, 1 = the real render as delivered). */
  ambient: number
  /** How much the decor gives way to the chosen background (chapter 3 onwards). */
  decorSwap: number
  /** Darkening for text readability (chapters 4 and 5), 0 → 1. */
  dim: number
  /** 1 when the camera has pulled back (chapter 5): every edge of the picture fades softly. */
  pull: number
  /** Light on the car itself: in the dark between the two worlds, back to full in the studio. */
  carLight: number
  /** Parallax: how far the background slides against the car, in scene pixels. */
  parallax: [number, number]
  chapter: ChapterId
  /** Progress inside the current chapter, 0 → 1. */
  local: number
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** A strike curve: fast rise, a little overshoot, settles at 1 (a tube that comes on). */
function strike(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  const rise = smooth(0, 0.45, t)
  const bump = Math.sin(Math.min(1, t / 0.7) * Math.PI) * 0.18 * (1 - smooth(0.6, 1, t))
  return rise + bump
}

/** Share of the screen width kept free on the right for the chapter rail (wide screens). */
const RAIL = 0.05

/** The view (scene pixels) that keeps `shot.box` in view on a screen of this aspect ratio. */
function frame(shot: Shot, aspect: number, wide: boolean) {
  const [x0, y0, x1, y1] = shot.box
  const bw = x1 - x0
  const bh = y1 - y0
  // The part of the screen the box may use: right of the text column on wide screens.
  const left = wide ? shot.text : 0
  const right = wide && shot.text > 0 ? RAIL : 0
  const usable = 1 - left - right
  // "Contain": the whole box stays visible inside the usable part; the rest shows more scene.
  let viewW = bw / usable
  let viewH = viewW / aspect
  if (viewH < bh) {
    viewH = bh
    viewW = bh * aspect
  }
  // The box's centre lands at the centre of the usable part.
  const screenX = left + usable / 2
  let cx = (x0 + x1) / 2 - (screenX - 0.5) * viewW
  let cy = (y0 + y1) / 2
  if (shot.fill && wide) {
    // At most a little past the bottom of the picture: the floor then fades into darkness like
    // a studio sweep, and the car keeps a comfortable size.
    const maxH = SCENE_H * (shot.maxH ?? 1.1)
    if (viewH > maxH) {
      viewW *= maxH / viewH
      viewH = maxH
      // Re-centred with the narrower view, or the box would drift towards the right edge.
      cx = (x0 + x1) / 2 - (screenX - 0.5) * viewW
    }
    // Full bleed: the picture runs to the right edge of the screen (the chapter rail is on the
    // left, over the dark side); only the text side fades.
    cx = Math.min(cx, SCENE_W - viewW / 2)
    cy = Math.max(cy, viewH / 2) // the top edge stays inside the picture
  }
  return { cx, cy, viewW, viewH }
}

/**
 * Everything the scene shows at progress p (0 → 1) on a screen of this aspect ratio.
 * `wide`: a text column beside the subject (desktop) rather than over it (mobile).
 */
export function sceneAt(p: number, aspect: number, wide: boolean): SceneState {
  const x = clamp01(p) * CHAPTERS.length
  const index = Math.min(CHAPTERS.length - 1, Math.floor(x))
  const local = x - index
  const chapter = CHAPTERS[index]

  // Camera: rests on the chapter's shot for most of it, glides to the next one near the end.
  const here = frame(SHOTS[chapter], aspect, wide)
  const nextId = CHAPTERS[Math.min(CHAPTERS.length - 1, index + 1)]
  const there = frame(SHOTS[nextId], aspect, wide)
  const glide = index < CHAPTERS.length - 1 ? smooth(0.74, 1, local) : 0
  const camera = {
    cx: lerp(here.cx, there.cx, glide),
    cy: lerp(here.cy, there.cy, glide),
    viewW: lerp(here.viewW, there.viewW, glide),
    viewH: lerp(here.viewH, there.viewH, glide),
  }
  // A slow drift while a chapter is read, so the scene breathes even when the camera rests.
  const drift = (local - 0.5) * 0.035
  camera.viewW *= 1 - drift
  camera.viewH *= 1 - drift

  // Chapter 1 → 2: the parking dies out (lights off), the studio appears in the dark, then its
  // lights strike one after the other. The car never moves.
  const sx = p * CHAPTERS.length // 0..5
  const studio = smooth(0.78, 1.08, sx)
  const blackout = smooth(0.7, 0.95, sx) * (1 - smooth(1.05, 1.25, sx))
  const lights = LIGHTS.map((_, i) => {
    // The five groups strike between 8 % and 62 % of the chapter: all lit well before the camera
    // leaves for chapter 3.
    const start = 1.08 + i * 0.1
    return strike((sx - start) / 0.14)
  })
  const lit = lights.reduce((sum, v) => sum + Math.min(1, v), 0) / LIGHTS.length
  const ambient = sx < 1 ? 1 : clamp01(0.06 + 0.94 * smooth(0.15, 1, lit))
  const carLight = sx < 1 ? 1 - 0.82 * blackout : lerp(0.22, 1, smooth(0.1, 0.9, lit))

  // Chapter 3 onwards: the chosen background takes over the decor.
  const decorSwap = smooth(2.0, 2.25, sx)
  // Chapters 4 and 5: the scene steps back behind the content.
  // Pricing reads over a scene almost put out; the ending lights it again a little, far away.
  const dim = smooth(2.85, 3.15, sx) * 0.58 - smooth(3.85, 4.15, sx) * 0.28
  const pull = smooth(2.85, 3.15, sx)

  const parallax: [number, number] = [
    (camera.cx - SCENE_W / 2) * 0.035,
    (camera.cy - SCENE_H / 2) * 0.02,
  ]

  return { camera, studio, lights, ambient, decorSwap, dim, pull, carLight: clamp01(carLight), parallax, chapter, local }
}

/** The still image that stands for a chapter (reduced motion, loading, no WebGL). */
export function stillFor(chapter: ChapterId, decor: DecorSlug): string {
  if (chapter === 'avant') return '/site-3d/still-avant.webp'
  if (chapter === 'studio') return '/site-3d/still-studio.webp'
  return `/site-3d/still-${decor}.webp`
}
