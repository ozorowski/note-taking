import { verifyAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ProjectView from './ProjectView'

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await verifyAuth()
  if (!user) redirect('/auth/login')

  const { projectId } = await params

  return <ProjectView projectId={projectId} currentUser={user} />
}
