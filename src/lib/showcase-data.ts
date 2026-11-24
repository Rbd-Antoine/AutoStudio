// Typed catalog for the marketing showcase assets under public/showcase/ — components read
// this file instead of hardcoding paths in JSX.

import type { CarBackground } from './carBackgrounds'

export type CarStyleSlug = CarBackground['slug']

export interface ShowcaseCar {
  id: string
  /** Standard landscape photo ratio — every sample uses the same 4:3 framing. */
  beforeAspect: { width: number; height: number }
  /** The background these older samples were rendered on: the editor's former set, kept as made. */
  style: string
  styleLabel: string
}

export const SHOWCASE_CARS: ShowcaseCar[] = [
  { id: 'voiture-01', beforeAspect: { width: 4, height: 3 }, style: 'garage-neon',        styleLabel: 'Garage néon' },
  { id: 'voiture-02', beforeAspect: { width: 4, height: 3 }, style: 'hangar-industriel',  styleLabel: 'Hangar industriel' },
  { id: 'voiture-03', beforeAspect: { width: 4, height: 3 }, style: 'parking-souterrain', styleLabel: 'Parking souterrain' },
  { id: 'voiture-04', beforeAspect: { width: 4, height: 3 }, style: 'piece-vide',         styleLabel: 'Pièce vide moderne' },
]

export function carImagePath(carId: string, variant: 'before' | 'after' | 'thumb'): string {
  return `/showcase/voitures/${carId}/${variant}.webp`
}

export interface ShowcaseVideo {
  name: string
  carId: string
  aspect: '16:9' | '9:16' | '1:1'
  width: number
  height: number
  durationSeconds: number
}

export const SHOWCASE_VIDEOS: ShowcaseVideo[] = [
  { name: 'voiture-01-demo', carId: 'voiture-01', aspect: '16:9', width: 1280, height: 720, durationSeconds: 6 },
]

export function videoPaths(name: string) {
  return {
    mp4: `/showcase/videos/${name}.mp4`,
    poster: `/showcase/videos/${name}-poster.jpg`,
  }
}
