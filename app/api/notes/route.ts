import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, badRequest, getProjectRole, logActivity } from '@/lib/api-helpers'

export async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { project_id, interview_id, content, evidence_type, visibility, source_type, source_url, source_author, guide_question_id } = await request.json()
  if (!project_id || !content?.trim()) return badRequest('project_id and content required')

  const role = await getProjectRole(project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()

  const { rows: [{ next_num }] } = await query(
    `SELECT COALESCE(MAX(display_number), 0) + 1 AS next_num FROM notes WHERE project_id = $1`,
    [project_id]
  )
  const result = await query(
    `INSERT INTO notes (project_id, interview_id, content, created_by, evidence_type, visibility, source_type, source_url, source_author, guide_question_id, display_number)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [project_id, interview_id || null, content.trim(), user.user_id, evidence_type || null, visibility || 'shared', source_type || 'interview', source_url || null, source_author || null, guide_question_id || null, next_num]
  )
  await logActivity(project_id, user.user_id, 'created note', 'note', result.rows[0].id)
  return NextResponse.json(result.rows[0], { status: 201 })
}
