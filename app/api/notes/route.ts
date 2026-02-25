import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, badRequest, getProjectRole, logActivity } from '@/lib/api-helpers'

export async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { project_id, interview_id, content, evidence_type, visibility } = await request.json()
  if (!project_id || !content?.trim()) return badRequest('project_id and content required')

  const role = await getProjectRole(project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()

  const result = await query(
    `INSERT INTO notes (project_id, interview_id, content, created_by, evidence_type, visibility)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [project_id, interview_id || null, content.trim(), user.user_id, evidence_type || null, visibility || 'shared']
  )
  await logActivity(project_id, user.user_id, 'created note', 'note', result.rows[0].id)
  return NextResponse.json(result.rows[0], { status: 201 })
}
