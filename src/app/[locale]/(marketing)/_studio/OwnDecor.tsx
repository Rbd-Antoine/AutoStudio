import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

// Under the comparator: the dealer's own background and logo. The three pictures are a real run
// of the editor (docs/site-3d/pipeline/demo/e2e-custom-background.mjs): a showroom photo imported
// as "Votre propre fond", a car photo, and the render the editor returned with the brand kit's
// logo placed by the server. The showroom was generated for the demo and the logo is fictitious;
// the caption says so.
const C = { night: '#0C0D0F', concrete: '#1A1C1F', steel: '#2A2D31', chalk: '#ECE8E1', ash: '#9A968E', tungsten: '#F2A93B' }
const DISPLAY = 'font-[family-name:var(--font-studio-display)] uppercase tracking-[-0.01em]'

function Shot({ name, label, alt, className }: { name: string; label: string; alt: string; className?: string }) {
  return (
    <figure className={cn('relative overflow-hidden rounded-sm', className)} style={{ boxShadow: `0 0 0 1px ${C.steel}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/compare/custom/${name}.webp`} srcSet={`/compare/custom/${name}-sm.webp 600w, /compare/custom/${name}.webp 1200w`}
        sizes="(min-width: 1024px) 40vw, 100vw" alt={alt} loading="lazy" width={1200} height={900} className="block aspect-[4/3] w-full object-cover" />
      <figcaption className="absolute left-2.5 top-2.5 rounded-sm px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ background: `${C.night}CC`, color: C.chalk }}>
        {label}
      </figcaption>
    </figure>
  )
}

export function OwnDecor() {
  const t = useTranslations('studio.own')
  return (
    <div className="mx-auto mt-[14vh] grid max-w-7xl items-center gap-10 lg:grid-cols-12 lg:gap-14">
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
      <div className="lg:col-span-8">
        <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,2fr)] sm:gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
            <Shot name="fond" label={t('place')} alt={t('placeAlt')} />
            <Shot name="photo" label={t('car')} alt={t('carAlt')} />
          </div>
          <span aria-hidden="true" className="hidden text-2xl sm:block" style={{ color: C.tungsten }}>→</span>
          <Shot name="rendu" label={t('result')} alt={t('resultAlt')} className="shadow-[0_40px_80px_-30px_#000]" />
        </div>
        <p className="mt-4 text-xs leading-relaxed" style={{ color: C.ash }}>{t('honesty')}</p>
      </div>
    </div>
  )
}
