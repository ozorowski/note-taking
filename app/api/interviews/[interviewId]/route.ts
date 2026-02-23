import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, notFound, getProjectRole } from '@/lib/api-helpers'

type Params = { params: Promise<{ interviewId: string }> }

async function getInterview(id: string) {
  const r = await query('SELECT * FROM interviews WHERE id = $1', [id])
  return r.rows[0] || null
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { interviewId } = await params
  const iv = await getInterview(interviewId)
  if (!iv) return notFound()
  const role = await getProjectRole(iv.project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()

  const { participant_name, raw_notes } = await request.json()
  const result = await query(
    `UPDATE interviews SET participant_name = COALESCE($1, participant_name), raw_notes = COALESCE($2, raw_notes), updated_at = NOW() WHERE id = $3 RETURNING *`,
    [participant_name?.trim() || null, raw_notes !== undefined ? raw_notes?.trim() ?? null : null, interviewId]
  )
  return NextResponse.json(result.rows[0])
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { interviewId } = await params
  const iv = await getInterview(interviewId)
  if (!iv) return notFound()
  const role = await getProjectRole(iv.project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()
  await query('DELETE FROM interviews WHERE id = $1', [interviewId])
  return NextResponse.json({ success: true })
}
