'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

// Several photos at once, and the time it gives back. The pictures are real: four "before" photos
// and their whole real renders in one background (public/renders). The figures come from the product
// (up to 5 photos per batch, rendered in parallel, 30 to 90 s for the batch: the editor's own
// copy); the calculator only multiplies the visitor's own numbers, its assumptions shown.
const C = { night: '#0C0D0F', concrete: '#1A1C1F', steel: '#2A2D31', chalk: '#ECE8E1', ash: '#9A968E', tungsten: '#F2A93B' }
const DISPLAY = 'font-[family-name:var(--font-studio-display)] uppercase tracking-[-0.01em]'
const CARS = ['coupe', 'suv', 'berline', 'sportive'] as const
const BATCH_DECOR = 'showroom-lumiere'
/** The dealer's own time per vehicle with AutoStudio: import the photos, check the renders. */
const AUTOSTUDIO_MIN_PER_VEHICLE = 2

function Slider({ id, label, value, min, max, step, unit, onChange }: { id: string; label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm" style={{ color: '#CFCAC1' }}>{label}</label>
        <span className="text-lg font-semibold tabular-nums" style={{ color: C.chalk }}>{value} <span className="text-xs font-normal" style={{ color: C.ash }}>{unit}</span></span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[#F2A93B]" />
    </div>
  )
}

export function BatchSection() {
  const t = useTranslations('studio.batch')
  const [vehicles, setVehicles] = useState(20)
  const [photos, setPhotos] = useState(5)
  const [minutes, setMinutes] = useState(5)
  const [shown, setShown] = useState(false)
  const grid = useRef<HTMLDivElement>(null)

  // The renders come in one after the other the first time the batch is seen.
  useEffect(() => {
    const el = grid.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect() } }, { threshold: 0.4 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const today = (vehicles * photos * minutes) / 60
  const withUs = (vehicles * AUTOSTUDIO_MIN_PER_VEHICLE) / 60
  const saved = Math.max(0, today - withUs)
  const h = (n: number) => (n < 10 ? n.toFixed(1).replace('.', ',') : Math.round(n).toString())

  return (
    <div className="mx-auto mt-[16vh] max-w-7xl">
      <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-4">
          <p className="text-xs font-medium uppercase tracking-[0.22em]" style={{ color: C.tungsten }}>{t('eyebrow')}</p>
          <h3 className={cn(DISPLAY, 'mt-4 font-extrabold leading-[0.9]')} style={{ fontSize: 'clamp(2.25rem, 4vw, 3.75rem)' }}>{t('title')}</h3>
          <p className="mt-5 text-base leading-relaxed sm:text-lg" style={{ color: '#BDB8AF' }}>{t('body')}</p>
          <ul className="mt-6 space-y-3 text-sm leading-relaxed" style={{ color: '#CFCAC1' }}>
            {(t.raw('points') as string[]).map(p => (
              <li key={p} className="flex gap-3"><span aria-hidden="true" className="mt-[0.65em] h-px w-3 shrink-0" style={{ background: C.tungsten }} />{p}</li>
            ))}
          </ul>
        </div>

        <div ref={grid} className="lg:col-span-8">
          <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.6fr)] sm:gap-4">
            {/* The batch as dropped: four phone photos. */}
            <div className="rounded-sm border border-dashed p-2.5" style={{ borderColor: '#3A3E44' }}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.ash }}>{t('dropped')}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {CARS.map(car => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={car} src={`/compare/${car}/thumb-before.webp`} alt="" width={240} height={180} loading="lazy" className="block aspect-[4/3] w-full rounded-[2px] object-cover" />
                ))}
              </div>
            </div>
            <span aria-hidden="true" className="hidden text-2xl sm:block" style={{ color: C.tungsten }}>→</span>
            {/* The same batch, rendered in one background. */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.tungsten }}>{t('rendered')}</p>
              <div className="grid grid-cols-2 gap-2">
                {CARS.map((car, i) => (
                  <div key={car} className="relative overflow-hidden rounded-sm" style={{ boxShadow: `0 0 0 1px ${C.steel}`, background: C.concrete }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/renders/${car}/${BATCH_DECOR}-sm.webp`} alt={t('renderAlt', { n: i + 1 })} width={1000} height={747} loading="lazy"
                      className="block aspect-[4/3] w-full object-cover transition-all duration-700 motion-reduce:transition-none"
                      style={{ opacity: shown ? 1 : 0, transform: shown ? 'none' : 'scale(1.03)', transitionDelay: shown ? `${250 + i * 350}ms` : '0ms' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed" style={{ color: C.ash }}>{t('caption')}</p>
        </div>
      </div>

      {/* The time it gives back, on the dealer's own numbers. */}
      <div className="mt-14 grid gap-8 border-t pt-10 lg:grid-cols-12 lg:gap-14" style={{ borderColor: C.steel }}>
        <div className="lg:col-span-4">
          <h4 className={cn(DISPLAY, 'text-3xl font-extrabold leading-none')}>{t('calcTitle')}</h4>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: '#BDB8AF' }}>{t('calcBody')}</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:col-span-8">
          <div className="space-y-5">
            <Slider id="calc-vehicles" label={t('vehicles')} value={vehicles} min={1} max={150} step={1} unit={t('perMonth')} onChange={setVehicles} />
            <Slider id="calc-photos" label={t('photos')} value={photos} min={1} max={5} step={1} unit={t('perVehicle')} onChange={setPhotos} />
            <Slider id="calc-minutes" label={t('minutes')} value={minutes} min={1} max={30} step={1} unit={t('perPhoto')} onChange={setMinutes} />
          </div>
          <div className="flex flex-col justify-between rounded-sm p-6" style={{ background: C.concrete, boxShadow: `0 0 0 1px ${C.steel}` }} aria-live="polite">
            <div className="space-y-2 text-sm" style={{ color: '#CFCAC1' }}>
              <p className="flex justify-between gap-4"><span>{t('today')}</span><span className="tabular-nums">{h(today)} h</span></p>
              <p className="flex justify-between gap-4"><span>{t('withUs')}</span><span className="tabular-nums">{h(withUs)} h</span></p>
            </div>
            <div className="mt-6 border-t pt-5" style={{ borderColor: C.steel }}>
              <p className="text-xs uppercase tracking-[0.18em]" style={{ color: C.tungsten }}>{t('saved')}</p>
              <p className={cn(DISPLAY, 'mt-1 font-extrabold leading-none tabular-nums')} style={{ fontSize: 'clamp(3rem, 6vw, 4.5rem)' }}>{h(saved)} h</p>
              <p className="mt-2 text-xs" style={{ color: C.ash }}>{t('assumption', { min: AUTOSTUDIO_MIN_PER_VEHICLE })}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
