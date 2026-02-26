import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, badRequest, getProjectRole, logActivity } from '@/lib/api-helpers'

export async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { project_id, interview_id, content, evidence_type, visibility, source_type, source_url, source_author } = await request.json()
  if (!project_id || !content?.trim()) return badRequest('project_id and content required')

  const role = await getProjectRole(project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()

  const result = await query(
    `INSERT INTO notes (project_id, interview_id, content, created_by, evidence_type, visibility, source_type, source_url, source_author)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [project_id, interview_id || null, content.trim(), user.user_id, evidence_type || null, visibility || 'shared', source_type || 'interview', source_url || null, source_author || null]
  )
  await logActivity(project_id, user.user_id, 'created note', 'note', result.rows[0].id)
  return NextResponse.json(result.rows[0], { status: 201 })
}
