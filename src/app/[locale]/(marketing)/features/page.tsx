import type { Metadata } from 'next'
import Image from 'next/image'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import { SITE_URL } from '@/lib/site-config'
import { display, sans } from '../_studio/fonts'
import { StudioBar } from '../_studio/StudioBar'

// The product's features, in the home page's dark studio look. Every picture is a real output of
// the editor (render, own background with logo, retouch) or a framing of one (the marketing kit's
// formats); each caption says which.
const TITLE = 'Fonctionnalités'
const DESCRIPTION = "Rendu de studio à partir d'une photo, votre propre fond et votre logo, retouche par instruction, kit marketing : tout ce que fait AutoStudio pour vos annonces."

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | AutoStudio` },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/features` },
  openGraph: { title: `${TITLE} | AutoStudio`, description: DESCRIPTION, url: `${SITE_URL}/features`, type: 'website', images: [{ url: '/features/generation.webp' }] },
}

const DISPLAY = 'font-[family-name:var(--font-studio-display)] uppercase tracking-[-0.01em]'

const FEATURES = [
  {
    id: 'generation',
    eyebrow: 'Le rendu',
    title: 'Une photo de parc. Un rendu de studio.',
    body: "Importez jusqu'à cinq photos d'un véhicule, choisissez un décor, et AutoStudio remplace l'arrière-plan en quelques secondes, avec les ombres et les reflets du nouveau lieu. La voiture, elle, reste celle de la photo : carrosserie, jantes, vitres et plaque.",
    points: ['Quatre décors prêts : garage néon, hangar industriel, parking souterrain, pièce vide', "Un rendu par photo, toutes traitées en même temps", 'Un échec est remboursé automatiquement'],
    image: '/features/generation.webp',
    alt: 'Un SUV blanc : à gauche la photo prise sur un parking, à droite le rendu AutoStudio dans un garage éclairé',
    caption: "À gauche, la photo prise au téléphone. À droite, le rendu AutoStudio de la même photo. La voiture n'a pas bougé.",
  },
  {
    id: 'votre-fond',
    eyebrow: 'Nouveau',
    title: 'Votre showroom. Votre logo.',
    body: "Importez une photo de votre showroom, de votre atelier ou de votre cour : elle devient votre décor, mémorisé pour les fois suivantes. Votre logo, enregistré une fois dans le kit de marque, est apposé sur chaque rendu dans le coin de votre choix.",
    points: ["Le logo est posé tel quel, jamais redessiné par l'IA", 'Une seule photo de fond pour tout votre parc', 'Des annonces qui portent votre lieu et votre marque'],
    image: '/features/votre-fond-logo.webp',
    alt: 'Un break noir dans un showroom clair, avec le logo « Votre garage » en bas à droite',
    caption: 'Rendu réel produit par l’éditeur. Pour la démonstration, le showroom a été généré et le logo « Votre garage » est fictif.',
  },
  {
    id: 'retouche',
    eyebrow: 'La retouche',
    title: 'Une phrase suffit.',
    body: "Pas besoin de tout refaire pour un ajustement. Décrivez la modification en une phrase, et l'IA l'applique au rendu existant, en gardant le reste intact. Chaque retouche crée une nouvelle version : l'ancienne reste disponible.",
    points: ['« Rends la lumière plus chaude »', '« Atténue les reflets sur le pare-brise »', 'Les demandes qui modifieraient le véhicule ne sont pas appliquées'],
    image: '/features/retouche.webp',
    alt: 'Un SUV vert dans un hangar : à gauche le rendu, à droite le même après la retouche « lumière plus chaude »',
    caption: 'Retouche réelle. À gauche le rendu, à droite le même après la consigne « Rends la lumière du hangar plus chaude et plus douce, comme en fin de journée ».',
  },
  {
    id: 'kit-marketing',
    eyebrow: 'Le kit marketing',
    title: 'Prêt pour vos réseaux.',
    body: "À partir d'un rendu, le kit crée de courtes vidéos au format Reel, Story, paysage ou carré, avec votre logo, une musique et votre appel à l'action, ainsi qu'un texte de publication prêt à copier.",
    points: ['Quatre formats, vous ne payez que ceux que vous choisissez', 'Votre logo et le nom de votre établissement', 'Un texte de publication proposé gratuitement'],
    image: '/features/kit-marketing.webp',
    alt: 'Le même rendu cadré en paysage 16:9, en carré 1:1 et en format vertical 9:16',
    caption: 'Les cadrages du kit, à partir d’un même rendu (images fixes ; le kit produit des vidéos).',
  },
] as const

