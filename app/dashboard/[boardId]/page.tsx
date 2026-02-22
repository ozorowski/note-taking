import { verifyAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import BoardView from './BoardView'

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const user = await verifyAuth()
  if (!user) redirect('/auth/login')

  const { boardId } = await params

  return <BoardView boardId={boardId} currentUser={user} />
}
