import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'

async function getAuthedUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  return token ? verifyToken(token) : null
}

// POST /api/lists — create a list on a board
export async function POST(request: NextRequest) {
  const payload = await getAuthedUser()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { board_id, title } = await request.json()
  if (!board_id || !title?.trim())
    return NextResponse.json({ error: 'board_id and title required' }, { status: 400 })

  const access = await query(
    `SELECT role FROM board_memberships WHERE board_id = $1 AND user_id = $2`,
    [board_id, payload.user_id]
  )
  if (access.rows.length === 0 || access.rows[0].role === 'viewer')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Put new list at the end
  const posResult = await query(
    `SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM lists WHERE board_id = $1`,
    [board_id]
  )
  const position = posResult.rows[0].pos

  const result = await query(
    `INSERT INTO lists (board_id, title, position) VALUES ($1, $2, $3) RETURNING *`,
    [board_id, title.trim(), position]
  )
  return NextResponse.json(result.rows[0], { status: 201 })
}
