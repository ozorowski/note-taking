import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, badRequest, getProjectRole } from '@/lib/api-helpers'
import { broadcastProjectUpdate } from '@/lib/pusher'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const { groupId } = await params
  const { project_id } = await request.json()
  if (!project_id) return badRequest('project_id required')

  const role = await getProjectRole(project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()

  // Verify group belongs to this project
  const { rows } = await query(
    `SELECT id FROM capture_groups WHERE id = $1 AND project_id = $2`,
    [groupId, project_id]
  )
  if (rows.length === 0)
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })

  // Delete group — ON DELETE SET NULL cascades capture_group_id on notes automatically
  await query(`DELETE FROM capture_groups WHERE id = $1`, [groupId])
  await broadcastProjectUpdate(project_id)

  return NextResponse.json({ ok: true })
}
