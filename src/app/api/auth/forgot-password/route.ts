import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { sendPasswordResetEmail } from '@/lib/email'
import { SITE_URL } from '@/lib/site-config'
import { checkRateLimit, clientIp, tooManyRequests, MINUTE, HOUR } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const { email: rawEmail } = await req.json().catch(() => ({}))
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''
  if (!email) return NextResponse.json({ ok: true }) // ne pas révéler si l'email existe

  // Each request sends an email to the address typed in: capped per address (so nobody can
  // flood someone's inbox with reset links) and per connection.
  if (!(await checkRateLimit(`forgot-password:ip:${clientIp(req)}`, 10, HOUR))) return tooManyRequests()
  if (!(await checkRateLimit(`forgot-password:email:${email}`, 1, 2 * MINUTE))) {
    return tooManyRequests('Un e-mail vient déjà d\'être envoyé. Patientez deux minutes avant de redemander.')
  }

  const user = await db.user.findUnique({ where: { email }, select: { id: true } })

  if (user) {
    const token   = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 heure

    // Réutilise la table VerificationToken de NextAuth
    await db.verificationToken.deleteMany({ where: { identifier: `reset:${email}` } })
    await db.verificationToken.create({
      data: { identifier: `reset:${email}`, token, expires },
    })

    const resetLink = `${SITE_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`
    await sendPasswordResetEmail(email, resetLink)
  }

  // Toujours OK : ne pas révéler si l'adresse email est connue
  return NextResponse.json({ ok: true })
}