export default function FeaturesPage() {
  return (
    <div className={cn(display.variable, sans.variable, 'min-h-screen bg-[#0C0D0F] font-[family-name:var(--font-studio-sans)] text-[#ECE8E1] antialiased')}>
      <StudioBar active="/features" />
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-32 sm:px-8 lg:px-12">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#F2A93B]">{TITLE}</p>
        <h1 className={cn(DISPLAY, 'mt-3 max-w-4xl font-extrabold leading-[0.9]')} style={{ fontSize: 'clamp(2.75rem, 6vw, 5.5rem)' }}>
          Une photo. Un rendu. Une annonce qui se remarque.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#BDB8AF] sm:text-lg">{DESCRIPTION}</p>
        <nav aria-label="Fonctionnalités" className="mt-8 flex flex-wrap gap-2">
          {FEATURES.map(f => (
            <a key={f.id} href={`#${f.id}`} className="rounded-sm border border-[#2A2D31] px-3.5 py-2 text-sm text-[#CFCAC1] transition-colors hover:border-[#F2A93B] hover:text-[#ECE8E1]">{f.eyebrow}</a>
          ))}
        </nav>

        <div className="mt-20 flex flex-col gap-28">
          {FEATURES.map((f, i) => (
            <section key={f.id} id={f.id} className="grid scroll-mt-28 items-center gap-10 lg:grid-cols-12 lg:gap-14" aria-labelledby={`${f.id}-title`}>
              <div className={cn('lg:col-span-5', i % 2 === 1 && 'lg:order-2')}>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#F2A93B]">{f.eyebrow}</p>
                <h2 id={`${f.id}-title`} className={cn(DISPLAY, 'mt-3 font-extrabold leading-[0.92]')} style={{ fontSize: 'clamp(2rem, 3.6vw, 3.25rem)' }}>{f.title}</h2>
                <p className="mt-5 leading-relaxed text-[#BDB8AF]">{f.body}</p>
                <ul className="mt-6 space-y-2.5 text-sm text-[#CFCAC1]">
                  {f.points.map(p => (
                    <li key={p} className="flex gap-3"><span aria-hidden="true" className="mt-[0.65em] h-px w-3 shrink-0 bg-[#F2A93B]" />{p}</li>
                  ))}
                </ul>
              </div>
              <figure className="lg:col-span-7">
                <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-[#1A1C1F] shadow-[0_0_0_1px_#2A2D31,0_40px_80px_-30px_#000]">
                  <Image src={f.image} alt={f.alt} fill sizes="(min-width: 1024px) 56vw, 100vw" className="object-cover" priority={i === 0} />
                </div>
                <figcaption className="mt-3 text-xs leading-relaxed text-[#9A968E]">{f.caption}</figcaption>
              </figure>
            </section>
          ))}
        </div>

        <div className="mt-28 border-t border-[#2A2D31] pt-12">
          <p className={cn(DISPLAY, 'text-3xl font-extrabold leading-tight sm:text-5xl')}>Votre voiture ne change pas. Son décor, si.</p>
          <p className="mt-4 max-w-xl text-[#BDB8AF]">Premier rendu offert, sans carte bancaire.</p>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Link href="/signup" className="inline-block rounded-sm bg-[#F2A93B] px-7 py-3.5 font-semibold text-[#0C0D0F] transition-transform hover:-translate-y-0.5">Essayer gratuitement</Link>
            <Link href="/#tarifs" className="text-sm text-[#9A968E] underline underline-offset-4 hover:text-[#F2A93B]">Voir les tarifs</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
