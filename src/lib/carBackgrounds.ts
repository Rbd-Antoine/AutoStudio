// The editor's four backgrounds. Since 2026-11-24, premium empty showrooms and studios generated
// for AutoStudio (docs/site-3d/pipeline/render.ts --scene=fond-*), so their rights are clear; the
// former ones (neon garage, hangar, car park, empty room) looked cheap. Each image is sent to the
// model as the scene to put the car in (buildBackgroundSwapPrompt).
export const CAR_BACKGROUNDS = [
  {
    slug: 'showroom-lumiere',
    name: 'Showroom lumière',
    desc: 'Showroom vitré, sol de pierre clair, lumière du jour',
    image: '/background/showroom-lumiere.jpg',
  },
  {
    slug: 'studio-noir',
    name: 'Studio noir',
    desc: 'Studio photo, fond noir infini, grande boîte à lumière',
    image: '/background/studio-noir.jpg',
  },
  {
    slug: 'studio-blanc',
    name: 'Studio blanc',
    desc: 'Cyclorama blanc, lumière douce, rendu catalogue',
    image: '/background/studio-blanc.jpg',
  },
  {
    slug: 'showroom-nuit',
    name: 'Showroom du soir',
    desc: 'Béton ciré, bois et éclairages LED chaleureux',
    image: '/background/showroom-nuit.jpg',
  },
] as const

export type CarBackground = (typeof CAR_BACKGROUNDS)[number]
