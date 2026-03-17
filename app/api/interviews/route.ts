import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, badRequest, getProjectRole, logActivity } from '@/lib/api-helpers'

export async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { project_id, participant_name, raw_notes } = await request.json()
  if (!project_id || !participant_name?.trim()) return badRequest('project_id and participant_name required')

  const role = await getProjectRole(project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()

  const { rows: [{ next_num }] } = await query(
    `SELECT COALESCE(MAX(display_number), 0) + 1 AS next_num FROM interviews WHERE project_id = $1`,
    [project_id]
  )
  const result = await query(
    `INSERT INTO interviews (project_id, participant_name, raw_notes, created_by, display_number) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [project_id, participant_name.trim(), raw_notes?.trim() || null, user.user_id, next_num]
  )
  await logActivity(project_id, user.user_id, 'created interview', 'interview', result.rows[0].id)
  return NextResponse.json(result.rows[0], { status: 201 })
}
