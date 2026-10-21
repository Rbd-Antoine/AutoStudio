import type { DefaultSession } from 'next-auth'
// Loads the module so the augmentation below applies to it.
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      workspaceId?: string
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    workspaceId?: string
  }
}
