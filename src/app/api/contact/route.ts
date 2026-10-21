import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { CONTACT_EMAIL, EMAIL_FROM } from '@/lib/site-config'
import { checkRateLimit, clientIp, tooManyRequests, HOUR } from '@/lib/rate-limit'

// Constructed lazily (not at module scope) so importing this route — e.g. during Next's
// build-time page-data collection — never throws just because RESEND_API_KEY isn't set
// in that environment. The key is only actually needed once a request comes in.
let resend: Resend | null = null
function getResend(): Resend {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY)
  return resend
}

// Visitors' input goes into the HTML body of the email we receive, so it is escaped.
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const UNAVAILABLE = "L'envoi du message a échoué. Réessayez plus tard ou écrivez-nous directement par e-mail."

const MAX_LENGTHS = { prenom: 100, nom: 100, email: 254, sujet: 200, message: 5000 }
const LABELS = { prenom: 'Prénom', nom: 'Nom', email: 'E-mail', sujet: 'Sujet', message: 'Message' }

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const fields = Object.fromEntries(
    Object.keys(MAX_LENGTHS).map(key => [key, typeof body[key] === 'string' ? body[key].trim() : '']),
  ) as Record<keyof typeof MAX_LENGTHS, string>
  const { prenom, nom, email, sujet, message } = fields

  if (!email || !message || !prenom) {
    return NextResponse.json({ error: 'Champs requis manquants.' }, { status: 400 })
  }
  // The address becomes the email's reply-to: it must be a single, plain address.
  if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)) {
    return NextResponse.json({ error: 'Adresse e-mail invalide.' }, { status: 400 })
  }
  const tooLong = (Object.keys(MAX_LENGTHS) as (keyof typeof MAX_LENGTHS)[]).find(key => fields[key].length > MAX_LENGTHS[key])
  if (tooLong) {
    return NextResponse.json({ error: `Le champ « ${LABELS[tooLong]} » est trop long.` }, { status: 400 })
  }

  if (!(await checkRateLimit(`contact:${clientIp(req)}`, 5, HOUR))) {
    return tooManyRequests('Trop de messages envoyés. Réessayez dans une heure ou écrivez-nous directement par e-mail.')
  }

  try {
    const { error } = await getResend().emails.send({
      from:    EMAIL_FROM,
      to:      CONTACT_EMAIL,
      replyTo: email,
      subject: `${prenom} ${nom} via AutoStudio${sujet ? ` — ${sujet}` : ''}`,
      text:    `De : ${prenom} ${nom} <${email}>\nSujet : ${sujet}\n\n${message}`,
      html:    `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#14161A">Nouveau message via le formulaire de contact AutoStudio</h2>
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
            <tr><td style="padding:6px 0;color:#666;width:100px">De</td><td style="padding:6px 0;font-weight:600">${escapeHtml(prenom)} ${escapeHtml(nom)}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0">${escapeHtml(email)}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Sujet</td><td style="padding:6px 0">${escapeHtml(sujet) || '—'}</td></tr>
          </table>
          <div style="background:#f5faf6;border-radius:12px;padding:16px;white-space:pre-wrap;color:#14161A">${escapeHtml(message)}</div>
        </div>
      `,
    })

    if (error) {
      console.error('[contact] Resend error:', error)
      return NextResponse.json({ error: UNAVAILABLE }, { status: 502 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    // e.g. RESEND_API_KEY missing: the Resend client throws instead of returning an error.
    console.error('[contact] send failed:', err)
    return NextResponse.json({ error: UNAVAILABLE }, { status: 503 })
  }
}
