import { db } from '@/lib/db'

export interface PublicTestimonial {
  quote: string
  name: string
  role: string | null
  location: string | null
  stars: number
}

// Real, admin-approved customer reviews only (see /app/review + /app/admin/reviews). The
// sections that show them disappear while there are none: the invented placeholder quotes
// this used to pad with were presented to visitors as genuine customer reviews.
//
// The homepage and every auth page render these, so a database hiccup hides the testimonials
// instead of taking those pages down with it.
export async function getPublicTestimonials(): Promise<PublicTestimonial[]> {
  try {
    const approved = await db.review.findMany({
      where: { approved: true },
      orderBy: { createdAt: 'desc' },
      select: { quote: true, displayName: true, role: true, location: true, stars: true },
    })

    return approved.map(r => ({ quote: r.quote, name: r.displayName, role: r.role, location: r.location, stars: r.stars }))
  } catch (err) {
    console.error('[reviews] testimonials unavailable:', err)
    return []
  }
}
