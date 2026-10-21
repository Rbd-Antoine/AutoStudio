'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TrackedLink } from './TrackedLink'
import { carImagePath, SHOWCASE_CARS } from '@/lib/showcase-data'

// One generated photo, shown cropped into the three formats a dealer actually needs to post
// (feed, story/reel, square) — same image, no separate render per ratio needed.
const KIT_CAR_ID = 'voiture-01'
const KIT_FORMATS: { label: string; aspectClass: string }[] = [
  { label: 'Reel · 9:16',  aspectClass: 'w-[172px] aspect-[9/16]' },
  { label: 'Story · 9:16', aspectClass: 'w-[172px] aspect-[9/16]' },
  { label: 'Carré · 1:1',  aspectClass: 'w-[306px] aspect-square' },
]

// Real before/after examples across the sample vehicles, shown as static image cards rather
// than one video per format — keeps this row honest about what's actually generated (see
// showcase-data.ts SHOWCASE_CARS) instead of implying a video exists for every one.
const REAL_EXAMPLES: { carId: string; label: string; aspectClass: string }[] = SHOWCASE_CARS.map(car => ({
  carId: car.id,
  label: car.styleLabel,
  aspectClass: 'w-[280px] aspect-video',
}))

// Not shared with AiContentSection.tsx's own copy of this same hook shape — Phase 3's brief
// only listed this file, so the de-duplication flagged in the Phase 1 report is deferred
// rather than touching that file out of scope here.
function useRevealOnScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (visible || !ref.current) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { rootMargin: '-80px' },
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { ref, visible }
}

// Plays only while >=50% in view, pauses on exit — not a one-shot "seen once" flag like the
// other lazy-mount hooks in this codebase, since this genuinely starts/stops repeatedly as the
// user scrolls (and, on mobile, as the snap-carousel moves between cards). Every card on this
// page — both rows — goes through this same hook, so both are muted/no-audio-control alike;
// there is no per-card sound toggle anywhere in this section.
function FormatCard({ imageSrc, label, aspectClass }: { imageSrc: string; label: string; aspectClass: string }) {
  return (
    <div
      className={cn(
        'relative shrink-0 rounded-2xl overflow-hidden border border-charcoal/[0.08] shadow-card bg-offwhite snap-center',
        aspectClass,
      )}
    >
      <Image src={imageSrc} alt={label} fill sizes="320px" className="object-cover" />
      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-charcoal/50 backdrop-blur-sm text-[11px] font-semibold text-white border border-white/15">
        {label}
      </div>
    </div>
  )
}

export function MarketingKit() {
  const { ref: sectionRef, visible } = useRevealOnScroll<HTMLDivElement>()

  return (
    <section id="kit-marketing" className="section-pad bg-offwhite">
      <div
        ref={sectionRef}
        className={cn(
          'page-container transition-all duration-700 ease-out',
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
        )}
      >
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-50 border border-accent-200 text-accent-600 text-xs font-bold uppercase tracking-wider mb-5">
            Nouveau
          </div>
          <h2 className="font-display font-bold text-charcoal mb-5" style={{ fontSize: 'clamp(1.9rem,3.8vw,2.9rem)', lineHeight: 1.12 }}>
            Le kit marketing, <span className="text-gradient">généré en un clic</span>
          </h2>
          <p className="text-charcoal/50 text-[15px] leading-relaxed">
            À partir de la même photo, AutoStudio produit le visuel avant/après déjà décliné aux
            formats des réseaux — vous n&apos;avez rien à recadrer ni remonter.
          </p>
        </div>

        {/* Row 1: the mechanism — one photo becomes three real-ratio formats side by side.
            Desktop: three blocks side by side. Mobile: stacked, kit becomes a snap-scroll row. */}
        <div className="flex flex-col md:flex-row md:items-center gap-8 md:gap-6">
          {/* 1. Starting photo — small, static */}
          <div className="md:w-[140px] shrink-0 mx-auto md:mx-0">
            <div className="relative w-[140px] aspect-[4/3] rounded-2xl overflow-hidden border border-charcoal/[0.08] shadow-card">
              <Image
                src={carImagePath(KIT_CAR_ID, 'before')}
                alt="Photo de départ du véhicule"
                fill
                sizes="140px"
                className="object-cover"
              />
            </div>
            <p className="text-center text-xs text-charcoal/40 mt-2">Votre photo de départ</p>
          </div>

          {/* 2. Discreet connector — real measured delay, not invented */}
          <div className="flex md:flex-col items-center justify-center gap-2 text-center shrink-0 md:w-[100px]">
            <ArrowRight className="w-5 h-5 text-accent-400 shrink-0 md:rotate-0" />
            <p className="text-xs text-charcoal/40 leading-snug">
              Généré par l&apos;IA<br />en environ une minute
            </p>
          </div>

          {/* 3. The kit — same photo, cropped to the formats dealers actually post */}
          <div className="flex-1 min-w-0">
            <div className="flex gap-4 overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none pb-2 md:pb-0 justify-start md:justify-center items-end">
              {KIT_FORMATS.map(f => (
                <FormatCard key={f.label} imageSrc={carImagePath(KIT_CAR_ID, 'after')} label={f.label} aspectClass={f.aspectClass} />
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: real before/after examples across the sample vehicles, showing the range of
            styles rather than the single-photo mechanism above. */}
        <div className="mt-14 lg:mt-16">
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-50 border border-accent-200 text-accent-600 text-xs font-bold uppercase tracking-wider">
              Exemples réels
            </div>
          </div>
          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 justify-start items-end">
            {REAL_EXAMPLES.map(ex => (
              <div key={ex.carId} className="flex flex-col gap-2 shrink-0">
                <FormatCard imageSrc={carImagePath(ex.carId, 'after')} label={ex.label} aspectClass={ex.aspectClass} />
                <p className="text-center text-xs text-charcoal/40">{ex.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 lg:mt-16 text-center max-w-xl mx-auto">
          <h3 className="font-display font-bold text-charcoal mb-6" style={{ fontSize: 'clamp(1.4rem,2.6vw,2rem)' }}>
            Photographiez une fois, publiez partout.
          </h3>
          <p className="text-charcoal/45 text-sm leading-relaxed mb-8">
            Kit entièrement personnalisable : votre logo, votre couleur de marque, votre texte
            de fin et votre musique.
          </p>
          <TrackedLink href="/signup" ctaId="marketing_kit_section" label="Essayer le kit marketing" location="marketing_kit_section"
            className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-accent-500 hover:bg-accent-600 text-white font-bold text-base shadow-accent-sm hover:shadow-accent-md transition-all">
            Essayer le kit marketing
            <ArrowRight className="w-5 h-5" />
          </TrackedLink>
        </div>
      </div>
    </section>
  )
}
