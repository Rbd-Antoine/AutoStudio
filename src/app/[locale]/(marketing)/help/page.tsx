import { Link } from '@/i18n/routing'
import {
  Sparkles, CreditCard, Image as ImageIcon, Settings,
  MessageCircle,
} from 'lucide-react'

const CATEGORIES = [
  {
    icon: Sparkles, title: 'Bien démarrer',
    desc: 'Créer son compte, générer son premier rendu, personnaliser son Brand Kit',
  },
  {
    icon: ImageIcon, title: 'Rendus & éditeur',
    desc: 'Décors disponibles, retouche, kit marketing, bibliothèque de rendus',
  },
  {
    icon: CreditCard, title: 'Abonnement & facturation',
    desc: 'Crédits, changement de plan, factures, moyens de paiement',
  },
  {
    icon: Settings, title: 'Paramètres & sécurité',
    desc: 'RGPD, accès à vos données et suppression du compte sur simple demande par e-mail',
  },
]

const FAQ = [
  {
    q: 'Comment fonctionnent les crédits ?',
    a: "Chaque génération, retouche ou vidéo consomme un nombre fixe de crédits selon l'action. Le détail du coût par action est visible sur la page Tarifs.",
  },
  {
    q: 'Pourquoi mon rendu a-t-il échoué ?',
    a: 'C\'est généralement lié au format ou au poids de la photo importée. Réessayez avec une photo JPG, PNG ou HEIC de moins de 20 Mo — vos crédits ne sont jamais décomptés en cas d\'échec.',
  },
  {
    q: 'Puis-je résilier à tout moment ?',
    a: 'Oui, depuis votre espace Facturation, sans engagement. La résiliation prend effet à la fin de la période déjà payée.',
  },
  {
    q: 'Quelle est la différence entre génération, retouche et vidéo ?',
    a: "La génération remplace l'arrière-plan de votre photo par l'un de nos décors, la retouche modifie un rendu existant par instruction, et la vidéo transforme un avant/après en clip prêt à publier sur les réseaux.",
  },
]

export default function HelpPage() {
  return (
    <div className="pt-32 pb-20 page-container">
      <div className="max-w-4xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-14">
          <p className="eyebrow mb-4">Centre d&apos;aide</p>
          <h1 className="text-[clamp(2rem,4vw,3.5rem)] font-display font-bold text-charcoal mb-4 leading-[1.1]">
            Comment pouvons-nous <span className="text-gradient">vous aider ?</span>
          </h1>
          <p className="text-charcoal/55 text-[15px]">
            Réponses et guides pour tirer le meilleur d&apos;AutoStudio.
          </p>
        </div>

        {/* Categories */}
        <section className="mb-14">
          <h2 className="text-[11px] font-semibold tracking-[0.16em] uppercase text-accent-400/90 mb-5">
            Par thème
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {CATEGORIES.map((c) => {
              const Icon = c.icon
              return (
                <div
                  key={c.title}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5"
                >
                  <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-3">
                    <Icon className="w-4 h-4 text-accent-400" strokeWidth={1.75} />
                  </div>
                  <h3 className="font-display font-semibold">{c.title}</h3>
                  <p className="text-sm text-charcoal/55 mt-1">{c.desc}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-14">
          <h2 className="text-[11px] font-semibold tracking-[0.16em] uppercase text-accent-400/90 mb-5">
            Questions fréquentes
          </h2>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.012] overflow-hidden">
            {FAQ.map((item, i) => (
              <div
                key={item.q}
                className={`px-5 py-4 ${i > 0 ? 'border-t border-white/[0.04]' : ''}`}
              >
                <div className="text-sm font-medium text-charcoal/90 mb-1">{item.q}</div>
                <p className="text-sm text-charcoal/55 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className="rounded-2xl border border-accent-500/20 bg-accent-500/[0.04] p-6 text-center">
          <MessageCircle className="w-7 h-7 text-accent-400 mx-auto mb-3" strokeWidth={1.5} />
          <h3 className="font-display font-semibold text-lg">Vous ne trouvez pas votre réponse ?</h3>
          <p className="text-sm text-charcoal/65 mt-1 mb-5 max-w-md mx-auto">
            Notre équipe répond généralement sous 24h.
          </p>
          <Link
            href="/contact"
            className="inline-flex rounded-lg bg-accent-500 hover:bg-accent-600 text-white px-5 py-2 text-sm font-semibold"
          >
            Contacter le support
          </Link>
        </section>
      </div>
    </div>
  )
}
