import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, notFound, getProjectRole, getProjectCounts, logActivity } from '@/lib/api-helpers'
import { canAdvancePhase, nextPhase } from '@/lib/phases'
import { broadcastProjectUpdate } from '@/lib/pusher'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { projectId } = await params

  const role = await getProjectRole(projectId, user.user_id)
  if (!role) return notFound()
  // Only owners can advance phases
  if (role !== 'owner') return forbidden()

  const projResult = await query('SELECT current_phase FROM projects WHERE id = $1', [projectId])
  if (!projResult.rows[0]) return notFound()
  const currentPhase = projResult.rows[0].current_phase

  const counts = await getProjectCounts(projectId)
  const { canAdvance, blockers } = canAdvancePhase(currentPhase, counts)

  if (!canAdvance) {
    return NextResponse.json({ error: 'Phase criteria not met', blockers }, { status: 422 })
  }

  const next = nextPhase(currentPhase)
  const result = await query(
    `UPDATE projects SET current_phase = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [next, projectId]
  )

  await logActivity(projectId, user.user_id, `advanced phase to ${next}`, 'project', projectId)
  await broadcastProjectUpdate(projectId)

  return NextResponse.json(result.rows[0])
}
