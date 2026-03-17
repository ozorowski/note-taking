import { verifyAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ProjectView from './ProjectView'

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await verifyAuth()
  if (!user) redirect('/auth/login')

  const { projectId } = await params
  const captureGroupingEnabled = process.env.ENABLE_CAPTURE_GROUPING === 'true'
  const consentReminderEnabled = process.env.ENABLE_CONSENT_REMINDER === 'true'
  const analysisAnonymisationEnabled = process.env.ENABLE_ANALYSIS_ANONYMISATION === 'true'

  return <ProjectView projectId={projectId} currentUser={user} captureGroupingEnabled={captureGroupingEnabled} consentReminderEnabled={consentReminderEnabled} analysisAnonymisationEnabled={analysisAnonymisationEnabled} />
}
