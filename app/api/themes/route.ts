import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, badRequest, getProjectRole, logActivity } from '@/lib/api-helpers'

export async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { project_id, title, description } = await request.json()
  if (!project_id || !title?.trim()) return badRequest('project_id and title required')

  const role = await getProjectRole(project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()

  const { rows: [{ exists }] } = await query(
    `SELECT EXISTS(SELECT 1 FROM themes WHERE project_id = $1 AND LOWER(title) = LOWER($2)) AS exists`,
    [project_id, title.trim()]
  )
  if (exists) return badRequest('A theme with this name already exists.')

  const { rows: [{ next_num }] } = await query(
    `SELECT COALESCE(MAX(display_number), 0) + 1 AS next_num FROM themes WHERE project_id = $1`,
    [project_id]
  )
  const { rows: [{ next_sort }] } = await query(
    `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort FROM themes WHERE project_id = $1`,
    [project_id]
  )
  const result = await query(
    `INSERT INTO themes (project_id, title, description, created_by, display_number, sort_order) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [project_id, title.trim(), description?.trim() || null, user.user_id, next_num, next_sort]
  )
  await logActivity(project_id, user.user_id, 'created theme', 'theme', result.rows[0].id)
  return NextResponse.json(result.rows[0], { status: 201 })
}
