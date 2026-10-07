'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const FAQS = [
  { q: 'Comment fonctionne la génération de rendu ?', a: "Vous importez jusqu'à 5 photos du véhicule, choisissez l'un de nos 4 décors (garage néon, hangar industriel, parking souterrain, pièce vide), et notre IA remplace l'arrière-plan en quelques secondes. Elle a pour consigne stricte de ne toucher ni à la carrosserie, ni aux vitres, ni aux jantes, ni à la plaque." },
  { q: 'Quelle qualité de photo est nécessaire ?', a: "Une photo prise avec un smartphone récent est largement suffisante. Photographiez en pleine lumière naturelle, de 3/4 avant, avec la carrosserie entière visible." },
  { q: 'Puis-je utiliser les rendus dans mes annonces ?', a: "Oui, absolument. Les rendus sont téléchargeables en haute résolution et librement utilisables dans vos annonces, réseaux sociaux ou site web." },
  { q: 'Puis-je publier ces vidéos sur mes réseaux ?', a: "Oui. Chaque rendu peut être transformé en courte vidéo de présentation au format Reel, Story, paysage ou carré — prête à publier sur Instagram, Facebook, LinkedIn ou TikTok, sans montage." },
  { q: 'Le rendu modifie-t-il le véhicule ?', a: "Il ne doit pas : seul l'arrière-plan est remplacé, et l'IA a pour consigne de conserver à l'identique la carrosserie, la peinture, les jantes, les vitres et la plaque. Comme pour toute photo d'annonce, relisez le rendu avant de le publier : si un détail du véhicule a bougé, relancez la génération ou corrigez-le avec la retouche." },
  { q: 'Mon premier rendu est vraiment gratuit ?', a: "Oui, sans aucune condition. Créez votre compte, téléchargez votre photo, choisissez votre style et générez votre premier rendu — sans carte bancaire, sans engagement." },
]

export function FAQSection() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section id="faq" className="section-pad bg-offwhite">
      <div className="page-container max-w-3xl">
        <div className="text-center mb-10">
          <p className="eyebrow mb-3">FAQ</p>
          <h2 className="font-display font-bold text-charcoal mb-4" style={{ fontSize: 'clamp(1.75rem,3.5vw,2.75rem)' }}>
            Questions <span className="text-gradient">fréquentes.</span>
          </h2>
        </div>
        <div className="flex flex-col divide-y divide-charcoal/[0.07]">
          {FAQS.map((faq, i) => (
            <div key={i} className="py-5">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                aria-controls={`faq-panel-${i}`}
                id={`faq-trigger-${i}`}
                className="w-full flex items-start justify-between gap-4 text-left">
                <span className={cn('font-medium text-base transition-colors', open === i ? 'text-accent-600' : 'text-charcoal/75 hover:text-charcoal')}>
                  {faq.q}
                </span>
                {open === i ? <ChevronUp className="w-5 h-5 text-accent-500 mt-0.5 shrink-0" /> : <ChevronDown className="w-5 h-5 text-charcoal/30 mt-0.5 shrink-0" />}
              </button>
              {open === i && (
                <p id={`faq-panel-${i}`} role="region" aria-labelledby={`faq-trigger-${i}`} className="mt-3 text-sm text-charcoal/50 leading-relaxed">
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
