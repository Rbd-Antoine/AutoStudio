// Checks from the outside that the production site is fully operational: DNS, the Vercel
// domain, the deployed commit and its environment variables, Google sign-in, the Stripe webhook
// route, the contact address and, when it can, Resend. Each failure prints what to do; the
// detailed steps for Vercel, Google Cloud, Resend and Stripe are in docs/mise-en-ligne.md.
// (Adapted from the sister product Florelis.)
//
//   npx tsx scripts/check-production.ts https://domaine.com          read-only: nothing is created or sent
//   npx tsx scripts/check-production.ts https://domaine.com --email  also sends ONE contact-form
//                                                                     message, to prove Resend delivers
//
// The address can also come from PRODUCTION_URL or NEXT_PUBLIC_SITE_URL. With a full-access
// RESEND_API_KEY in the environment it also reads the domain's status in Resend. Exit code 1
// when anything failed.

import { execSync } from 'node:child_process'

const arg = process.argv.slice(2).find(a => /^https?:\/\//.test(a))
const SITE = (arg || process.env.PRODUCTION_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '')
if (!SITE) {
  console.error('Adresse du site manquante : npx tsx scripts/check-production.ts https://domaine.com')
  process.exit(1)
}
const DOMAIN = new URL(SITE).hostname.replace(/^www\./, '')
const ON_VERCEL_APP = DOMAIN.endsWith('.vercel.app')
const CALLBACK = `${SITE}/api/auth/callback/google`
const WEBHOOK = `${SITE}/api/webhooks/stripe`
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'autostudioia@gmail.com'
const DOC = 'docs/mise-en-ligne.md'
const REDEPLOY = `Vercel, Settings, Environment Variables, Production : NEXTAUTH_URL = ${SITE}, puis redéployer`

let failures = 0
function report(ok: boolean | null, label: string, fix?: string) {
  const tag = ok === true ? 'OK     ' : ok === false ? 'ÉCHEC  ' : 'À VOIR '
  if (ok === false) failures++
  console.log(`${tag}${label}`)
  if (ok !== true && fix) console.log(`       À faire : ${fix}`)
}

function section(title: string) {
  console.log(`\n── ${title}`)
}

function get(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20_000), ...init })
}

// Redirects may carry a relative Location: resolve it against the URL that was asked for.
function locationOf(res: Response, from: string): string {
  const location = res.headers.get('location')
  return location ? new URL(location, from).href : ''
}

// DNS over HTTPS, so the script behaves the same on Windows, macOS and Linux.
const DNS_TYPES = { A: 1, CNAME: 5, TXT: 16, MX: 15 } as const
async function dns(name: string, type: keyof typeof DNS_TYPES): Promise<string[]> {
  const res = await get(`https://dns.google/resolve?name=${name}&type=${type}`)
  const body = (await res.json()) as { Answer?: { type: number; data: string }[] }
  return (body.Answer ?? [])
    .filter(a => a.type === DNS_TYPES[type])
    .map(a => a.data.replace(/"\s*"/g, '').replace(/^"|"$/g, ''))
}

