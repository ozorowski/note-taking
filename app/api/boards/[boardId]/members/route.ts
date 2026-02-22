import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'

async function getAuthedUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  return token ? verifyToken(token) : null
}

// POST /api/boards/[boardId]/members — invite a user by email
export async function POST(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const payload = await getAuthedUser()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { boardId } = await params

  // Only owners and editors can invite
  const access = await query(
    `SELECT role FROM board_memberships WHERE board_id = $1 AND user_id = $2`,
    [boardId, payload.user_id]
  )
  if (access.rows.length === 0 || access.rows[0].role === 'viewer')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, role = 'editor' } = await request.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })
  if (!['editor', 'viewer'].includes(role))
    return NextResponse.json({ error: 'Role must be editor or viewer' }, { status: 400 })

  const userResult = await query(`SELECT id, name, email FROM users WHERE email = $1`, [email])
  if (userResult.rows.length === 0)
    return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const invitedUser = userResult.rows[0]

  // Upsert membership
  await query(
    `INSERT INTO board_memberships (board_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (board_id, user_id) DO UPDATE SET role = $3`,
    [boardId, invitedUser.id, role]
  )

  return NextResponse.json({ ...invitedUser, role }, { status: 201 })
}

// DELETE /api/boards/[boardId]/members?userId=xxx — remove a member (owner only)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const payload = await getAuthedUser()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { boardId } = await params

  const access = await query(
    `SELECT role FROM board_memberships WHERE board_id = $1 AND user_id = $2`,
    [boardId, payload.user_id]
  )
  if (access.rows.length === 0 || access.rows[0].role !== 'owner')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  await query(
    `DELETE FROM board_memberships WHERE board_id = $1 AND user_id = $2`,
    [boardId, userId]
  )
  return NextResponse.json({ success: true })
}
