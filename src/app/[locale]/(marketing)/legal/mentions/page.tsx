import type { Metadata } from 'next'
import { LegalPageLayout, LegalSection } from '@/components/legal/LegalPageLayout'
import { CONTACT_EMAIL, LEGAL_ENTITY } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: "Mentions légales de l'éditeur du site AutoStudio.",
}

export default function MentionsLegalesPage() {
  return (
    <LegalPageLayout eyebrow="Informations légales" title="Mentions légales" updated="10 octobre 2026">
      <LegalSection title="Éditeur">
        <p>
          {LEGAL_ENTITY.tradeName}, entreprise individuelle
          {LEGAL_ENTITY.ownerName && <> exploitée par {LEGAL_ENTITY.ownerName}</>}
        </p>
        {LEGAL_ENTITY.taxId && <p>NIF : {LEGAL_ENTITY.taxId}</p>}
        {LEGAL_ENTITY.vat && <p>TVA : {LEGAL_ENTITY.vat}</p>}
        {LEGAL_ENTITY.publicationDirector && <p>Directeur de la publication : {LEGAL_ENTITY.publicationDirector}</p>}
      </LegalSection>

      <LegalSection title="Adresse">
        <p>
          {LEGAL_ENTITY.address.map((line, i) => <span key={i}>{line}<br /></span>)}
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
