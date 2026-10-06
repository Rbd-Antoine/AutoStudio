import type { Metadata } from 'next'
import { LegalPageLayout, LegalSection } from '@/components/legal/LegalPageLayout'
import { CONTACT_EMAIL } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: "Mentions légales de l'éditeur du site CarGlow.",
}

export default function MentionsLegalesPage() {
  return (
    <LegalPageLayout eyebrow="Informations légales" title="Mentions légales" updated="6 octobre 2026">
      <LegalSection title="Éditeur">
        <p>Entreprise individuelle CarGlow</p>
      </LegalSection>

      <LegalSection title="Adresse">
        <p>
          201 Rua Saraiva de Carvalho<br />
          1250-247 Lisbonne<br />
          Portugal
        </p>
      </LegalSection>

      <LegalSection title="Hébergement">
        <p>
          Vercel Inc.<br />
          440 N Barranca Ave #4133<br />
          Covina, CA 91723, États-Unis<br />
          <a href="https://vercel.com">vercel.com</a>
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
      </LegalSection>
    </LegalPageLayout>
  )
}
