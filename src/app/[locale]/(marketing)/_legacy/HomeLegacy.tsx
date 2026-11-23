// The home page before the 3D studio landing (feature/site-3d), kept whole to go back in one
// line: in page.tsx, `export { default } from './_legacy/HomeLegacy'` and `export const
// revalidate = 60`. Private folder (leading underscore): not a route of its own.
import Image from 'next/image'
import {
  ArrowRight, Check, Sparkles,
  Phone, Wallet, Clock, ScanSearch, Layers, Wand2, PackageCheck, Clapperboard,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { db } from '@/lib/db'
import { getAiFeature } from '@/lib/pricing'
import { CAR_STYLES } from '@/lib/carStyles'
import { getPublicTestimonials } from '@/lib/reviews'
import { CALENDLY_URL, CONTACT_EMAIL } from '@/lib/site-config'
import { TrackedLink } from '../_components/TrackedLink'
import { LandingViewedTracker } from '../_components/LandingViewedTracker'
import { GallerySection } from '../_components/GallerySection'
import { TabletVideoPlayer } from '../_components/TabletVideoPlayer'
import { LazyCalendlyEmbed } from '../_components/LazyCalendlyEmbed'
import { TestimonialsSection } from '../_components/TestimonialsSection'
import { AiContentSection } from '../_components/AiContentSection'
import { MarketingKit } from '../_components/MarketingKit'
import { PricingSection } from '../_components/PricingSection'
import { FAQSection } from '../_components/FAQSection'
import { StickyMobileCTA } from '../_components/StickyMobileCTA'

// PricingSection now reads PricingConfig directly via Prisma instead of a client-side
// fetch to /api/pricing. Since this page is statically prerendered, without a revalidate
// window the prices would freeze at build time until the next deploy — admin-configured
// pricing must still show up without a code change, just within this window instead of instantly.
// (Route segment config lives in page.tsx: `export const revalidate = 60` there.)

// ─── HERO ─────────────────────────────────────────────────────────────────────
// Below a certain count a specific number reads as thin rather than reassuring — the
// fallback copy makes no claim at all rather than showing something unconvincing.
const MIN_RENDER_COUNT_TO_SHOW = 20

function HeroSection({ renderCount }: { renderCount: number }) {
  return (
    // Clears the fixed Nav using its real measured height (--nav-height, published by
    // Nav.tsx via ResizeObserver) plus a fixed visual gap — never a guessed pixel value
    // that drifts out of sync whenever the header's own height changes.
    <section
      className="relative flex flex-col items-center justify-center pb-16 overflow-hidden bg-offwhite"
      style={{ paddingTop: 'calc(var(--nav-height, 132px) + 2rem)' }}
    >
      <div className="absolute top-0 right-0 w-[600px] h-[500px] bg-accent-200/40 rounded-full blur-[140px] pointer-events-none -translate-y-1/4 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent-600/20 rounded-full blur-[120px] pointer-events-none translate-y-1/4 -translate-x-1/4" />

      <div className="relative z-10 w-full max-w-[860px] mx-auto px-5 lg:px-8 text-center">
        {/* Badge */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-50 border border-accent-200 text-accent-600 text-sm font-medium">
            <Sparkles className="w-3.5 h-3.5 text-accent-500" fill="currentColor" />
            Premier rendu offert · Sans engagement
          </div>
        </div>

        <h1 className="font-display font-bold tracking-tight leading-[1.05] text-charcoal mb-6"
          style={{ fontSize: 'clamp(2.4rem, 5.5vw, 4.4rem)' }}>
          Des photos dignes d&apos;un showroom<br />
          <span className="text-gradient">sans studio photo</span><br />
          ni séance shooting.
        </h1>

        <p className="text-lg text-charcoal/55 leading-relaxed max-w-[560px] mx-auto mb-10">
          Photographiez votre véhicule avec votre téléphone. Notre IA génère un arrière-plan
          professionnel et une vidéo de présentation en 60 secondes. Publiez, vendez, plus vite.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <TrackedLink href="/signup" ctaId="hero_primary" label="Recevoir mon rendu offert" location="hero"
            className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-accent-500 hover:bg-accent-600 text-white font-bold text-base shadow-accent-sm hover:shadow-accent-md transition-all">
            Recevoir mon rendu offert
            <ArrowRight className="w-5 h-5" />
          </TrackedLink>
          <TrackedLink href="#galerie" ctaId="hero_secondary" label="Voir les exemples" location="hero"
            className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl border border-charcoal/[0.12] text-charcoal/65 hover:text-charcoal hover:bg-charcoal/[0.04] text-base font-medium transition-all">
            Voir les exemples
          </TrackedLink>
        </div>

        <div className="flex items-center justify-center gap-6 text-sm text-charcoal/40">
          <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-accent-500" /> Sans carte bancaire</span>
          <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-accent-500" /> 60 secondes</span>
          <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-accent-500" /> 4 décors au choix</span>
        </div>

        {renderCount >= MIN_RENDER_COUNT_TO_SHOW && (
          <p className="mt-6 text-xs text-charcoal/35">
            <span className="font-semibold text-charcoal/60 tabular-nums">{renderCount.toLocaleString('fr-FR')}</span> photos déjà générées par des concessions
          </p>
        )}
      </div>
    </section>
  )
}

// ─── STATS ────────────────────────────────────────────────────────────────────
const STATS = [
  { icon: Phone,  value: '5',   title: 'photos à la fois',
    desc: "Importez toutes les vues extérieures d'un véhicule d'un coup : chaque photo est traitée en parallèle, dans le même décor." },
  { icon: Wallet, value: '< 1 €', title: 'par rendu avec un abonnement',
    desc: "Pas de studio à aménager ni de photographe à faire venir : vous payez au rendu, avec vos photos prises au smartphone." },
  { icon: Clock,  value: '< 60 s', title: 'par photo',
    desc: "Importez une photo, choisissez un décor, recevez un rendu photoréaliste en moins d'une minute." },
]

function StatsSection() {
  return (
    <section className="py-16 md:py-20 bg-offwhite">
      <div className="page-container max-w-4xl">
        <div className="grid sm:grid-cols-3 gap-10 sm:gap-6 text-center">
          {STATS.map(stat => (
            <div key={stat.title}>
              <div className="w-12 h-12 rounded-full bg-accent-50 flex items-center justify-center mx-auto mb-4">
                <stat.icon className="w-5 h-5 text-accent-500" strokeWidth={1.75} />
              </div>
              <p className="font-display font-extrabold text-gradient leading-none mb-2" style={{ fontSize: 'clamp(2.25rem,4vw,2.75rem)' }}>
                {stat.value}
              </p>
              <h3 className="font-display font-bold text-charcoal text-lg mb-3">{stat.title}</h3>
              <p className="text-charcoal/50 text-sm leading-relaxed max-w-[260px] mx-auto">{stat.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── VIDEO DEMO ───────────────────────────────────────────────────────────────
function VideoSection() {
  return (
    <section className="section-pad bg-white overflow-hidden">
      <div className="page-container">
        {/* Text */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="eyebrow mb-3">AutoStudio en action</p>
          <h2 className="font-display font-bold text-charcoal mb-5" style={{ fontSize: 'clamp(1.75rem,3.5vw,2.75rem)' }}>
            60 secondes.<br /><span className="text-gradient">Une photo transformée.</span>
          </h2>
          <p className="text-charcoal/50 text-[15px] leading-relaxed">
            Regardez comment AutoStudio transforme une simple photo de véhicule en rendu photoréaliste.
          </p>
        </div>

        {/* Tablet centré */}
        <div className="flex justify-center px-4">
          <TabletVideoPlayer />
        </div>

        {/* Étapes en dessous */}
        <div className="flex flex-col sm:flex-row justify-center gap-8 mt-10 max-w-2xl mx-auto">
          {['Photographiez votre véhicule', 'Choisissez votre décor', "Recevez votre rendu en moins d'une minute"].map((step, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-charcoal/60">
              <div className="w-7 h-7 rounded-full bg-accent-100 border border-accent-200 flex items-center justify-center text-xs font-bold text-accent-600 shrink-0">
                {i + 1}
              </div>
              {step}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CALENDLY ─────────────────────────────────────────────────────────────────
function CalendlySection() {
  return (
    <section id="rendez-vous" className="section-pad bg-white">
      <div className="page-container max-w-5xl">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">
          {/* Left: text */}
          <div className="lg:w-[380px] shrink-0">
            <p className="eyebrow mb-3">Démo personnalisée</p>
            <h2 className="font-display font-bold text-charcoal mb-5" style={{ fontSize: 'clamp(1.75rem,3.5vw,2.75rem)' }}>
              Parlons de votre<br /><span className="text-gradient">activité.</span>
            </h2>
            <p className="text-charcoal/50 text-[15px] leading-relaxed mb-8">
              {CALENDLY_URL ? 'Réservez 20 minutes avec moi' : 'Écrivez-moi'} pour découvrir comment AutoStudio peut transformer la façon dont votre concession présente ses véhicules.
            </p>
            <div className="flex flex-col gap-3 mb-8">
              {[
                'Démo sur des photos de votre propre stock',
                'Conseils personnalisés pour votre activité',
                'Sans engagement, sans carte bancaire',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-charcoal/60">
                  <Check className="w-4 h-4 text-accent-500 shrink-0 mt-0.5" />
                  {item}
                </div>
              ))}
            </div>
            <div className="card-light rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full shrink-0 bg-accent-100 text-accent-700 font-display font-bold text-sm flex items-center justify-center" aria-hidden>
                  AR
                </div>
                <div>
                  <p className="text-sm font-semibold text-charcoal">Antoine R.</p>
                  <p className="text-xs text-charcoal/45">Fondateur d&apos;AutoStudio</p>
                </div>
              </div>
              <p className="text-xs text-charcoal/50 leading-relaxed">
                &ldquo;Je réponds personnellement à chaque demande. Montrez-moi une photo de votre stock et on voit ensemble ce qu&apos;AutoStudio peut faire.&rdquo;
              </p>
            </div>
          </div>

          {/* Right: Calendly booking embed, or a contact card until a booking page is configured */}
          {CALENDLY_URL ? (
            <div className="flex-1 w-full rounded-3xl overflow-hidden border border-charcoal/[0.08] shadow-card">
              <LazyCalendlyEmbed url={CALENDLY_URL} />
            </div>
          ) : (
            <div className="flex-1 w-full rounded-3xl border border-charcoal/[0.08] shadow-card bg-offwhite p-8 sm:p-12 flex flex-col items-start justify-center gap-5 min-h-[320px]">
              <p className="eyebrow">Demander une démo</p>
              <p className="font-display font-bold text-charcoal text-2xl leading-snug">
                Envoyez-nous quelques photos de votre stock, on vous montre le résultat.
              </p>
              <p className="text-charcoal/55 text-[15px] leading-relaxed">
                Décrivez votre activité en quelques lignes : nous revenons vers vous pour caler un échange de 20 minutes.
              </p>
              <TrackedLink href="/contact" ctaId="demo_contact" label="Demander une démo" location="demo"
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-accent-500 hover:bg-accent-600 text-white font-bold text-base shadow-accent-sm hover:shadow-accent-md transition-all">
                Demander une démo
                <ArrowRight className="w-5 h-5" />
              </TrackedLink>
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-sm text-charcoal/50 hover:text-charcoal/80 underline underline-offset-2">
                {CONTACT_EMAIL}
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// ─── SCROLLING GALLERY ────────────────────────────────────────────────────────
const SCROLL_GALLERY = [
  { src: '/scroll-car-1.jpeg', label: 'Garage néon' },
  { src: '/scroll-car-2.jpeg', label: 'Hangar industriel' },
  { src: '/scroll-car-3.jpeg', label: 'Parking souterrain' },
  { src: '/scroll-car-4.jpeg', label: 'Pièce vide moderne' },
  { src: '/scroll-car-5.jpeg', label: 'Parking souterrain' },
  { src: '/scroll-car-6.jpeg', label: 'Garage néon' },
]

function ScrollingGallerySection() {
  return (
    <section className="py-14 bg-white overflow-hidden">
      <div className="page-container mb-8">
        <p className="eyebrow text-center">Rendus générés par AutoStudio</p>
      </div>
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
        <div className="flex w-max gap-5 animate-marquee" style={{ animationDuration: '38s' }}>
          {[...SCROLL_GALLERY, ...SCROLL_GALLERY].map((item, i) => (
            <div key={i} className="relative w-[280px] sm:w-[360px] aspect-video rounded-2xl overflow-hidden border border-charcoal/[0.08] shadow-card shrink-0">
              <Image src={item.src} alt={item.label} fill className="object-cover" sizes="360px" />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/70 via-transparent to-transparent" />
              <p className="absolute bottom-3 left-4 text-white text-sm font-semibold">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── HOW IT WORKS ─────────────────────────────────────────────────────────────
// Reads real credit costs directly via Prisma (same "no client-side fetch waterfall"
// approach as PricingSection.tsx) rather than hardcoding numbers here that would silently
// drift from whatever an admin sets on the pricing page.
async function HowItWorksSection() {
  const [retouchCost, kitCost] = await Promise.all([
    getAiFeature('imageRetouch'),
    getAiFeature('marketingVideo'),
  ])

  const steps = [
    { num: '1', title: 'Importez vos photos', img: '/howitworks-import-crop.png',
      desc: "Importez les photos du véhicule prises au smartphone : jusqu'à 5 à la fois, en JPG, PNG, WebP ou HEIC." },
    { num: '2', title: "L'IA applique le nouvel arrière-plan", img: '/howitworks-generate-crop.png',
      desc: "Choisissez l'un des 4 décors. L'IA remplace l'arrière-plan et a pour consigne de conserver le véhicule à l'identique." },
    { num: '3', title: 'Retouchez à la demande', img: '/howitworks-retouch-crop.png',
      desc: `Affinez chaque rendu en une phrase, ou déclinez-le en vidéos pour vos réseaux. Une retouche coûte ${retouchCost?.creditCost ?? 1} crédit, une vidéo du kit marketing ${kitCost?.creditCost ?? 1} crédit par format.` },
  ]

  return (
    <section id="comment-ca-marche" className="section-pad bg-offwhite">
      <div className="page-container">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="eyebrow mb-3">Comment ça marche</p>
          <h2 className="font-display font-bold text-charcoal mb-4" style={{ fontSize: 'clamp(1.75rem,3.5vw,2.75rem)' }}>
            Simple comme<br /><span className="text-gradient">prendre une photo.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 md:gap-6">
          {steps.map((step, i) => (
            <div key={step.num} className="relative flex flex-col">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-full bg-accent-500 text-white font-display font-bold text-sm flex items-center justify-center shrink-0">
                  {step.num}
                </div>
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute right-0 top-2 translate-x-1/2 z-10">
                    <ArrowRight className="w-4 h-4 text-accent-300" strokeWidth={2} />
                  </div>
                )}
              </div>
              <h3 className="font-display font-semibold text-charcoal text-lg mb-2">{step.title}</h3>
              <p className="text-charcoal/50 text-[14px] leading-relaxed mb-6">{step.desc}</p>
              <div className="relative aspect-[16/10] rounded-2xl overflow-hidden border border-accent-100 shadow-card bg-white mt-auto">
                <Image
                  src={step.img}
                  alt={step.title}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-contain"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── WHY IT CONVINCES ─────────────────────────────────────────────────────────
const ARGUMENTS = [
  { title: '« Une photo de mauvaise qualité fait fuir »', desc: "C'est la première cause de clic manqué sur une annonce. Un arrière-plan professionnel supprime cette objection avant qu'elle n'existe." },
  { title: 'Deux annonces identiques sur le marché', desc: "Celle avec des photos studio gagne le clic. Vos concurrents publient des photos prises sur le parking." },
  { title: 'Zéro studio à réserver', desc: "Pas de déplacement, pas de matériel, pas de rendez-vous photographe. Vous envoyez une photo, vous recevez une image." },
]

function ArgumentsSection() {
  return (
    <section className="section-pad bg-white">
      <div className="page-container max-w-3xl">
        <div className="text-center max-w-xl mx-auto mb-10">
          <p className="eyebrow mb-3">Pourquoi ça change la vente</p>
          <h2 className="font-display font-bold text-charcoal" style={{ fontSize: 'clamp(1.75rem,3.5vw,2.75rem)' }}>
            Le rendu qui <span className="text-gradient">fait cliquer.</span>
          </h2>
        </div>
        <div className="flex flex-col gap-3">
          {ARGUMENTS.map(arg => (
            <div key={arg.title} className="pl-5 pr-6 py-4 rounded-r-xl border-l-[3px] border-accent-500 bg-accent-50">
              <p className="text-sm">
                <strong className="text-charcoal font-semibold">{arg.title}.</strong>{' '}
                <span className="text-charcoal/60">{arg.desc}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── MID-PAGE CTA ─────────────────────────────────────────────────────────────
// Gallery and the final CTA bracket a long stretch (Stats, HowItWorks, Video,
// ScrollingGallery, Styles, Automation, Arguments) with no CTA reminder on desktop —
// mobile has StickyMobileCTA covering that gap, desktop doesn't. One calm banner here,
// not a repeat of every section's ask.
function MidPageCTASection() {
  return (
    <section className="py-14 bg-offwhite">
      <div className="page-container">
        <div className="max-w-4xl mx-auto rounded-3xl border border-accent-200 bg-white shadow-card px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-center sm:text-left">
            <h3 className="font-display font-bold text-charcoal text-lg mb-1">
              Prêt à essayer sur votre prochain projet ?
            </h3>
            <p className="text-sm text-charcoal/50">Premier rendu offert, sans carte bancaire.</p>
          </div>
          <TrackedLink href="/signup" ctaId="midpage" label="Recevoir mon rendu offert" location="midpage"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-accent-500 hover:bg-accent-600 text-white font-semibold text-sm shadow-accent-sm hover:shadow-accent-md transition-all shrink-0 whitespace-nowrap">
            Recevoir mon rendu offert
            <ArrowRight className="w-4 h-4" />
          </TrackedLink>
        </div>
      </div>
    </section>
  )
}

// ─── STYLES GRID ──────────────────────────────────────────────────────────────
const STYLE_CARD_COLORS = [
  'bg-accent-900/40 border-accent-700/60',
  'bg-white border-charcoal/[0.14]',
  'bg-charcoal/[0.03] border-charcoal/[0.08]',
  'bg-accent-50 border-accent-200/60',
  'bg-white border-charcoal/[0.14]',
  'bg-accent-50 border-accent-200/60',
]

function StylesSection() {
  return (
    <section className="section-pad bg-offwhite">
      <div className="page-container">
        <div className="text-center max-w-xl mx-auto mb-10">
          <p className="eyebrow mb-3">Styles d&apos;arrière-plan</p>
          <h2 className="font-display font-bold text-charcoal mb-4" style={{ fontSize: 'clamp(1.75rem,3.5vw,2.75rem)' }}>
            Chaque véhicule mérite<br /><span className="text-gradient">sa mise en scène.</span>
          </h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {CAR_STYLES.map((s, i) => (
            <div key={s.slug} className={cn('group p-6 rounded-2xl border transition-all cursor-default hover:shadow-card', STYLE_CARD_COLORS[i % STYLE_CARD_COLORS.length])}>
              <div className="relative w-full h-32 rounded-xl overflow-hidden mb-4">
                <Image src={s.image} alt={s.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(min-width: 768px) 300px, 45vw" />
              </div>
              <h3 className="font-display font-semibold text-charcoal text-[15px] mb-1.5 group-hover:text-accent-600 transition-colors">{s.name}</h3>
              <p className="text-xs text-charcoal/45 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── AUTOMATION ───────────────────────────────────────────────────────────────
const AUTOMATION_STEPS = [
  { icon: ScanSearch, title: 'Import en lot', time: "jusqu'à 5 photos",
    desc: "Importez toutes les vues extérieures d'un véhicule d'un coup : elles sont traitées en parallèle, dans le même décor." },
  { icon: Layers, title: 'Remplacement du décor', time: 'quelques secondes par photo',
    desc: "L'IA remplace l'arrière-plan par le décor choisi, vitres, reflets et ombre au sol compris, sans toucher au véhicule." },
  { icon: Wand2, title: 'Retouche ciblée', time: '1 crédit',
    desc: "Affinez un rendu en une phrase, sans repartir de zéro. Chaque version reste disponible dans l'éditeur." },
  { icon: PackageCheck, title: 'Kit marketing', time: '1 crédit par format',
    desc: "Déclinez le rendu en vidéos Reel, Story, paysage ou carré à vos couleurs, avec un texte de publication prêt à copier." },
]

async function AutomationSection() {
  const kitCost = await getAiFeature('marketingVideo')

  return (
    <section className="section-pad bg-white">
      <div className="page-container max-w-3xl">
        <div className="text-center max-w-xl mx-auto mb-14">
          <p className="eyebrow mb-3">Automatisation</p>
          <h2 className="font-display font-bold text-charcoal mb-4" style={{ fontSize: 'clamp(1.75rem,3.5vw,2.75rem)' }}>
            Gagnez des heures avec<br /><span className="text-gradient">votre IA photo auto.</span>
          </h2>
          <p className="text-charcoal/50 text-[15px] leading-relaxed">
            AutoStudio traite vos photos par lot, applique le décor choisi et prépare vos visuels — vous n&apos;avez plus qu&apos;à vérifier et publier.
          </p>
        </div>

        <div className="relative">
          <div
            className="absolute left-6 top-6 bottom-6 w-px hidden sm:block"
            style={{ backgroundImage: 'repeating-linear-gradient(to bottom, rgba(45,127,249,0.45) 0 4px, transparent 4px 9px)' }}
          />
          <div className="flex flex-col gap-4">
            {AUTOMATION_STEPS.map(step => (
              <div key={step.title} className="relative flex gap-5 items-start">
                <div className="w-12 h-12 rounded-2xl bg-accent-50 border border-accent-200/60 flex items-center justify-center shrink-0 z-10">
                  <step.icon className="w-5 h-5 text-accent-500" strokeWidth={1.75} />
                </div>
                <div className="card-light rounded-2xl p-5 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                    <h3 className="font-display font-semibold text-charcoal text-[15px]">{step.title}</h3>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-accent-50 text-accent-600 text-[11px] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-400" /> {step.time}
                    </span>
                  </div>
                  <p className="text-charcoal/50 text-[13.5px] leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mt-10">
          {[
            { icon: Clock,  text: "Moins d'une minute par rendu" },
            { icon: Layers, text: '4 décors au choix' },
            { icon: Wand2,  text: 'Retouche : 1 crédit' },
            { icon: Clapperboard, text: `Vidéo du kit : ${kitCost?.creditCost ?? 1} crédit par format` },
          ].map(pill => (
            <div key={pill.text} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-50 border border-accent-200/60 text-accent-700 text-sm font-medium">
              <pill.icon className="w-4 h-4 text-accent-500" strokeWidth={1.75} />
              {pill.text}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── FINAL CTA ────────────────────────────────────────────────────────────────
function FinalCTASection() {
  return (
    <section className="section-pad bg-offwhite relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-accent-600/15 rounded-full blur-[130px] pointer-events-none" />
      <div className="page-container relative text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-500/15 border border-accent-400/25 text-accent-300 text-sm font-medium mb-8">
          <Sparkles className="w-3.5 h-3.5" fill="currentColor" />
          Premier rendu offert · Sans carte bancaire
        </div>

        <h2 className="font-display font-bold text-charcoal mb-6 leading-tight" style={{ fontSize: 'clamp(2rem,4.5vw,3.2rem)' }}>
          Vendez votre prochain véhicule<br /><span className="text-gradient-green">plus vite.</span>
        </h2>

        <p className="text-lg text-charcoal/45 mb-10 leading-relaxed">
          Rejoignez les concessions qui publient leurs annonces avec des photos
          dignes d&apos;un showroom, sans studio ni photographe.
        </p>

        <TrackedLink href="/signup" ctaId="final_cta" label="Recevoir mon rendu offert" location="final_cta"
          className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-accent-500 hover:bg-accent-600 text-white font-bold text-base shadow-accent-sm hover:shadow-accent-md transition-all">
          Recevoir mon rendu offert
          <ArrowRight className="w-5 h-5" />
        </TrackedLink>
        <p className="mt-4 text-xs text-charcoal/25">
          Aucune carte bancaire · Résultat en 60 secondes · Styles à l&apos;infini
        </p>
      </div>
    </section>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default async function HomeLegacy() {
  // Real counts, not invented ones — each section decides for itself whether the number
  // is high enough to be reassuring rather than thin (see MIN_RENDER_COUNT_TO_SHOW and
  // GallerySection's own threshold).
  const [renderCount, workspaceCount, testimonials] = await Promise.all([
    db.photo.count({ where: { status: { in: ['ENHANCED', 'EXPIRED'] } } }),
    db.workspace.count(),
    getPublicTestimonials(),
  ])

  return (
    <>
      <LandingViewedTracker />
      <HeroSection renderCount={renderCount} />
      <GallerySection workspaceCount={workspaceCount} />
      <StatsSection />
      <HowItWorksSection />
      <VideoSection />
      <ScrollingGallerySection />
      <StylesSection />
      <AiContentSection />
      <MarketingKit />
      <AutomationSection />
      <ArgumentsSection />
      <MidPageCTASection />
      <TestimonialsSection testimonials={testimonials} />
      <PricingSection />
      <FAQSection />
      <CalendlySection />
      <FinalCTASection />
      <StickyMobileCTA />
    </>
  )
}
