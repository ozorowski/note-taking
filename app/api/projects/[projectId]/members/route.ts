import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, badRequest, getProjectRole } from '@/lib/api-helpers'

type Params = { params: Promise<{ projectId: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { projectId } = await params
  const role = await getProjectRole(projectId, user.user_id)
  if (!role || role === 'viewer') return forbidden()

  const { name, roleToAssign = 'editor' } = await request.json()
  if (!name?.trim()) return badRequest('Name is required')
  if (!['editor','viewer'].includes(roleToAssign)) return badRequest('Role must be editor or viewer')

  const userResult = await query('SELECT id, name FROM users WHERE name ILIKE $1 LIMIT 1', [name.trim()])
  if (userResult.rows.length === 0) return NextResponse.json({ error: 'No user found with that name' }, { status: 404 })

  const invited = userResult.rows[0]
  await query(
    `INSERT INTO project_memberships (project_id, user_id, role)
     VALUES ($1, $2, $3) ON CONFLICT (project_id, user_id) DO UPDATE SET role = $3`,
    [projectId, invited.id, roleToAssign]
  )
  return NextResponse.json({ ...invited, role: roleToAssign }, { status: 201 })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { projectId } = await params
  const role = await getProjectRole(projectId, user.user_id)
  if (role !== 'owner') return forbidden()

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) return badRequest('userId required')

  await query('DELETE FROM project_memberships WHERE project_id = $1 AND user_id = $2', [projectId, userId])
  return NextResponse.json({ success: true })
}
