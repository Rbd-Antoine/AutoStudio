import 'dotenv/config'
import path from 'node:path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Read directly rather than through prisma/config's env(), which throws when the variable is
    // unset — that made `npm install` (postinstall: prisma generate) fail on any machine or build
    // without a database configured, even though generating the client never connects to one.
    url: process.env.DATABASE_URL ?? '',
  },
})
