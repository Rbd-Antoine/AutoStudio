'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import RouteLink from 'next/link'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import { TrackedLink } from '../_components/TrackedLink'
import { CHAPTERS, DECORS, stillFor, type ChapterId, type DecorSlug } from './scene'
import { display, sans } from './fonts'

// The 3D scene loads after the text: the page reads before a single texture arrives.
const StudioCanvas = dynamic(() => import('./StudioCanvas'), { ssr: false })

export interface StudioPlan {
  id: 'FREE' | 'ESSENTIAL' | 'PRO' | 'BUSINESS'
  price: number
  credits: number
  promoPrice?: number
  promoLabel?: string
}

// Palette (DESIGN.md): night, concrete, steel, chalk, ash, and one accent, tungsten.
const C = {
  night: '#0C0D0F',
  concrete: '#1A1C1F',
  steel: '#2A2D31',
  chalk: '#ECE8E1',
  ash: '#9A968E',
  tungsten: '#F2A93B',
}

const DISPLAY = 'font-[family-name:var(--font-studio-display)] uppercase tracking-[-0.01em]'

function useMedia(query: string, fallback = false) {
  const [match, setMatch] = useState(fallback)
  useEffect(() => {
    const m = window.matchMedia(query)
    const on = () => setMatch(m.matches)
    on()
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [query])
  return match
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl') || c.getContext('experimental-webgl'))
  } catch {
    return false
  }
}

