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

  const result = await query(
    `INSERT INTO themes (project_id, title, description, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
    [project_id, title.trim(), description?.trim() || null, user.user_id]
  )
  await logActivity(project_id, user.user_id, 'created theme', 'theme', result.rows[0].id)
  return NextResponse.json(result.rows[0], { status: 201 })
}
