import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPageLayout, LegalSection } from '@/components/legal/LegalPageLayout'
import { CONTACT_EMAIL, LEGAL_ENTITY } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Conditions générales',
  description: "Conditions générales d'utilisation et de vente d'AutoStudio.",
}

export default function TermsPage() {
  return (
    <LegalPageLayout eyebrow="Conditions générales" title="Conditions générales d'utilisation et de vente" updated="10 octobre 2026">
      <LegalSection n="1" title="Éditeur">
        <p>
          AutoStudio est exploité par une entreprise individuelle
          {LEGAL_ENTITY.ownerName && <> ({LEGAL_ENTITY.ownerName})</>}.
        </p>
        {LEGAL_ENTITY.taxId && <p>NIF : {LEGAL_ENTITY.taxId}</p>}
        {LEGAL_ENTITY.vat && <p>TVA : {LEGAL_ENTITY.vat}</p>}
        <p>
          <strong className="text-charcoal/80 font-semibold">Adresse :</strong><br />
          {LEGAL_ENTITY.address.map((line, i) => <span key={i}>{line}<br /></span>)}
        </p>
        <p>
          <strong className="text-charcoal/80 font-semibold">Contact :</strong>{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </LegalSection>

      <LegalSection n="2" title="Objet du service">
        <p>
          AutoStudio est une plateforme SaaS destinée aux professionnels de l&apos;automobile permettant, grâce à
          l&apos;intelligence artificielle, de remplacer l&apos;arrière-plan de photographies de véhicules fournies par
          l&apos;utilisateur, de retoucher ces rendus et d&apos;en tirer des contenus marketing (vidéos courtes, textes
          pour les réseaux sociaux).
        </p>
      </LegalSection>

      <LegalSection n="3" title="Acceptation">
        <p>L&apos;utilisation d&apos;AutoStudio implique l&apos;acceptation sans réserve des présentes conditions.</p>
        <p>Si l&apos;utilisateur n&apos;accepte pas ces conditions, il ne doit pas utiliser le service.</p>
      </LegalSection>

      <LegalSection n="4" title="Compte utilisateur">
        <p>L&apos;utilisateur est responsable :</p>
        <ul>
          <li>des informations communiquées lors de son inscription ;</li>
          <li>de la confidentialité de ses identifiants ;</li>
          <li>de toute activité réalisée depuis son compte.</li>
        </ul>
        <p>
          AutoStudio peut suspendre ou supprimer un compte en cas de fraude, d&apos;utilisation abusive, de tentative
          de piratage ou de violation des présentes conditions.
        </p>
      </LegalSection>

      <LegalSection n="5" title="Utilisation du service">
        <p>L&apos;utilisateur garantit :</p>
        <ul>
          <li>disposer des droits nécessaires sur les photographies importées ;</li>
          <li>ne pas importer de contenus illicites, diffamatoires, haineux ou portant atteinte aux droits de tiers ;</li>
          <li>utiliser AutoStudio uniquement dans un cadre légal.</li>
        </ul>
        <p>Il est interdit de tenter de contourner les limitations techniques ou de perturber le fonctionnement du service.</p>
      </LegalSection>

      <LegalSection n="6" title="Intelligence artificielle">
        <p>AutoStudio utilise notamment les modèles d&apos;intelligence artificielle de Google Gemini afin de générer les contenus demandés.</p>
        <p>Les résultats produits sont générés automatiquement et peuvent contenir des erreurs, imprécisions ou différences par rapport aux attentes.</p>
        <p>
          Avant toute publication, l&apos;utilisateur vérifie que chaque rendu représente fidèlement le véhicule
          (état, couleur, équipements, immatriculation) : les rendus ne constituent ni une description contractuelle
          du véhicule ni une garantie de résultat.
        </p>
        <p>L&apos;utilisateur reste seul responsable de l&apos;usage qu&apos;il fait des contenus générés, notamment dans ses annonces.</p>
      </LegalSection>

      <LegalSection n="7" title="Propriété intellectuelle">
        <p>AutoStudio demeure propriétaire :</p>
        <ul>
          <li>du logiciel ;</li>
          <li>du site internet ;</li>
          <li>du logo ;</li>
          <li>de l&apos;interface ;</li>
          <li>des fonctionnalités.</li>
        </ul>
        <p>Les photographies importées restent la propriété de leurs auteurs.</p>
        <p>
          Sous réserve du respect des droits des tiers et des présentes conditions, les contenus générés peuvent
          être utilisés librement par l&apos;utilisateur dans le cadre de son activité professionnelle.
        </p>
      </LegalSection>

      <LegalSection n="8" title="Tarifs et abonnements">
        <p>Les prix sont affichés sur le site.</p>
        <p>Les abonnements sont renouvelés automatiquement jusqu&apos;à leur résiliation.</p>
        <p>L&apos;utilisateur peut mettre fin à son abonnement à tout moment depuis son espace client.</p>
        <p>La résiliation prend effet à la fin de la période déjà payée.</p>
        <p>Aucun remboursement n&apos;est effectué pour une période déjà commencée, sauf disposition légale impérative.</p>
      </LegalSection>

      <LegalSection n="9" title="Paiement">
        <p>Les paiements sont traités exclusivement par Stripe.</p>
        <p>AutoStudio n&apos;a jamais accès aux numéros de cartes bancaires.</p>
        <p>En cas d&apos;échec de paiement, l&apos;accès aux fonctionnalités payantes peut être suspendu.</p>
      </LegalSection>

      <LegalSection n="10" title="Disponibilité">
        <p>AutoStudio s&apos;efforce d&apos;assurer une disponibilité maximale.</p>
        <p>Toutefois, aucune disponibilité permanente n&apos;est garantie.</p>
        <p>Des interruptions peuvent intervenir pour :</p>
        <ul>
          <li>maintenance ;</li>
          <li>mise à jour ;</li>
          <li>incident technique ;</li>
          <li>force majeure.</li>
        </ul>
      </LegalSection>

      <LegalSection n="11" title="Limitation de responsabilité">
        <p>Dans les limites autorisées par la loi, AutoStudio ne pourra être tenu responsable notamment :</p>
        <ul>
          <li>des pertes d&apos;exploitation ;</li>
          <li>de la perte de clientèle ;</li>
          <li>d&apos;une mauvaise interprétation des rendus ;</li>
          <li>de l&apos;usage des rendus par l&apos;utilisateur, notamment dans ses annonces ;</li>
          <li>de pertes indirectes ou immatérielles.</li>
        </ul>
        <p>La responsabilité maximale d&apos;AutoStudio est limitée au montant effectivement payé par l&apos;utilisateur au cours des douze derniers mois.</p>
      </LegalSection>

      <LegalSection n="12" title="Protection des données">
        <p>AutoStudio respecte le Règlement Général sur la Protection des Données (RGPD).</p>
        <p>Les données peuvent comprendre notamment :</p>
        <ul>
          <li>nom ;</li>
          <li>adresse e-mail ;</li>
          <li>informations de connexion ;</li>
          <li>photographies importées ;</li>
          <li>historique des générations ;</li>
          <li>informations relatives aux abonnements.</li>
        </ul>
        <p>Les données bancaires sont exclusivement traitées par Stripe.</p>
        <p>Pour le détail des traitements, consultez notre <Link href="/legal/privacy" className="text-accent-600 underline underline-offset-2 hover:text-accent-700">politique de confidentialité</Link>.</p>
      </LegalSection>

      <LegalSection n="13" title="Utilisation des images">
        <p>Les images envoyées par l&apos;utilisateur sont utilisées uniquement afin de produire les rendus demandés.</p>
        <p>Selon la fonctionnalité utilisée, elles peuvent être transmises de manière sécurisée à Google Gemini pour permettre la génération des contenus.</p>
        <p>AutoStudio ne revendique aucun droit de propriété sur les photographies importées.</p>
      </LegalSection>

      <LegalSection n="14" title="Prestataires">
        <p>AutoStudio utilise différents prestataires techniques, notamment :</p>
        <ul>
          <li>Google Gemini pour la génération de contenus IA ;</li>
          <li>Stripe pour les paiements ;</li>
          <li>les services d&apos;hébergement et d&apos;infrastructure nécessaires au fonctionnement de la plateforme.</li>
        </ul>
        <p>Ces prestataires traitent uniquement les données nécessaires à la fourniture du service.</p>
      </LegalSection>

      <LegalSection n="15" title="Conservation des données">
        <p>Les données sont conservées uniquement pendant la durée nécessaire :</p>
        <ul>
          <li>au fonctionnement du service ;</li>
          <li>au respect des obligations légales ;</li>
          <li>à la gestion de la relation client.</li>
        </ul>
      </LegalSection>

      <LegalSection n="16" title="Droits des utilisateurs">
        <p>Conformément au RGPD, chaque utilisateur peut demander :</p>
        <ul>
          <li>l&apos;accès à ses données ;</li>
          <li>leur rectification ;</li>
          <li>leur suppression ;</li>
          <li>leur limitation ;</li>
          <li>leur portabilité ;</li>
          <li>ou s&apos;opposer à certains traitements.</li>
        </ul>
        <p>Toute demande peut être adressée à <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </LegalSection>

      <LegalSection n="17" title="Cookies">
        <p>AutoStudio utilise des cookies afin :</p>
        <ul>
          <li>d&apos;assurer le fonctionnement du site ;</li>
          <li>de maintenir la session utilisateur ;</li>
          <li>de mesurer l&apos;audience ;</li>
          <li>d&apos;améliorer le service.</li>
        </ul>
        <p>
          Les cookies non essentiels sont soumis au consentement de l&apos;utilisateur lorsque la réglementation
          l&apos;exige. Voir notre <Link href="/legal/cookies" className="text-accent-600 underline underline-offset-2 hover:text-accent-700">politique de cookies</Link>.
        </p>
      </LegalSection>

      <LegalSection n="18" title="Sécurité">
        <p>AutoStudio met en œuvre des mesures techniques et organisationnelles raisonnables afin de protéger les données contre toute perte, accès non autorisé ou divulgation.</p>
        <p>Aucun système informatique ne pouvant garantir une sécurité absolue, AutoStudio ne peut toutefois garantir une protection totale contre tous les risques.</p>
      </LegalSection>

      <LegalSection n="19" title="Suspension ou résiliation">
        <p>AutoStudio peut suspendre immédiatement un compte en cas :</p>
        <ul>
          <li>d&apos;utilisation frauduleuse ;</li>
          <li>de tentative de piratage ;</li>
          <li>de non-paiement ;</li>
          <li>de violation des présentes conditions.</li>
        </ul>
      </LegalSection>

      <LegalSection n="20" title="Modification des conditions">
        <p>Les présentes conditions peuvent être modifiées à tout moment.</p>
        <p>La version publiée sur le site fait foi.</p>
      </LegalSection>

      <LegalSection n="21" title="Droit applicable">
        <p>Les présentes conditions sont régies par le droit portugais.</p>
        <p>Les parties s&apos;engagent à rechercher une solution amiable avant toute procédure judiciaire.</p>
      </LegalSection>

      <LegalSection n="22" title="Contact">
        <p>Toute question peut être adressée à <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </LegalSection>
    </LegalPageLayout>
  )
}