async function checkDns() {
  section('DNS')
  if (ON_VERCEL_APP) {
    report(null, `${DOMAIN} est une adresse Vercel : pas de DNS à vérifier`, `${DOC}, « Domaine » : rattacher le vrai domaine avant le lancement`)
    return
  }
  const a = await dns(DOMAIN, 'A')
  report(a.some(ip => ip === '216.198.79.1' || ip === '76.76.21.21'), `A @ : ${a.join(', ') || 'absent'}`,
    "chez le registrar, zone DNS : A @ vers l'adresse affichée par Vercel (Settings, Domains)")

  const www = await dns(`www.${DOMAIN}`, 'CNAME')
  report(www.some(t => /vercel-dns(-\d+)?\.com\.?$/.test(t)), `CNAME www : ${www.join(', ') || 'absent'}`,
    'chez le registrar : CNAME www vers la cible affichée par Vercel')

  // Resend: the DKIM key, and the SPF/MX of its "send" subdomain (the bounce domain).
  const dkim = await dns(`resend._domainkey.${DOMAIN}`, 'TXT')
  report(dkim.some(t => t.startsWith('p=')), `TXT resend._domainkey : ${dkim.length ? 'présent' : 'absent'}`,
    'chez le registrar : TXT resend._domainkey avec la clé affichée par Resend, Domains')
  const spf = await dns(`send.${DOMAIN}`, 'TXT')
  report(spf.some(t => t.startsWith('v=spf1') && t.includes('amazonses.com')), `TXT send (SPF) : ${spf.join(', ') || 'absent'}`,
    'chez le registrar : TXT send avec la valeur SPF affichée par Resend')
  const mx = await dns(`send.${DOMAIN}`, 'MX')
  report(mx.some(t => t.includes('amazonses.com')), `MX send : ${mx.join(', ') || 'absent'}`,
    'chez le registrar : MX send avec la valeur affichée par Resend')

  const dmarc = await dns(`_dmarc.${DOMAIN}`, 'TXT')
  report(dmarc.some(t => t.startsWith('v=DMARC1')), `TXT _dmarc : ${dmarc.join(', ') || 'absent'}`,
    'chez le registrar : TXT _dmarc = v=DMARC1; p=none;')
}

async function checkDomain() {
  section('Domaine sur Vercel')
  const apex = await get(`${SITE}/`)
  report(apex.status === 200, `${SITE} répond ${apex.status}`,
    `Vercel, Settings, Domains : ${DOMAIN} rattaché à Production, sans redirection`)
  if (ON_VERCEL_APP) return

  const www = await get(`https://www.${DOMAIN}/`)
  const location = locationOf(www, `https://www.${DOMAIN}/`)
  report(www.status === 308 && location.startsWith(SITE), `www répond ${www.status} vers ${location || '(rien)'}`,
    `Vercel, Domains : www.${DOMAIN} en redirection 308 vers ${DOMAIN}, et non l'inverse`)
}

