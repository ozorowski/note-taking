import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, notFound, getProjectRole } from '@/lib/api-helpers'

type Params = { params: Promise<{ projectId: string; questionId: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { projectId, questionId } = await params

  const role = await getProjectRole(projectId, user.user_id)
  if (!role) return notFound()
  if (role === 'viewer') return forbidden()

  const { text, stage_label, order_index } = await request.json()

  const result = await query(
    `UPDATE guide_questions
     SET text = COALESCE($1, text),
         stage_label = CASE WHEN $2::text IS NOT NULL THEN $2::text ELSE stage_label END,
         order_index = COALESCE($3::smallint, order_index)
     WHERE id = $4 AND project_id = $5
     RETURNING *`,
    [text?.trim() || null, stage_label !== undefined ? (stage_label?.trim() || null) : undefined, order_index !== undefined ? order_index : null, questionId, projectId]
  )

  if (!result.rows[0]) return notFound()
  return NextResponse.json(result.rows[0])
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { projectId, questionId } = await params

  const role = await getProjectRole(projectId, user.user_id)
  if (!role) return notFound()
  if (role === 'viewer') return forbidden()

  // Block deletion of catch-all question
  const questionRes = await query(
    `SELECT is_catch_all FROM guide_questions WHERE id = $1 AND project_id = $2`,
    [questionId, projectId]
  )
  if (!questionRes.rows[0]) return notFound()
  if (questionRes.rows[0].is_catch_all) {
    return NextResponse.json({ error: 'Cannot delete the Other observation question' }, { status: 400 })
  }

  // ON DELETE SET NULL handles notes automatically
  await query(`DELETE FROM guide_questions WHERE id = $1`, [questionId])
  return NextResponse.json({ success: true })
}
