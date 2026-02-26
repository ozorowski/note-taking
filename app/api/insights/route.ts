import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, badRequest, getProjectRole, logActivity } from '@/lib/api-helpers'

export async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { project_id, content, evidence_summary, root_cause, iqs_score, supporting_note_ids } = await request.json()
  if (!project_id || !content?.trim()) return badRequest('project_id and content required')

  const role = await getProjectRole(project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()

  const noteIds = Array.isArray(supporting_note_ids) && supporting_note_ids.length > 0
    ? supporting_note_ids.filter((id): id is string => typeof id === 'string')
    : null

  const result = await query(
    `INSERT INTO insights (project_id, content, evidence_summary, root_cause, iqs_score, supporting_note_ids, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [project_id, content.trim(), evidence_summary?.trim() || null, root_cause?.trim() || null, iqs_score ?? null, noteIds, user.user_id]
  )
  await logActivity(project_id, user.user_id, 'created insight', 'insight', result.rows[0].id)
  return NextResponse.json(result.rows[0], { status: 201 })
}
