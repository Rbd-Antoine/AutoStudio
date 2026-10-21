import { NextResponse } from 'next/server'
import { getPricingConfig, creditPacks, listAiFeatures, activePromo } from '@/lib/pricing'
import { isVideoProviderConfigured } from '@/lib/marketing-video/provider'

// Public, read-only. The whole app (pricing page, account page, editor cost labels) fetches
// numbers from here instead of hardcoding them — this is the single source of truth.
export async function GET() {
  const config = await getPricingConfig()
  const features = await listAiFeatures()

  return NextResponse.json({
    plans: [
      { id: 'FREE', label: 'Découverte', price: 0, credits: config.freeCredits },
      { id: 'ESSENTIAL', label: 'Essentiel', price: config.essentialPrice, credits: config.essentialCredits },
      { id: 'PRO', label: 'Pro', price: config.proPrice, credits: config.proCredits },
      { id: 'BUSINESS', label: 'Business', price: config.businessPrice, credits: config.businessCredits },
    ],
    packs: creditPacks(config),
    // `enabled` also reflects whether the feature can run here: the marketing video needs its
    // rendering provider configured.
    features: features.map(f => ({
      key: f.key,
      label: f.label,
      creditCost: f.creditCost,
      enabled: f.enabled && (f.key !== 'marketingVideo' || isVideoProviderConfigured()),
    })),
    promo: activePromo(config),
  })
}
