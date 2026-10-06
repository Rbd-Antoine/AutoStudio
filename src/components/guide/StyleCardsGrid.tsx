import Image from 'next/image'
import { CAR_STYLES } from '@/lib/carStyles'

const AUDIENCE: Record<string, string> = {
  'garage-neon':        'Sportives, véhicules premium, publications sur les réseaux sociaux',
  'hangar-industriel':  'Utilitaires, SUV et 4x4 — un rendu brut et sérieux',
  'parking-souterrain': 'Citadines et berlines — sobre, crédible, cohérent sur tout un stock',
  'piece-vide':         'Annonces façon catalogue : fond clair, le véhicule au centre',
}

export function StyleCardsGrid() {
  return (
    <div className="not-prose grid sm:grid-cols-2 gap-3 my-6">
      {CAR_STYLES.map((style) => (
        <div key={style.slug} className="rounded-2xl border border-charcoal/[0.08] bg-offwhite p-4 flex gap-3">
          <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-charcoal/[0.06]">
            <Image src={style.image} alt={style.name} fill className="object-cover" sizes="64px" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-charcoal text-[15px] mb-1">{style.name}</h3>
            <p className="text-[13.5px] text-charcoal/60 leading-relaxed mb-2">{style.desc}</p>
            <p className="text-[12px] text-accent-700 font-medium">{AUDIENCE[style.slug]}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