async function checkDeployment() {
  section('Version déployée et variables Vercel')
  const res = await get(`${SITE}/api/health`)
  if (res.status !== 200) {
    report(false, `/api/health répond ${res.status} : la version en ligne est plus ancienne que main`,
      'Vercel, Deployments : déployer le dernier commit de main')
    return
  }
  const health = (await res.json()) as {
    commit: string | null
    nextauthUrl: string
    devAuthBypass: boolean
    missingRequired: string[]
    optional: Record<string, boolean>
  }

  let main = ''
  try {
    main = execSync('git rev-parse --short=7 origin/main', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    // Not run from a git checkout: the commit is still printed below.
  }
  if (main && health.commit) {
    report(health.commit === main ? true : null, `commit en ligne ${health.commit}, origin/main ${main}`,
      'si main est plus récent : git fetch, puis Vercel, Deployments, déployer main')
  } else {
    report(null, `commit en ligne : ${health.commit ?? 'inconnu'}`)
  }

  report(health.nextauthUrl === SITE, `NEXTAUTH_URL : ${health.nextauthUrl}`, REDEPLOY)
  report(!health.devAuthBypass, `DEV_AUTH_BYPASS ${health.devAuthBypass ? 'présent' : 'absent'} sur Vercel`,
    "le .env local a été recopié tel quel : supprimer DEV_AUTH_BYPASS et vérifier chaque variable (DATABASE_URL, NEXTAUTH_URL)")

  const missing = health.missingRequired
  report(missing.length === 0,
    missing.length ? `variables obligatoires absentes : ${missing.join(', ')}` : 'toutes les variables obligatoires sont présentes',
    `les ajouter en Production, voir le tableau de ${DOC}, puis redéployer`)

  const optionalMissing = Object.entries(health.optional).filter(([, set]) => !set).map(([key]) => key)
  if (optionalMissing.length) console.log(`       Facultatives absentes : ${optionalMissing.join(', ')}`)
}

async function checkGoogle() {
  section('Connexion Google')
  const providers = (await (await get(`${SITE}/api/auth/providers`)).json()) as { google?: { callbackUrl: string } }
  if (!providers.google) {
    report(null, 'connexion Google désactivée (GOOGLE_CLIENT_ID absent) : seul le mot de passe est proposé', `${DOC}, « Google Cloud »`)
  } else {
    report(providers.google.callbackUrl === CALLBACK, `adresse de retour annoncée : ${providers.google.callbackUrl}`, REDEPLOY)
  }

  const app = await get(`${SITE}/app`)
  const appLocation = locationOf(app, `${SITE}/app`)
  report(appLocation.startsWith(`${SITE}/signin`), `/app sans session redirige vers ${appLocation || '(rien)'}`, REDEPLOY)
  if (!providers.google) return

  // Start a real sign-in to read what Google is sent, then ask Google whether it accepts it.
  const csrfRes = await get(`${SITE}/api/auth/csrf`)
  const cookies = csrfRes.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }
  const start = await get(`${SITE}/api/auth/signin/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookies },
    body: new URLSearchParams({ csrfToken, callbackUrl: `${SITE}/app` }),
  })
  const googleUrl = start.headers.get('location') ?? ''
  if (!googleUrl.startsWith('https://accounts.google.com/')) {
    report(false, `le début de connexion Google renvoie ${start.status} vers ${googleUrl || '(rien)'}`,
      'vérifier GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET sur Vercel')
    return
  }
  const params = new URL(googleUrl).searchParams
  const client = params.get('client_id') ?? ''
  report(params.get('redirect_uri') === CALLBACK, `redirect_uri envoyée à Google : ${params.get('redirect_uri')}`, REDEPLOY)

  const page = await fetch(googleUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'fr' },
    signal: AbortSignal.timeout(20_000),
  })
  const html = await page.text()
  if (html.includes('redirect_uri_mismatch')) {
    report(false, `Google refuse ${CALLBACK} (redirect_uri_mismatch)`,
      `Google Cloud, API et services, Identifiants, client OAuth ${client.slice(0, 20)}… : ` +
      `ajouter ${SITE} aux origines JavaScript autorisées et ${CALLBACK} aux URI de redirection autorisés`)
  } else if (/invalid_client|deleted_client|OAuth client was not found/i.test(html)) {
    report(false, `Google ne reconnaît pas le client ${client}`, 'vérifier GOOGLE_CLIENT_ID sur Vercel')
  } else {
    report(true, `Google accepte ${CALLBACK}`)
  }
}

async function checkStripe() {
  section('Stripe')
  // No signature header: the route answers before doing anything, so this has no side effect.
  const res = await get(WEBHOOK, { method: 'POST', body: '{}' })
  const reachable = res.status !== 404 && (res.status < 300 || res.status >= 400)
  report(reachable, `route du webhook joignable sans redirection (${res.status})`, `le webhook doit viser exactement ${WEBHOOK}`)
  report(null, "URL du webhook côté Stripe : non vérifiable d'ici",
    `Stripe, mode production, Développeurs, Webhooks : l'endpoint vise ${WEBHOOK} et ses dernières livraisons répondent 200`)

  // With the Stripe key and the six price ids in the environment, check each price exists,
  // is live, recurring or one-time as it should be, and in euros.
  const key = process.env.STRIPE_SECRET_KEY
  const prices = ['ESSENTIAL', 'PRO', 'BUSINESS', 'PACK_50', 'PACK_150', 'PACK_400'].map(name => [name, process.env[`STRIPE_PRICE_${name}`]] as const)
  if (!key || prices.some(([, id]) => !id)) {
    report(null, "prix Stripe non vérifiables sans STRIPE_SECRET_KEY et les six STRIPE_PRICE_* dans l'environnement")
    return
  }
  for (const [name, id] of prices) {
    const r = await get(`https://api.stripe.com/v1/prices/${id}`, { headers: { Authorization: `Bearer ${key}` } })
    const price = (await r.json()) as { currency?: string; unit_amount?: number; livemode?: boolean; active?: boolean; type?: string }
    const wantRecurring = !name.startsWith('PACK')
    const ok = r.ok && price.currency === 'eur' && price.active === true && (price.type === 'recurring') === wantRecurring
    report(ok, `${name} : ${r.ok ? `${(price.unit_amount ?? 0) / 100} € ${price.type}${price.livemode ? '' : ' (mode test)'}${price.active ? '' : ' (archivé)'}` : `illisible (${r.status})`}`,
      `Stripe, Catalogue de produits : STRIPE_PRICE_${name} doit être un prix ${wantRecurring ? 'mensuel récurrent' : 'unique'} actif en euros`)
  }
}

async function checkEmail(sendTest: boolean) {
  section('Emails')
  const mentions = await (await get(`${SITE}/legal/mentions`)).text()
  const shown = mentions.includes(CONTACT_EMAIL)
  report(shown, `adresse de contact affichée : ${shown ? CONTACT_EMAIL : 'autre'}`, 'NEXT_PUBLIC_CONTACT_EMAIL sur Vercel, puis redéployer')

  const key = process.env.RESEND_API_KEY
  if (key && !ON_VERCEL_APP) {
    const res = await get('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${key}` } })
    if (res.ok) {
      const { data } = (await res.json()) as { data: { name: string; status: string; region: string }[] }
      const domain = data.find(d => d.name === DOMAIN)
      report(domain?.status === 'verified', `Resend, domaine ${DOMAIN} : ${domain ? `${domain.status} (${domain.region})` : 'absent de ce compte'}`,
        domain ? 'Resend, Domains : cliquer sur « Verify DNS Records »' : "ajouter le domaine dans Resend, ou la clé RESEND_API_KEY vient d'un autre compte")
    } else {
      report(null, `Resend : la clé locale ne permet pas de lire les domaines (${res.status})`,
        'regarder Resend, Domains : le statut doit être Verified')
    }
  } else {
    report(null, 'Resend : statut du domaine non vérifiable ici',
      `regarder Resend, Domains : ${DOMAIN} doit être Verified, et EMAIL_FROM une adresse de ce domaine ; ou relancer avec --email`)
  }

  if (!sendTest) return
  const res = await get(`${SITE}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prenom: 'Test',
      nom: 'Mise en ligne',
      email: CONTACT_EMAIL,
      sujet: 'Vérification automatique',
      message: 'Message envoyé par scripts/check-production.ts pour vérifier que Resend envoie bien les emails.',
    }),
  })
  report(res.status === 200, `formulaire de contact : ${res.status}${res.status === 200 ? `, un message part vers ${CONTACT_EMAIL}` : ''}`,
    "Resend : domaine pas encore Verified, ou RESEND_API_KEY absente sur Vercel ou issue d'un autre compte")
}

async function main() {
  console.log(`Vérification de ${SITE}, ${new Date().toLocaleString('fr-FR')}`)
  for (const step of [checkDns, checkDomain, checkDeployment, checkGoogle, checkStripe]) {
    try {
      await step()
    } catch (err) {
      report(false, `${step.name} a échoué : ${(err as Error).message}`)
    }
  }
  try {
    await checkEmail(process.argv.includes('--email'))
  } catch (err) {
    report(false, `checkEmail a échoué : ${(err as Error).message}`)
  }
  console.log(failures ? `\n${failures} échec(s). Étapes détaillées : ${DOC}` : '\nTout est opérationnel côté infrastructure.')
  process.exitCode = failures ? 1 : 0
}

main()
