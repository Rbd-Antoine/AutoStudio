// Local development database, so the site runs on a developer's machine without touching the
// shared one. .env names the shared database (Prisma Postgres); .env.local names this machine's.
// Next.js reads .env.local ahead of .env, but Prisma's CLI and prisma/seed.ts only read .env:
// run through `npx prisma …` directly, a migration or a seed would land on the shared data.
// Every command here passes the local URL explicitly and refuses any URL that is not localhost.
//
//   node C:\Users\BenoitRibeaud\.florelis-dev-db\start.mjs   starts the local Postgres 17
//   npx tsx scripts/local-db.ts migrate                      applies prisma/migrations
//   npx tsx scripts/local-db.ts new <name>                   writes a migration: the SQL from the
//                                                            local database to schema.prisma, then applies it
//   npx tsx scripts/local-db.ts seed <email> <password>      pricing, AI costs, styles, and a
//                                                            verified account to sign in with
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', override: true, quiet: true })

const url = process.env.DATABASE_URL ?? ''
const host = (() => {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
})()
if (host !== 'localhost' && host !== '127.0.0.1') {
  console.error(`DATABASE_URL de .env.local doit viser cette machine (localhost), pas « ${host || 'rien'} ». Rien n'a été fait.`)
  process.exit(1)
}

const env = { ...process.env, DATABASE_URL: url }
const run = (args: string[]) => execFileSync('npx', args, { stdio: 'inherit', shell: true, env })

async function seedAccount(email: string, password: string) {
  run(['tsx', 'prisma/seed.ts'])

  const bcrypt = (await import('bcryptjs')).default
  const { db } = await import('../src/lib/db')
  const { provisionWorkspace } = await import('../src/lib/workspace')

  const user = await db.user.upsert({
    where: { email },
    create: { email, name: email.split('@')[0], password: await bcrypt.hash(password, 10), emailVerified: new Date() },
    update: { password: await bcrypt.hash(password, 10), emailVerified: new Date() },
  })
  const membership = await db.workspaceMember.findFirst({ where: { userId: user.id } })
  if (!membership) {
    const { workspaceId } = await provisionWorkspace(user.id, user.name ?? 'Workspace local')
    await db.workspace.update({ where: { id: workspaceId }, data: { monthlyCredits: 50 } })
  }
  console.log(`Compte local prêt : ${email} (base ${host}). Connexion sur http://localhost:3000/signin`)
  await db.$disconnect()
}

const [command, ...args] = process.argv.slice(2)
if (command === 'migrate') {
  run(['prisma', 'migrate', 'deploy'])
} else if (command === 'new' && args.length === 1 && /^[a-z0-9_]+$/.test(args[0])) {
  // Not `prisma migrate dev`: it refuses to run outside an interactive terminal. The local
  // database is kept at the last migration, so its diff to the schema is the new migration.
  run(['prisma', 'migrate', 'deploy'])
  const sql = execFileSync('npx', ['prisma', 'migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/schema.prisma', '--script'], { shell: true, env, encoding: 'utf8' })
  if (!/^(ALTER|CREATE|DROP)/m.test(sql)) {
    console.log('Aucune différence entre la base locale et schema.prisma : pas de migration.')
    process.exit(0)
  }
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
  const dir = path.join('prisma', 'migrations', `${stamp}_${args[0]}`)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'migration.sql'), sql)
  console.log(`Migration écrite : ${dir}`)
  run(['prisma', 'migrate', 'deploy'])
} else if (command === 'seed' && args.length === 2) {
  seedAccount(args[0].trim().toLowerCase(), args[1]).catch((err) => {
    console.error(err)
    process.exit(1)
  })
} else {
  console.error('Usage : npx tsx scripts/local-db.ts migrate | new <nom_en_minuscules> | seed <email> <mot de passe>')
  process.exit(1)
}
