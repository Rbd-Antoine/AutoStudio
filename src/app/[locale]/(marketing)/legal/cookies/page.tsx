import type { Metadata } from 'next'
import { Link } from '@/i18n/routing'
import { LegalPageLayout, LegalSection } from '@/components/legal/LegalPageLayout'
import { CONTACT_EMAIL } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Politique de cookies',
  description: 'Quels cookies AutoStudio utilise et pourquoi.',
}

export default function CookiesPage() {
  return (
    <LegalPageLayout eyebrow="Cookies" title="Politique de cookies" updated="10 octobre 2026">
      <LegalSection title="Résumé">
        <p>
          Le site utilise des cookies techniques indispensables à son fonctionnement et, uniquement avec votre
          consentement, des cookies de mesure d&apos;audience et des cookies marketing.
        </p>
      </LegalSection>

      <LegalSection title="Cookies utilisés">
        <ul>
          <li>
            <strong>Nécessaires</strong> (toujours actifs) : session de connexion et sécurité (Auth.js), et
            mémorisation de vos choix de cookies (<code>autostudio_consent</code>, 6 mois).
          </li>
          <li>
            <strong>Mesure d&apos;audience</strong> (avec consentement) : PostHog, pour les statistiques de visite et
            l&apos;enregistrement des sessions, les champs de saisie étant masqués.
          </li>
          <li>
            <strong>Marketing</strong> (avec consentement) : Meta (Facebook) Pixel, pour mesurer l&apos;efficacité de
            nos publicités. Implique un transfert de données à Meta.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Pourquoi nous utilisons des cookies">
        <p>AutoStudio utilise des cookies afin :</p>
        <ul>
          <li>d&apos;assurer le fonctionnement du site ;</li>
          <li>de maintenir la session utilisateur ;</li>
          <li>de mesurer l&apos;audience ;</li>
          <li>d&apos;améliorer le service.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Vos choix">
        <p>
          Les cookies strictement nécessaires au fonctionnement du site ne requièrent pas de consentement.
          Les autres ne sont déposés qu&apos;après votre accord, donné catégorie par catégorie dans le bandeau
          affiché lors de votre première visite. Vous pouvez modifier ou retirer ce choix à tout moment via le
          lien « Gérer les cookies » en bas de chaque page, et supprimer les cookies depuis les paramètres de
          votre navigateur. Votre choix vous est redemandé au plus tard tous les 6 mois.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Pour toute question, écrivez à <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          Voir aussi notre <Link href="/legal/privacy" className="text-accent-600 underline underline-offset-2 hover:text-accent-700">politique de confidentialité</Link>.
        </p>
      </LegalSection>
    </LegalPageLayout>
  )
}
