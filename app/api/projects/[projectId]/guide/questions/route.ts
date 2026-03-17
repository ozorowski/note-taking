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

  const { text, stage_label } = await request.json()
  if (!text?.trim()) return NextResponse.json({ error: 'text is required' }, { status: 400 })

  // Insert before catch-all: find max non-catch-all order_index + 1, then bump catch-all up
  const maxRes = await query(
    `SELECT COALESCE(MAX(order_index), -1) AS max_order FROM guide_questions
     WHERE project_id = $1 AND is_catch_all = false`,
    [projectId]
  )
  const newOrder = (maxRes.rows[0]?.max_order ?? -1) + 1

  // Bump catch-all order_index up by 1
  await query(
    `UPDATE guide_questions SET order_index = order_index + 1
     WHERE project_id = $1 AND is_catch_all = true`,
    [projectId]
  )

  const result = await query(
    `INSERT INTO guide_questions (project_id, text, stage_label, order_index, is_catch_all)
     VALUES ($1, $2, $3, $4, false) RETURNING *`,
    [projectId, text.trim(), stage_label?.trim() || null, newOrder]
  )

  return NextResponse.json(result.rows[0], { status: 201 })
}
