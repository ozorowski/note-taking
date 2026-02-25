import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, badRequest } from '@/lib/api-helpers'
import { createDemoProject } from '@/lib/demo-seed'

export async function GET(_req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const result = await query(
    `SELECT p.*, pm.role
     FROM projects p
     JOIN project_memberships pm ON pm.project_id = p.id AND pm.user_id = $1
     ORDER BY p.updated_at DESC`,
    [user.user_id]
  )
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const { title, description, demo } = await request.json()
  if (!title?.trim()) return badRequest('Title is required')

  if (demo) {
    try {
      const project = await createDemoProject(user.user_id)
      return NextResponse.json(project, { status: 201 })
    } catch (e) {
      console.error('Create demo project error:', e)
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
    }
  }

  // Check for duplicate title (case-insensitive) among this user's projects
  const existing = await query(
    `SELECT 1 FROM projects p
     JOIN project_memberships pm ON pm.project_id = p.id AND pm.user_id = $1
     WHERE LOWER(p.title) = LOWER($2) LIMIT 1`,
    [user.user_id, title.trim()]
  )
  if (existing.rows.length > 0) {
    return badRequest('You already have a project with this name')
  }

  const result = await query(
    `INSERT INTO projects (title, description, owner_id, demo, current_phase)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [title.trim(), description?.trim() || null, user.user_id, false, 'interviews']
  )
  const project = result.rows[0]
  await query(
    `INSERT INTO project_memberships (project_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [project.id, user.user_id]
  )
  return NextResponse.json(project, { status: 201 })
}
