import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, getProjectRole } from '@/lib/api-helpers'

type Params = { params: Promise<{ projectId: string }> }

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { projectId } = await params
  const role = await getProjectRole(projectId, user.user_id)
  if (!role || role === 'viewer') return forbidden()

  const { role: inviteRole = 'editor' } = await request.json().catch(() => ({}))

  const result = await query(
    `INSERT INTO project_invites (project_id, role, created_by, expires_at)
     VALUES ($1, $2, $3, NOW() + interval '7 days')
     RETURNING token`,
    [projectId, inviteRole, user.user_id]
  )

  const token = result.rows[0].token
  return NextResponse.json({ url: `${BASE_URL}/invite/${token}`, token })
}
