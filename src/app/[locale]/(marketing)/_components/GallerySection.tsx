'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  ArrowRight, ChevronLeft, ChevronRight, PlayCircle, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { carImagePath, videoPaths, SHOWCASE_CARS } from '@/lib/showcase-data'
import { CAR_STYLES } from '@/lib/carStyles'
import { TrackedLink } from './TrackedLink'

interface ShowcaseItem { before: string; after: string; video?: string; style: string; desc: string }

const showcaseVideo = videoPaths('voiture-01-demo')

const SHOWCASE: ShowcaseItem[] = SHOWCASE_CARS.map((car, i) => ({
  before: carImagePath(car.id, 'before'),
  after: carImagePath(car.id, 'after'),
  video: i === 0 ? showcaseVideo.mp4 : undefined,
  style: car.styleLabel,
  desc: CAR_STYLES.find(s => s.slug === car.style)?.desc ?? '',
}))

const STYLE_PHOTOS = CAR_STYLES.map(s => ({ src: s.image, style: s.name, desc: s.desc }))

// ─── BEFORE / AFTER SLIDER ───────────────────────────────────────────────────
export function BeforeAfterSlider({
  before, after, className, initialPos = 45,
}: { before: string; after: string; className?: string; initialPos?: number }) {
  const [pos, setPos]           = useState(initialPos)
  const [dragging, setDragging] = useState(false)
  const containerRef            = useRef<HTMLDivElement>(null)

  const updatePos = useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el) return
    const { left, width } = el.getBoundingClientRect()
    setPos(Math.min(97, Math.max(3, ((clientX - left) / width) * 100)))
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft')  { setPos(p => Math.max(3, p - 5)); e.preventDefault() }
    if (e.key === 'ArrowRight') { setPos(p => Math.min(97, p + 5)); e.preventDefault() }
  }, [])

  useEffect(() => {
    if (!dragging) return
    const move = (e: MouseEvent) => updatePos(e.clientX)
    const up   = () => setDragging(false)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup',   up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [dragging, updatePos])

  useEffect(() => {
    if (!dragging) return
    const move = (e: TouchEvent) => { e.preventDefault(); updatePos(e.touches[0].clientX) }
    const end  = () => setDragging(false)
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend',  end)
    return () => { window.removeEventListener('touchmove', move); window.removeEventListener('touchend', end) }
  }, [dragging, updatePos])

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-label="Comparateur avant / après. Utilisez les flèches gauche/droite pour révéler le rendu."
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pos)}
      tabIndex={0}
      className={cn(
        'relative overflow-hidden select-none rounded-3xl border border-charcoal/[0.08] shadow-card bg-white',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2',
        dragging ? 'cursor-ew-resize' : 'cursor-col-resize',
        className,
      )}
      onMouseDown={e => { e.preventDefault(); setDragging(true); updatePos(e.clientX) }}
      onTouchStart={e => { setDragging(true); updatePos(e.touches[0].clientX) }}
      onKeyDown={handleKeyDown}
    >
      {/* AFTER */}
      <Image src={after} alt="Après" fill sizes="(min-width: 1024px) 60vw, 100vw"
        className="object-cover pointer-events-none" />
      <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-lg bg-charcoal/40 backdrop-blur-sm text-xs font-semibold text-white border border-white/20">
        Après ✨
      </div>

      {/* BEFORE — clipped */}
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        <div className="absolute inset-0 h-full" style={{ width: `${10000 / pos}%`, maxWidth: 'none' }}>
          <Image src={before} alt="Avant" fill sizes="(min-width: 1024px) 60vw, 100vw"
            className="object-cover pointer-events-none" />
        </div>
        <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-lg bg-charcoal/40 backdrop-blur-sm text-xs font-semibold text-white border border-white/15"
          style={{ maxWidth: `calc(${pos}% - 1rem)`, overflow: 'hidden', whiteSpace: 'nowrap' }}>
          Avant
        </div>
      </div>

      {/* Divider */}
      <div className="absolute inset-y-0 w-[2px] bg-white shadow-[0_0_16px_rgba(255,255,255,0.9)] pointer-events-none"
        style={{ left: `calc(${pos}% - 1px)` }} />
      {/* Handle */}
      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-11 h-11 rounded-full bg-white shadow-card flex items-center justify-center pointer-events-none z-10"
        style={{ left: `${pos}%` }}>
        <ChevronLeft  className="w-3.5 h-3.5 text-charcoal/70 absolute -left-0.5" strokeWidth={2.5} />
        <ChevronRight className="w-3.5 h-3.5 text-charcoal/70 absolute -right-0.5" strokeWidth={2.5} />
      </div>
    </div>
  )
}

