import { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import { getPricingConfig, monthlyCreditsForPlan } from '@/lib/pricing'

// Every account owns a FREE workspace from the start: credits, photos and the brand kit hang
// off it. Created at sign-up (password or Google), and by the app shell for an account that
// somehow has none, so a user without a workspace never gets stuck bouncing between pages.
//
// FREE plan: the same "monthly allotment" model as paid plans. There's no Stripe subscription
// to key a renewal off, so renewalDate is set here and /api/cron/reset-free-credits resets it
// (and monthlyCredits) once it's due.
export async function provisionWorkspace(
  userId: string,
  name: string,
  client: Prisma.TransactionClient = db,
): Promise<{ workspaceId: string; freeCredits: number }> {
  const freeCredits = monthlyCreditsForPlan(await getPricingConfig(), 'FREE')
  const renewalDate = new Date()
  renewalDate.setMonth(renewalDate.getMonth() + 1)
  const slug = `ws-${userId}`

  try {
    const workspace = await client.workspace.create({
      data: {
        name,
        slug,
        plan:           'FREE',
        monthlyCredits: freeCredits,
        renewalDate,
        members: { create: { userId, role: 'OWNER' } },
      },
      select: { id: true },
    })
    return { workspaceId: workspace.id, freeCredits }
  } catch (err) {
    // The app layout and the page it wraps render concurrently, so both can try to provision
    // the same missing workspace: the slug is unique, and the loser reuses the winner's.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const existing = await client.workspace.findUnique({ where: { slug }, select: { id: true } })
      if (existing) return { workspaceId: existing.id, freeCredits }
    }
    throw err
  }
}

// The account's first workspace, provisioned on the spot if it has none.
export async function ensureWorkspaceId(userId: string, name?: string | null): Promise<string> {
  const member = await db.workspaceMember.findFirst({
    where:   { userId },
    orderBy: { joinedAt: 'asc' },
    select:  { workspaceId: true },
  })
  if (member) return member.workspaceId
  return (await provisionWorkspace(userId, name || 'My Workspace')).workspaceId
}
