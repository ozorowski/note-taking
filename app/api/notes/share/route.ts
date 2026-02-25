import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, badRequest, getProjectRole } from '@/lib/api-helpers'
import { broadcastProjectUpdate } from '@/lib/pusher'

export async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const { project_id, interview_id } = await request.json()
  if (!project_id) return badRequest('project_id required')

  const role = await getProjectRole(project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()

  let result
  if (interview_id) {
    result = await query(
      `UPDATE notes SET visibility = 'shared', updated_at = NOW()
       WHERE project_id = $1 AND created_by = $2 AND visibility = 'private' AND interview_id = $3
       RETURNING id`,
      [project_id, user.user_id, interview_id]
    )
  } else {
    result = await query(
      `UPDATE notes SET visibility = 'shared', updated_at = NOW()
       WHERE project_id = $1 AND created_by = $2 AND visibility = 'private'
       RETURNING id`,
      [project_id, user.user_id]
    )
  }

  await broadcastProjectUpdate(project_id)
  return NextResponse.json({ shared_count: result.rowCount ?? 0 })
}
