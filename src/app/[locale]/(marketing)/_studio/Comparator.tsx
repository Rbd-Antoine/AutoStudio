'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { DECORS, type DecorSlug } from './scene'

// Chapter 3: the customer's photo and AutoStudio's real render of it, one over the other, with a
// handle to drag between them. Both pictures are shown whole, as delivered: nothing is cropped,
// relit or composited by the page. Every render was checked to keep the car exactly in place
// (docs/site-3d/pipeline/compare_assets.py), so the car runs across the line without moving.
export const CARS = ['voiture-01', 'voiture-02', 'voiture-03', 'voiture-04'] as const
export type CarId = (typeof CARS)[number]

const C = { night: '#0C0D0F', concrete: '#1A1C1F', steel: '#2A2D31', chalk: '#ECE8E1', ash: '#9A968E', tungsten: '#F2A93B' }

const src = (car: CarId, name: string) => `/compare/${car}/${name}.webp`
const srcSet = (car: CarId, name: string) => `/compare/${car}/${name}-sm.webp 800w, /compare/${car}/${name}.webp 1600w`
const SIZES = '(min-width: 1024px) 62vw, 100vw'

export function Comparator() {
  const t = useTranslations('studio.fonds')
  const [car, setCar] = useState<CarId>('voiture-01')
  const [decor, setDecor] = useState<DecorSlug>('garage-neon')
  const [pos, setPos] = useState(0.5)
  const frame = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const touched = useRef(false)

  const fromPointer = useCallback((clientX: number) => {
    const r = frame.current?.getBoundingClientRect()
    if (!r) return
    setPos(Math.min(1, Math.max(0, (clientX - r.left) / r.width)))
  }, [])

  // First time the comparator comes into view, the handle sweeps once across the car, so the
  // visitor sees at a glance that it moves. Skipped for reduced motion or once they touched it.
  useEffect(() => {
    const el = frame.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      io.disconnect()
      const t0 = performance.now()
      const step = (now: number) => {
        if (touched.current) return
        const k = Math.min(1, (now - t0) / 1600)
        // 0.5 → 0.82 → 0.5, eased.
        setPos(0.5 + 0.32 * Math.sin(Math.PI * k) * (1 - k * 0.15))
        if (k < 1) raf = requestAnimationFrame(step)
        else setPos(0.5)
      }
      raf = requestAnimationFrame(step)
    }, { threshold: 0.6 })
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [])

  // Warm the cache with the other renders of the chosen car, so a click shows at once.
  useEffect(() => {
    const id = window.setTimeout(() => {
      for (const d of DECORS) { const img = new Image(); img.srcset = srcSet(car, d); img.sizes = SIZES }
    }, 400)
    return () => window.clearTimeout(id)
  }, [car])

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.2 : 0.05
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setPos(p => Math.max(0, p - step))
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setPos(p => Math.min(1, p + step))
    else if (e.key === 'Home') setPos(0)
    else if (e.key === 'End') setPos(1)
    else return
    touched.current = true
    e.preventDefault()
  }

  const percent = Math.round(pos * 100)

  return (
    <div>
      <div
        ref={frame}
        className="relative aspect-[4/3] w-full cursor-ew-resize select-none overflow-hidden rounded-sm"
        style={{ background: C.concrete, boxShadow: `0 0 0 1px ${C.steel}, 0 40px 80px -30px #000` , touchAction: 'pan-y' }}
        onPointerDown={e => {
          touched.current = true
          dragging.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          fromPointer(e.clientX)
        }}
        onPointerMove={e => { if (dragging.current) fromPointer(e.clientX) }}
        onPointerUp={() => { dragging.current = false }}
        onPointerCancel={() => { dragging.current = false }}
      >
        {/* The render underneath, the photo on top clipped to the left of the handle. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={`${car}-${decor}`} src={src(car, decor)} srcSet={srcSet(car, decor)} sizes={SIZES}
          alt={t('afterAlt', { decor: t(`decors.${decor}.name`), car: t(`cars.${car}`) })}
          draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={`${car}-before`} src={src(car, 'before')} srcSet={srcSet(car, 'before')} sizes={SIZES}
          alt={t('beforeAlt', { car: t(`cars.${car}`) })}
          draggable={false} className="absolute inset-0 h-full w-full object-cover"
          style={{ clipPath: `inset(0 ${100 - pos * 100}% 0 0)` }} />

        <span className="pointer-events-none absolute left-3 top-3 rounded-sm px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] transition-opacity duration-200"
          style={{ background: `${C.night}CC`, color: C.chalk, opacity: pos > 0.16 ? 1 : 0 }}>{t('before')}</span>
        <span className="pointer-events-none absolute right-3 top-3 rounded-sm px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] transition-opacity duration-200"
          style={{ background: C.tungsten, color: C.night, opacity: pos < 0.84 ? 1 : 0 }}>{t('after')}</span>

        {/* The handle: a thin line and a grip, operable with the keyboard as a slider. */}
        <div className="pointer-events-none absolute inset-y-0 w-px" style={{ left: `${pos * 100}%`, background: C.chalk, boxShadow: '0 0 12px #0008' }} />
        <div
          role="slider"
          tabIndex={0}
          aria-label={t('handle')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={t('handleValue', { percent })}
          onKeyDown={onKey}
          className="absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{ left: `${pos * 100}%`, background: C.chalk, color: C.night, boxShadow: '0 6px 20px #0009', ['--tw-ring-color' as string]: C.tungsten, ['--tw-ring-offset-color' as string]: C.night }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="currentColor">
            <path d="M7.5 5 2.5 10l5 5V5Zm5 0v10l5-5-5-5Z" />
          </svg>
        </div>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <Picker
          label={t('pick')}
          items={DECORS.map(d => ({ id: d, thumb: `/compare/${car}/thumb-${d}.webp`, name: t(`decors.${d}.name`) }))}
          value={decor}
          onPick={id => setDecor(id as DecorSlug)}
        />
        <Picker
          label={t('pickCar')}
          items={CARS.map(c => ({ id: c, thumb: `/compare/${c}/thumb-before.webp`, name: t(`cars.${c}`) }))}
          value={car}
          onPick={id => setCar(id as CarId)}
        />
      </div>
    </div>
  )
}

function Picker({ label, items, value, onPick }: { label: string; items: { id: string; thumb: string; name: string }[]; value: string; onPick: (id: string) => void }) {
  const id = `picker-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div>
      <p id={id} className="text-xs font-medium uppercase tracking-[0.22em]" style={{ color: C.ash }}>{label}</p>
      <div role="radiogroup" aria-labelledby={id} className="mt-3 grid grid-cols-4 gap-1.5 sm:gap-2">
        {items.map(item => {
          const active = item.id === value
          return (
            <button key={item.id} type="button" role="radio" aria-checked={active} onClick={() => onPick(item.id)}
              className="group overflow-hidden rounded-sm text-left transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ outlineColor: C.tungsten, boxShadow: active ? `0 0 0 2px ${C.tungsten}` : `0 0 0 1px ${C.steel}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.thumb} alt="" width={120} height={90} loading="lazy" className={cn('block aspect-[4/3] w-full object-cover transition-opacity', active ? 'opacity-100' : 'opacity-75 group-hover:opacity-100')} />
              <span className="block min-h-[3.1em] px-1.5 py-1.5 text-[11px] font-medium leading-tight sm:px-2 sm:text-[12px]" style={{ background: C.concrete, color: active ? C.chalk : C.ash }}>
                {item.name}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
