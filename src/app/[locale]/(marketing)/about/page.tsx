import { Link } from '@/i18n/routing'
import { Sparkles } from 'lucide-react'

export default function AboutPage() {
  return (
    <div className="pt-32 pb-20 bg-offwhite">
      <div className="page-container max-w-4xl">
        <p className="eyebrow mb-4">À propos</p>
        <h1 className="text-[clamp(2.5rem,5vw,4rem)] font-display font-bold text-charcoal mb-6 leading-tight">
          Nous croyons que chaque véhicule<br />
          <span className="text-gradient">mérite une photo digne d&apos;un showroom.</span>
        </h1>
        <p className="text-lg text-charcoal/55 leading-relaxed mb-6 max-w-2xl">
          AutoStudio est né d&apos;un constat simple : les concessions perdent des clics non pas à cause
          de la qualité de leurs véhicules, mais parce que leurs photos sont prises à la va-vite sur
          un parking, avec un arrière-plan qui n&apos;inspire pas confiance. Le véhicule était le bon,
          la photo ne le montrait pas.
        </p>
        <p className="text-lg text-charcoal/55 leading-relaxed mb-12 max-w-2xl">
          Nous avons construit AutoStudio pour combler ce fossé. Aujourd&apos;hui, des concessions
          utilisent AutoStudio pour transformer une simple photo de véhicule prise au smartphone
          en rendu photoréaliste en 60 secondes — et vendre plus vite.
        </p>

        <div className="card-light rounded-3xl p-8 mb-16 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-16 h-16 rounded-full shrink-0 bg-accent-100 text-accent-700 font-display font-bold text-xl flex items-center justify-center" aria-hidden>
            AR
          </div>
          <div>
            <p className="font-display font-semibold text-charcoal text-lg">Antoine R.</p>
            <p className="text-sm text-accent-600 font-medium mb-2">Fondateur d&apos;AutoStudio</p>
            <p className="text-sm text-charcoal/50 leading-relaxed max-w-lg">
              &ldquo;Je réponds personnellement à chaque demande. AutoStudio est encore une petite équipe —
              c&apos;est ce qui nous permet d&apos;aller vite et de rester à l&apos;écoute des concessions
              qui l&apos;utilisent tous les jours.&rdquo;
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-charcoal/40 mb-10">
          <Sparkles className="w-4 h-4 text-accent-500" fill="currentColor" />
          Conçu en France · Conforme RGPD
        </div>

        <div className="flex gap-4">
          <Link href="/contact" className="px-5 py-2.5 rounded-xl bg-accent-500 hover:bg-accent-600 text-white font-semibold text-sm transition-all">
            Nous contacter
          </Link>
          <Link href="/pricing" className="px-5 py-2.5 rounded-xl border border-charcoal/[0.12] text-charcoal/70 hover:text-charcoal hover:border-charcoal/[0.25] text-sm transition-all">
            Voir les tarifs
          </Link>
        </div>
      </div>
    </div>
  )
}
