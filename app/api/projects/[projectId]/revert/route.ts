import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, notFound, getProjectRole, logActivity } from '@/lib/api-helpers'
import { broadcastProjectUpdate } from '@/lib/pusher'

// Revert a completed project back to 'recommendations' so it can be edited again.
// Only the project owner can do this.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { projectId } = await params

  const role = await getProjectRole(projectId, user.user_id)
  if (!role) return notFound()
  if (role !== 'owner') return forbidden()

  const projResult = await query('SELECT current_phase FROM projects WHERE id = $1', [projectId])
  if (!projResult.rows[0]) return notFound()
  if (projResult.rows[0].current_phase !== 'complete') {
    return NextResponse.json({ error: 'Project is not complete' }, { status: 400 })
  }

  const result = await query(
    `UPDATE projects SET current_phase = 'recommendations', updated_at = NOW() WHERE id = $1 RETURNING *`,
    [projectId]
  )

  await logActivity(projectId, user.user_id, 'reverted to editing', 'project', projectId)
  await broadcastProjectUpdate(projectId)

  return NextResponse.json(result.rows[0])
}
