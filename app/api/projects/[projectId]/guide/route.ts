import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, notFound, getProjectRole } from '@/lib/api-helpers'

type Params = { params: Promise<{ projectId: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { projectId } = await params

  const role = await getProjectRole(projectId, user.user_id)
  if (!role) return notFound()
  if (role === 'viewer') return forbidden()

  // Check guide not already enabled
  const existing = await query(`SELECT has_guide FROM projects WHERE id = $1`, [projectId])
  if (!existing.rows[0]) return notFound()
  if (existing.rows[0].has_guide) {
    return NextResponse.json({ error: 'Guide already enabled for this project' }, { status: 409 })
  }

  const { questions = [] } = await request.json()

  // Enable guide on project
  await query(`UPDATE projects SET has_guide = true, updated_at = NOW() WHERE id = $1`, [projectId])

  // Insert provided questions
  const validQuestions = (questions as Array<{ text: string; stage_label?: string; order_index?: number }>)
    .filter(q => q.text?.trim())

  for (let i = 0; i < validQuestions.length; i++) {
    const q = validQuestions[i]
    await query(
      `INSERT INTO guide_questions (project_id, text, stage_label, order_index, is_catch_all)
       VALUES ($1, $2, $3, $4, false)`,
      [projectId, q.text.trim(), q.stage_label?.trim() || null, q.order_index ?? i]
    )
  }

  // Always append "Other observation" catch-all at the end
  await query(
    `INSERT INTO guide_questions (project_id, text, order_index, is_catch_all)
     VALUES ($1, 'Other observation', $2, true)`,
    [projectId, validQuestions.length]
  )

  const guideQs = await query(
    `SELECT * FROM guide_questions WHERE project_id = $1 ORDER BY order_index ASC`,
    [projectId]
  )

  return NextResponse.json({ guide_questions: guideQs.rows }, { status: 201 })
}