// ─── STYLE PHOTOS STRIP (crossfade) ───────────────────────────────────────────
function StylePhotosStrip() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setActive(a => (a + 1) % STYLE_PHOTOS.length), 4000)
    return () => clearInterval(t)
  }, [paused])

  const goPrev = useCallback(() => {
    setActive(a => (a - 1 + STYLE_PHOTOS.length) % STYLE_PHOTOS.length)
  }, [])
  const goNext = useCallback(() => {
    setActive(a => (a + 1) % STYLE_PHOTOS.length)
  }, [])

  const current = STYLE_PHOTOS[active]

  return (
    <div className="mt-16 pt-14 border-t border-charcoal/[0.06]">
      <div className="text-center max-w-lg mx-auto mb-8">
        <p className="eyebrow mb-3">Tous les décors</p>
        <h3 className="font-display font-bold text-charcoal" style={{ fontSize: 'clamp(1.4rem,2.5vw,1.9rem)' }}>
          Un style pour chaque véhicule.
        </h3>
      </div>

      <div
        className="relative max-w-xl mx-auto aspect-[16/9] rounded-3xl overflow-hidden border border-charcoal/[0.08] shadow-card"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {STYLE_PHOTOS.map((s, i) => (
          <Image
            key={s.style}
            src={s.src}
            alt={s.style}
            fill
            priority={i === 0}
            className={cn(
              'object-cover transition-opacity duration-1000 ease-in-out',
              i === active ? 'opacity-100' : 'opacity-0',
            )}
            sizes="(min-width: 1024px) 576px, 100vw"
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-5 left-5 right-5">
          <p className="text-white font-display font-semibold text-lg">{current.style}</p>
          <p className="text-white/70 text-sm">{current.desc}</p>
        </div>

        <button
          onClick={goPrev}
          aria-label="Style précédent"
          className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-charcoal-800/70 border border-white/[0.15] backdrop-blur flex items-center justify-center text-white hover:bg-charcoal-800/90 hover:border-white/25 transition-all"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={2} />
        </button>
        <button
          onClick={goNext}
          aria-label="Style suivant"
          className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-charcoal-800/70 border border-white/[0.15] backdrop-blur flex items-center justify-center text-white hover:bg-charcoal-800/90 hover:border-white/25 transition-all"
        >
          <ChevronRight className="w-5 h-5" strokeWidth={2} />
        </button>
      </div>

      <div className="flex justify-center gap-2 mt-5">
        {STYLE_PHOTOS.map((s, i) => (
          <button
            key={s.style}
            onClick={() => setActive(i)}
            aria-label={s.style}
            className={cn(
              'h-1.5 rounded-full transition-all',
              i === active ? 'w-6 bg-accent-500' : 'w-1.5 bg-charcoal/15 hover:bg-charcoal/30',
            )}
          />
        ))}
      </div>
    </div>
  )
}

// ─── BEFORE/AFTER GALLERY ─────────────────────────────────────────────────────
// Below this, showing the exact count reads as thin rather than reassuring.
const MIN_WORKSPACE_COUNT_TO_SHOW = 10

export function GallerySection({ workspaceCount }: { workspaceCount: number }) {
  const [active, setActive]       = useState(0)
  const [showVideo, setShowVideo] = useState(false)
  const [paused, setPaused]       = useState(false)
  const item = SHOWCASE[active]

  useEffect(() => {
    if (paused) return
    const t = setInterval(() => {
      setActive(a => (a + 1) % SHOWCASE.length)
      setShowVideo(false)
    }, 30_000)
    return () => clearInterval(t)
  }, [active, paused])

  return (
    <section id="galerie" className="section-pad bg-offwhite pt-40">
      <div className="page-container">
        <div className="grid lg:grid-cols-[1.6fr_1fr] gap-10 lg:gap-16 items-start">

          {/* Image : slider + vignettes */}
          <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
            {showVideo && item.video ? (
              <div className="relative aspect-[4/3] w-full mb-3 rounded-3xl overflow-hidden border border-charcoal/[0.08] shadow-card bg-offwhite">
                <video src={item.video} controls autoPlay preload="none" poster={item.after} className="absolute inset-0 w-full h-full object-cover" />
                <button
                  onClick={() => setShowVideo(false)}
                  className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-charcoal/60 backdrop-blur-sm text-xs font-semibold text-white border border-white/20 hover:bg-charcoal/80 transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Fermer
                </button>
                <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-lg bg-charcoal/50 backdrop-blur-sm border border-white/15">
                  <p className="text-xs font-semibold text-white">{item.style}</p>
                  <p className="text-[11px] text-white/70">{item.desc}</p>
                </div>
              </div>
            ) : (
              <div className="relative mb-3">
                <BeforeAfterSlider
                  key={active}
                  before={item.before}
                  after={item.after}
                  className="aspect-[4/3] w-full"
                  initialPos={25}
                />
                <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-charcoal/50 backdrop-blur-sm border border-white/15 pointer-events-none">
                  <p className="text-xs font-semibold text-white">{item.style}</p>
                  <p className="text-[11px] text-white/70">{item.desc}</p>
                </div>
              </div>
            )}

            {item.video && !showVideo && (
              <button
                onClick={() => setShowVideo(true)}
                className="mb-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-50 border border-accent-200 text-accent-700 text-sm font-medium hover:bg-accent-100 transition-colors"
              >
                <PlayCircle className="w-4 h-4" /> Voir la visite en vidéo
              </button>
            )}

            <div className="grid grid-cols-3 gap-2">
              {SHOWCASE.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setActive(i); setShowVideo(false) }}
                  aria-current={i === active}
                  aria-label={`Voir la transformation ${s.style}`}
                  className={cn(
                    'relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2',
                    i === active
                      ? 'border-accent-500 shadow-accent-sm scale-[1.05]'
                      : 'border-transparent opacity-55 hover:opacity-85 hover:border-accent-300',
                  )}
                >
                  <Image src={s.after} alt={s.style} fill className="object-cover" sizes="80px" />
                  {s.video && (
                    <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-charcoal/60 backdrop-blur-sm flex items-center justify-center">
                      <PlayCircle className="w-3 h-3 text-white" strokeWidth={2.5} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Texte */}
          <div className="lg:pt-4">
            <p className="eyebrow mb-3">Exemples réels</p>
            <h2 className="font-display font-bold text-charcoal mb-5" style={{ fontSize: 'clamp(1.75rem,3.5vw,2.75rem)' }}>
              {SHOWCASE.length} transformations<br /><span className="text-gradient">en 60 secondes.</span>
            </h2>
            <p className="text-charcoal/45 text-[15px] leading-relaxed mb-7">
              Toutes ces transformations ont été générées par AutoStudio à partir d&apos;une simple photo de véhicule.
            </p>

            <TrackedLink href="/signup" ctaId="gallery_cta" label="Essayer gratuitement" location="gallery"
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-accent-500 hover:bg-accent-600 text-white font-bold text-base shadow-accent-sm hover:shadow-accent-md transition-all mb-3">
              Essayer gratuitement
              <ArrowRight className="w-5 h-5" />
            </TrackedLink>
            <p className="text-xs text-charcoal/35 mb-6">Sans carte bancaire · Résultat en 60 secondes</p>

            {!showVideo && (
              <p className="text-xs text-charcoal/30 flex items-center gap-2 mb-6">
                <ChevronLeft className="w-3 h-3" />
                Glissez pour comparer avant / après
                <ChevronRight className="w-3 h-3" />
              </p>
            )}

            <div className="flex items-center gap-3">
              {/* Thumbnails of real renders rather than faces: no customer is pictured here. */}
              <div className="flex -space-x-2.5">
                {SHOWCASE_CARS.map(car => (
                  <div key={car.id} className="relative w-11 h-11 rounded-full ring-2 ring-white bg-accent-100 shrink-0 overflow-hidden">
                    <Image src={carImagePath(car.id, 'thumb')} alt="" fill className="object-cover" sizes="44px" />
                  </div>
                ))}
              </div>
              <p className="text-sm font-semibold text-charcoal">
                {workspaceCount >= MIN_WORKSPACE_COUNT_TO_SHOW
                  ? <>{workspaceCount.toLocaleString('fr-FR')}+ concessions l&apos;utilisent déjà</>
                  : <>Rejoignez les concessions qui utilisent AutoStudio</>}
              </p>
            </div>
          </div>

        </div>

        <StylePhotosStrip />
      </div>
    </section>
  )
}
