import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPricingConfig, activePromo } from '@/lib/pricing'
import { PricingViewedTracker } from './PricingViewedTracker'
import { TrackedLink } from './TrackedLink'

interface MarketingPlan {
  id: string
  name: string
  price: string
  originalPrice?: string
  per: string
  sub: string
  badge?: string
  promoLabel?: string
  features: string[]
  cta: string
  href: string
  highlight: boolean
}

const PLAN_META: Record<string, { name: string; badge?: string; highlight: boolean; href: string; cta: string; extraFeatures: string[] }> = {
  FREE:      { name: 'Découverte', highlight: false, href: '/signup', cta: 'Commencer gratuitement', extraFeatures: ['Tous les décors disponibles', 'Téléchargement HD'] },
  ESSENTIAL: { name: 'Essentiel',  badge: 'Le plus populaire', highlight: true, href: '/signup?plan=essential', cta: 'Créer mon compte', extraFeatures: ['Tous les décors', 'Téléchargement HD', 'Support prioritaire'] },
  PRO:       { name: 'Pro',        highlight: false, href: '/signup?plan=pro', cta: 'Créer mon compte', extraFeatures: ['Tous les décors', 'Téléchargement HD', 'Support dédié'] },
  BUSINESS:  { name: 'Business',   highlight: false, href: '/signup?plan=business', cta: 'Créer mon compte', extraFeatures: ['Tous les décors', 'Téléchargement HD', 'Support dédié prioritaire'] },
}

// Numbers come straight from PricingConfig via a direct data-access call (no client-side
// fetch waterfall) — never hardcode credits or prices here.
async function getPlans(): Promise<MarketingPlan[]> {
  const config = await getPricingConfig()
  const promo = activePromo(config)
  const raw = [
    { id: 'FREE', price: 0, credits: config.freeCredits },
    { id: 'ESSENTIAL', price: config.essentialPrice, credits: config.essentialCredits },
    { id: 'PRO', price: config.proPrice, credits: config.proCredits },
    { id: 'BUSINESS', price: config.businessPrice, credits: config.businessCredits },
  ]
  return raw.map(p => {
    const meta = PLAN_META[p.id]
    const creditsLabel = `${p.credits.toLocaleString()} crédit${p.credits === 1 ? '' : 's'} / mois`
    const isPromo = promo && promo.plan === p.id
    return {
      id: p.id,
      name: meta.name,
      price: isPromo ? `€${promo.discountedPrice}` : p.price > 0 ? `€${p.price}` : 'Gratuit',
      originalPrice: isPromo ? `€${promo.originalPrice}` : undefined,
      per: p.price > 0 ? '/mois' : '',
      sub: creditsLabel,
      badge: isPromo ? promo.label : meta.badge,
      promoLabel: isPromo ? promo.label : undefined,
      features: [creditsLabel, ...meta.extraFeatures],
      cta: meta.cta,
      href: meta.href,
      highlight: meta.highlight,
    }
  })
}

export async function PricingSection() {
  const plans = await getPlans()
  return (
    <section id="tarifs" className="section-pad bg-offwhite">
      <PricingViewedTracker source="homepage" />
      <div className="page-container">
        <div className="text-center max-w-xl mx-auto mb-10">
          <p className="eyebrow mb-3">Tarifs</p>
          <h2 className="font-display font-bold text-charcoal mb-4" style={{ fontSize: 'clamp(1.75rem,3.5vw,2.75rem)' }}>
            Commencez gratuitement,<br /><span className="text-gradient">évoluez à votre rythme.</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-4 gap-5 max-w-6xl mx-auto">
          {plans.map(plan => (
            <div key={plan.name} className={cn(
              'relative rounded-3xl p-8 flex flex-col border transition-all',
              plan.highlight ? 'bg-offwhite border-accent-500/30 shadow-accent-md' : 'bg-white border-charcoal/[0.07] shadow-card hover:shadow-card-hover',
            )}>
              {plan.badge && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-accent-500 text-white text-xs font-bold whitespace-nowrap">
                  {plan.badge}
                </span>
              )}
              <div className="mb-5">
                <h3 className={cn('font-display font-semibold mb-1', plan.highlight ? 'text-charcoal' : 'text-charcoal')}>{plan.name}</h3>
                <p className={cn('text-xs', plan.highlight ? 'text-charcoal/40' : 'text-charcoal/40')}>{plan.sub}</p>
              </div>
              <div className="flex items-baseline gap-1.5 mb-6 flex-wrap">
                {plan.originalPrice && (
                  <span className={cn('text-lg line-through', plan.highlight ? 'text-charcoal/35' : 'text-charcoal/30')}>{plan.originalPrice}</span>
                )}
                <span className={cn('text-4xl font-display font-bold', plan.highlight ? 'text-charcoal' : 'text-charcoal')}>{plan.price}</span>
                {plan.per && <span className={cn('text-sm', plan.highlight ? 'text-charcoal/40' : 'text-charcoal/40')}>{plan.per}</span>}
                {plan.originalPrice && (
                  <span className="text-[11px] font-semibold text-accent-500 w-full mt-0.5">1ère année</span>
                )}
              </div>
              <ul className="flex flex-col gap-2.5 mb-8 flex-1">
                {plan.features.map(f => (
                  <li key={f} className={cn('flex items-start gap-2.5 text-sm', plan.highlight ? 'text-charcoal/65' : 'text-charcoal/60')}>
                    <Check className={cn('w-4 h-4 mt-0.5 shrink-0', plan.highlight ? 'text-accent-400' : 'text-accent-500')} />{f}
                  </li>
                ))}
              </ul>
              <TrackedLink href={plan.href} ctaId={`pricing_homepage_${plan.id.toLowerCase()}`} label={plan.cta} location="pricing_homepage" className={cn(
                'text-center py-3 rounded-2xl text-sm font-semibold transition-all',
                plan.highlight ? 'bg-accent-500 hover:bg-accent-600 text-white shadow-accent-sm' : 'border border-charcoal/[0.12] hover:border-accent-400 text-charcoal/70 hover:text-accent-600',
              )}>{plan.cta}</TrackedLink>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
