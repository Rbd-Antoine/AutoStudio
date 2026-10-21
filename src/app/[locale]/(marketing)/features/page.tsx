import { Check, Sparkles, Wand2, Share2 } from 'lucide-react'
import { CAR_STYLES } from '@/lib/carStyles'

const FEATURE_SECTIONS = [
  {
    id: 'generation',
    icon: Sparkles,
    title: 'Génération de rendu',
    desc:
      "Importez jusqu'à 5 photos du véhicule, choisissez l'un des 4 décors, et l'IA génère un rendu photoréaliste en moins d'une minute. Seul l'arrière-plan est remplacé : l'IA a pour consigne de conserver la carrosserie, les jantes, les vitres et la plaque à l'identique.",
    details: CAR_STYLES.map((s) => `${s.emoji} ${s.name} — ${s.desc}`),
  },
  {
    id: 'retouche',
    icon: Wand2,
    title: 'Retouche par instruction',
    desc:
      "Pas besoin de tout régénérer pour un ajustement. Décrivez la modification en une phrase — \"éclaircis le fond\", \"ajoute un léger reflet au sol\" — et l'IA applique la retouche directement sur le rendu existant.",
    details: [
      'Modifications ciblées sans repartir de zéro',
      'Conserve le reste du rendu à l\'identique',
      'Idéal pour affiner un rendu avant de le publier',
    ],
  },
  {
    id: 'kit-marketing',
    icon: Share2,
    title: 'Kit marketing',
    desc:
      "Déclinez un rendu en courtes vidéos au format Reel, Story, paysage ou carré — prêtes à publier sur Instagram, Facebook, LinkedIn ou TikTok pour mettre en avant votre stock, sans compétence en montage vidéo.",
    details: [
      '4 formats adaptés à chaque réseau social',
      'Votre logo, votre musique et votre appel à l\'action',
      'Un texte de publication proposé, prêt à copier',
    ],
  },
]

export default function FeaturesPage() {
  return (
    <div className="pt-32 pb-20">
      <div className="page-container text-center max-w-2xl mx-auto mb-20">
        <p className="eyebrow mb-3">Fonctionnalités</p>
        <h1 className="text-[clamp(2.5rem,5vw,4rem)] font-display font-bold text-charcoal mb-5">
          Une photo. Un rendu.<br />
          <span className="text-gradient">Un client convaincu.</span>
        </h1>
        <p className="text-lg text-charcoal/50">
          AutoStudio transforme une photo de véhicule en rendu photoréaliste, affine le résultat par
          instruction, puis le transforme en contenu prêt à publier — le tout sans quitter l&apos;outil.
        </p>
      </div>

      <div className="page-container">
        <div className="flex flex-col gap-24">
          {FEATURE_SECTIONS.map((feat, i) => (
            <div
              key={feat.id}
              id={feat.id}
              className={`grid lg:grid-cols-2 gap-16 items-center ${
                i % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''
              }`}
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-accent-500/10 border border-accent-500/20 flex items-center justify-center mb-6">
                  <feat.icon className="w-5 h-5 text-accent-400" />
                </div>
                <h2 className="text-3xl font-display font-bold text-charcoal mb-4">{feat.title}</h2>
                <p className="text-charcoal/60 leading-relaxed mb-6">{feat.desc}</p>
                <ul className="flex flex-col gap-2.5">
                  {feat.details.map((d) => (
                    <li key={d} className="flex items-start gap-3 text-sm text-charcoal/60">
                      <Check className="w-4 h-4 text-accent-500 mt-0.5 shrink-0" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
              {/* Visual placeholder */}
              <div className="aspect-[4/3] rounded-3xl bg-gradient-to-br from-accent-500/[0.08] to-charcoal-600/50 border border-white/[0.06] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-charcoal/20">
                  <feat.icon className="w-12 h-12" />
                  <span className="text-sm font-medium">{feat.title}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
