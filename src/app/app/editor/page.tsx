import { redirect } from 'next/navigation'
import { getSessionOrDevBypass } from '@/lib/dev-auth'
import EditorClient from './EditorClient'

export default async function EditorPage() {
  const session = await getSessionOrDevBypass()
  if (!session?.user?.id) redirect('/signin')

  return <EditorClient />
}