export function StudioLanding({ plans }: { plans: StudioPlan[] }) {
  const t = useTranslations('studio')
  const locale = useLocale()
  const progress = useRef(0)
  const decorRef = useRef<DecorSlug>('garage-neon')
  const [decor, setDecor] = useState<DecorSlug>('garage-neon')
  const [chapter, setChapter] = useState<ChapterId>('avant')
  const [canvasReady, setCanvasReady] = useState(false)
  const [webgl, setWebgl] = useState<boolean | null>(null)
  const reduced = useMedia('(prefers-reduced-motion: reduce)')
  const small = useMedia('(max-width: 767px)')
  const sections = useRef<(HTMLElement | null)[]>([])

  useEffect(() => setWebgl(hasWebGL()), [])

  // The page's only animated value: where the reader is, from 0 (top) to 1 (end of chapter 5).
  useEffect(() => {
    let ticking = false
    const update = () => {
      ticking = false
      const centre = window.scrollY + window.innerHeight * 0.5
      const els = sections.current
      let p = 0
      for (let i = 0; i < els.length; i++) {
        const el = els[i]
        if (!el) continue
        const top = el.offsetTop
        const h = el.offsetHeight
        if (centre < top + h || i === els.length - 1) {
          p = (i + Math.min(1, Math.max(0, (centre - top) / h))) / els.length
          break
        }
      }
      progress.current = p
      const id = CHAPTERS[Math.min(CHAPTERS.length - 1, Math.floor(p * CHAPTERS.length))]
      setChapter(prev => (prev === id ? prev : id))
    }
    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(update)
      }
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  const pickDecor = useCallback((slug: DecorSlug) => {
    decorRef.current = slug
    setDecor(slug)
  }, [])
  const onReady = useCallback(() => setCanvasReady(true), [])

  const live = webgl === true && !reduced
  const still = stillFor(chapter, decor)
  const fmt = (n: number) => new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  return (
    <div
      className={cn(display.variable, sans.variable, 'relative font-[family-name:var(--font-studio-sans)] antialiased')}
      style={{ background: C.night, color: C.chalk }}
    >
      <a href="#avant" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[120] focus:rounded focus:px-3 focus:py-2" style={{ background: C.tungsten, color: C.night }}>
        {t('nav.skip')}
      </a>

      <StudioHeader chapter={chapter} />

      {/* The scene: fixed behind the whole page. Still images first (and for reduced motion), the
          live canvas fades in over them once its textures are in. */}
      <div className="fixed inset-0 z-0 overflow-hidden" aria-hidden="true" style={{ background: C.night }}>
        {(!live || !canvasReady) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={still}
            src={still}
            alt=""
            fetchPriority="high"
            className={cn('absolute inset-0 h-full w-full transition-opacity duration-500', small ? 'object-contain object-[50%_30%]' : 'object-cover object-[70%_50%]')}
          />
        )}
        {live && (
          <div className={cn('absolute inset-0 transition-opacity duration-700', canvasReady ? 'opacity-100' : 'opacity-0')}>
            <StudioCanvas progress={progress} decor={decorRef} light={small} onReady={onReady} />
          </div>
        )}
        {/* Readability: a dark band under the text column (left on desktop, bottom on mobile). */}
        <div className="absolute inset-0 hidden md:block" style={{ background: `linear-gradient(90deg, ${C.night}F5 0%, ${C.night}EB 30%, ${C.night}A6 42%, transparent 60%)` }} />
        {/* The top of the picture (ceiling lights, sky) quietened under the header. */}
        <div className="absolute inset-x-0 top-0 h-32" style={{ background: `linear-gradient(180deg, ${C.night}C7 0%, ${C.night}66 50%, transparent 100%)` }} />
        <div className="absolute inset-x-0 bottom-0 h-[62%] md:hidden" style={{ background: `linear-gradient(0deg, ${C.night} 0%, ${C.night}F0 38%, transparent 100%)` }} />
      </div>

      <ChapterRail chapter={chapter} />

      <div className="relative z-10">
        {/* 01 — Avant */}
        <section id="avant" ref={el => { sections.current[0] = el }} className="relative" style={{ height: '170vh' }}>
          <ChapterText eyebrow={t('avant.eyebrow')} title={t('avant.title')} body={t('avant.body')} first>
            <ScrollHint label={t('scrollHint')} />
          </ChapterText>
        </section>

        {/* 02 — Le studio */}
        <section id="studio" ref={el => { sections.current[1] = el }} className="relative" style={{ height: '260vh' }}>
          <ChapterText eyebrow={t('studio.eyebrow')} title={t('studio.title')} body={t('studio.body')}>
            <p className="mt-5 max-w-[30rem] border-l pl-4 text-sm leading-relaxed" style={{ borderColor: C.tungsten, color: C.ash }}>
              {t('studio.note')}
            </p>
          </ChapterText>
        </section>

        {/* 03 — Les fonds */}
        <section id="fonds" ref={el => { sections.current[2] = el }} className="relative" style={{ height: '210vh' }}>
          <ChapterText eyebrow={t('fonds.eyebrow')} title={t('fonds.title')} body={t('fonds.body')}>
            <DecorPicker decor={decor} onPick={pickDecor} />
          </ChapterText>
        </section>

        {/* 04 — Tarifs */}
        <section id="tarifs" ref={el => { sections.current[3] = el }} className="relative min-h-[150vh] px-4 sm:px-8 lg:px-16 py-[18vh]">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-medium uppercase tracking-[0.22em]" style={{ color: C.tungsten }}>{t('tarifs.eyebrow')}</p>
            <h2 className={cn(DISPLAY, 'mt-4 font-extrabold leading-[0.9]')} style={{ fontSize: 'clamp(2.75rem, 7vw, 6rem)' }}>{t('tarifs.title')}</h2>
            <p className="mt-5 max-w-[34rem] text-base leading-relaxed sm:text-lg" style={{ color: C.ash }}>{t('tarifs.body')}</p>
            <div className="mt-12 grid gap-px overflow-hidden rounded-sm sm:grid-cols-2 lg:grid-cols-4" style={{ background: C.steel }}>
              {plans.map(plan => {
                const featured = plan.id === 'ESSENTIAL'
                const price = plan.promoPrice ?? plan.price
                return (
                  <div key={plan.id} className="relative flex flex-col p-7" style={{ background: `${C.concrete}F2` }}>
                    {featured && <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: C.tungsten }} />}
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className={cn(DISPLAY, 'text-3xl font-bold')}>{t(`tarifs.plans.${plan.id}.name`)}</h3>
                      {featured && <span className="text-[11px] font-medium uppercase tracking-[0.16em]" style={{ color: C.tungsten }}>{t('tarifs.popular')}</span>}
                    </div>
                    <div className="mt-6 flex flex-wrap items-baseline gap-x-2">
                      {plan.promoPrice !== undefined && <span className="text-lg line-through" style={{ color: C.ash }}>{fmt(plan.price)}</span>}
                      <span className="text-5xl font-semibold tabular-nums tracking-tight">{price > 0 ? fmt(price) : t('tarifs.free')}</span>
                      {price > 0 && <span className="text-sm" style={{ color: C.ash }}>{t('tarifs.perMonth')}</span>}
                      {plan.promoPrice !== undefined && (
                        <span className="w-full text-xs" style={{ color: C.tungsten }}>{plan.promoLabel ? `${plan.promoLabel} · ` : ''}{t('tarifs.firstYear')}</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm tabular-nums" style={{ color: C.chalk }}>{t('tarifs.credits', { count: plan.credits })}</p>
                    <ul className="mt-6 flex flex-1 flex-col gap-2.5 border-t pt-6 text-sm" style={{ borderColor: C.steel, color: C.ash }}>
                      {(t.raw(`tarifs.plans.${plan.id}.features`) as string[]).map(f => (
                        <li key={f} className="flex gap-3"><span aria-hidden="true" style={{ color: C.tungsten }}>—</span>{f}</li>
                      ))}
                    </ul>
                    <TrackedLink
                      href={plan.id === 'FREE' ? '/signup' : `/signup?plan=${plan.id.toLowerCase()}`}
                      ctaId={`pricing_studio_${plan.id.toLowerCase()}`}
                      label={plan.id === 'FREE' ? t('tarifs.ctaFree') : t('tarifs.ctaPaid')}
                      location="pricing_studio"
                      className="mt-8 rounded-sm px-4 py-3 text-center text-sm font-semibold transition-colors duration-200"
                      style={featured ? { background: C.tungsten, color: C.night } : { border: `1px solid ${C.steel}`, color: C.chalk }}
                    >
                      {plan.id === 'FREE' ? t('tarifs.ctaFree') : t('tarifs.ctaPaid')}
                    </TrackedLink>
                  </div>
                )
              })}
            </div>
            <Link href="/pricing" className="mt-6 inline-block text-sm underline underline-offset-4 transition-colors hover:text-[#F2A93B]" style={{ color: C.ash }}>
              {t('tarifs.details')}
            </Link>
          </div>
        </section>

        {/* 05 — Contact */}
        <section id="contact" ref={el => { sections.current[4] = el }} className="relative px-4 sm:px-8 lg:px-16 pt-[16vh] pb-[14vh]">
          <div className="mx-auto max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.22em]" style={{ color: C.tungsten }}>{t('contact.eyebrow')}</p>
            <h2 className={cn(DISPLAY, 'mt-4 font-extrabold leading-[0.9]')} style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}>{t('contact.title')}</h2>
            <Faq items={t.raw('contact.faq') as { q: string; a: string }[]} />
          </div>
          <div className="mx-auto mt-[14vh] max-w-6xl border-t pt-14 text-center" style={{ borderColor: C.steel }}>
            <h2 className={cn(DISPLAY, 'font-extrabold leading-[0.88]')} style={{ fontSize: 'clamp(3rem, 9vw, 8rem)' }}>{t('contact.ctaTitle')}</h2>
            <p className="mt-5 text-base sm:text-lg" style={{ color: C.ash }}>{t('contact.ctaBody')}</p>
            <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <TrackedLink href="/signup" ctaId="studio_final" label={t('contact.ctaButton')} location="studio_contact"
                className="rounded-sm px-8 py-4 text-base font-semibold transition-transform duration-200 hover:-translate-y-0.5"
                style={{ background: C.tungsten, color: C.night }}>
                {t('contact.ctaButton')}
              </TrackedLink>
              <Link href="/contact" className="px-4 py-3 text-sm underline underline-offset-4 hover:text-[#F2A93B]" style={{ color: C.ash }}>
                {t('contact.write')}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function ChapterText({ eyebrow, title, body, children, first }: { eyebrow: string; title: string; body: string; children?: React.ReactNode; first?: boolean }) {
  return (
    <div className="sticky top-0 flex h-screen items-end px-4 pb-10 sm:px-8 md:pb-[12vh] lg:px-16">
      <div className="max-w-[31rem]">
        <p className="text-xs font-medium uppercase tracking-[0.22em]" style={{ color: C.tungsten }}>{eyebrow}</p>
        {first
          ? <h1 className={cn(DISPLAY, 'mt-4 font-extrabold leading-[0.9]')} style={{ fontSize: 'clamp(2.75rem, 6vw, 5.5rem)' }}>{title}</h1>
          : <h2 className={cn(DISPLAY, 'mt-4 font-extrabold leading-[0.9]')} style={{ fontSize: 'clamp(2.75rem, 6vw, 5.5rem)' }}>{title}</h2>}
        <p className="mt-5 text-base leading-relaxed sm:text-lg" style={{ color: C.ash }}>{body}</p>
        {children}
      </div>
    </div>
  )
}

function ScrollHint({ label }: { label: string }) {
  return (
    <div className="mt-10 flex items-center gap-3 text-xs uppercase tracking-[0.22em]" style={{ color: C.ash }}>
      <span className="relative block h-10 w-px overflow-hidden" style={{ background: C.steel }}>
        <span className="absolute inset-x-0 top-0 block h-1/2 motion-safe:animate-[studio-scroll_1.8s_ease-in-out_infinite]" style={{ background: C.tungsten }} />
      </span>
      {label}
      <style>{`@keyframes studio-scroll { 0% { transform: translateY(-100%) } 100% { transform: translateY(200%) } }`}</style>
    </div>
  )
}

function DecorPicker({ decor, onPick }: { decor: DecorSlug; onPick: (slug: DecorSlug) => void }) {
  const t = useTranslations('studio.fonds')
  return (
    <div className="mt-8">
      <p id="decor-label" className="text-xs font-medium uppercase tracking-[0.22em]" style={{ color: C.ash }}>{t('pick')}</p>
      <div role="radiogroup" aria-labelledby="decor-label" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {DECORS.map(slug => {
          const active = slug === decor
          return (
            <button
              key={slug}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onPick(slug)}
              className="group relative overflow-hidden rounded-sm text-left transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ outlineColor: C.tungsten, boxShadow: active ? `0 0 0 2px ${C.tungsten}` : `0 0 0 1px ${C.steel}` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/site-3d/thumb-${slug}.webp`} alt="" width={160} height={120} loading="lazy" className="block aspect-[4/3] w-full object-cover" />
              <span className="block px-2.5 py-2 text-[13px] font-medium leading-tight" style={{ background: C.concrete, color: active ? C.chalk : C.ash }}>
                {t(`decors.${slug}.name`)}
                <span className="mt-0.5 block text-[10px] uppercase tracking-[0.14em]" style={{ color: active ? C.tungsten : C.ash }}>
                  {slug === 'garage-neon' ? t('real') : t('illustration')}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-4 max-w-[32rem] text-xs leading-relaxed" style={{ color: C.ash }}>{t('honesty')}</p>
    </div>
  )
}

function Faq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="mt-10 border-t" style={{ borderColor: C.steel }}>
      {items.map((item, i) => (
        <div key={i} className="border-b" style={{ borderColor: C.steel, background: `${C.night}B3` }}>
          <h3>
            <button
              type="button"
              id={`studio-faq-${i}`}
              aria-expanded={open === i}
              aria-controls={`studio-faq-panel-${i}`}
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-start justify-between gap-6 py-5 text-left text-base font-medium sm:text-lg"
              style={{ color: open === i ? C.chalk : '#CFCAC1' }}
            >
              {item.q}
              <span aria-hidden="true" className="mt-1 text-xl leading-none transition-transform duration-200" style={{ color: C.tungsten, transform: open === i ? 'rotate(45deg)' : 'none' }}>+</span>
            </button>
          </h3>
          {open === i && (
            <p id={`studio-faq-panel-${i}`} role="region" aria-labelledby={`studio-faq-${i}`} className="max-w-[44rem] pb-6 text-[15px] leading-relaxed" style={{ color: C.ash }}>
              {item.a}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function ChapterRail({ chapter }: { chapter: ChapterId }) {
  const t = useTranslations('studio.nav')
  return (
    <nav aria-label={t('label')} className="fixed right-4 top-1/2 z-20 hidden -translate-y-1/2 lg:block">
      <ol className="flex flex-col gap-4 [text-shadow:0_1px_6px_rgba(0,0,0,0.9)]">
        {CHAPTERS.map((id, i) => {
          const active = id === chapter
          return (
            <li key={id}>
              <a href={`#${id}`} aria-current={active ? 'step' : undefined} className="group flex items-center justify-end gap-3 text-[11px] uppercase tracking-[0.2em]">
                <span className="opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100" style={{ color: active ? C.chalk : C.ash }}>{t(id)}</span>
                <span className="tabular-nums" style={{ color: active ? C.tungsten : C.ash }}>{String(i + 1).padStart(2, '0')}</span>
                <span className="block h-px transition-all duration-300" style={{ width: active ? 28 : 12, background: active ? C.tungsten : C.steel }} />
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function StudioHeader({ chapter }: { chapter: ChapterId }) {
  const t = useTranslations('studio.nav')
  return (
    <header className="fixed inset-x-0 top-0 z-30" style={{ background: `linear-gradient(180deg, ${C.night}E6, ${C.night}00)` }}>
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-8 lg:px-16">
        <Link href="/" aria-label={t('home')} className={cn(DISPLAY, 'text-2xl font-extrabold tracking-[0.02em]')}>
          Auto<span style={{ color: C.tungsten }}>Studio</span>
        </Link>
        <nav aria-label={t('label')} className="hidden items-center gap-6 md:flex">
          {CHAPTERS.slice(1).map(id => (
            <a key={id} href={`#${id}`} className="text-sm transition-colors hover:text-[#ECE8E1]" style={{ color: chapter === id ? C.chalk : C.ash }}>{t(id)}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-4">
          <RouteLink href="/signin" className="hidden px-2 py-2 text-sm sm:block" style={{ color: C.ash }}>{t('signIn')}</RouteLink>
          <TrackedLink href="/signup" ctaId="studio_header" label={t('cta')} location="studio_header"
            className="rounded-sm px-4 py-2.5 text-sm font-semibold" style={{ background: C.tungsten, color: C.night }}>
            {t('cta')}
          </TrackedLink>
        </div>
      </div>
    </header>
  )
}
