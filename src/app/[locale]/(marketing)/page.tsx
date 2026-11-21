import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getPricingConfig, activePromo } from '@/lib/pricing'
import { LandingViewedTracker } from './_components/LandingViewedTracker'
import { StudioLanding, type StudioPlan } from './_studio/StudioLanding'

// The home page: one scene, a studio in an old garage around one real car, travelled by the
// scroll (see _studio/scene.ts). The previous home page is kept whole in _legacy/HomeLegacy.tsx.
//
// Prices come from PricingConfig like everywhere else (never hardcoded): the page is static and
// refreshed within this window when an admin changes them.
export const revalidate = 60

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'studio.meta' })
  return { title: { absolute: t('title') }, description: t('description') }
}

async function getPlans(): Promise<StudioPlan[]> {
  const config = await getPricingConfig()
  const promo = activePromo(config)
  const plans: StudioPlan[] = [
    { id: 'FREE', price: 0, credits: config.freeCredits },
    { id: 'ESSENTIAL', price: config.essentialPrice, credits: config.essentialCredits },
    { id: 'PRO', price: config.proPrice, credits: config.proCredits },
    { id: 'BUSINESS', price: config.businessPrice, credits: config.businessCredits },
  ]
  return plans.map(p => (promo && promo.plan === p.id ? { ...p, promoPrice: promo.discountedPrice, promoLabel: promo.label } : p))
}

export default async function HomePage() {
  const plans = await getPlans()
  return (
    <>
      <LandingViewedTracker />
      <StudioLanding plans={plans} />
    </>
  )
}
