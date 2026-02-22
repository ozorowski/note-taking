import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'

async function getAuthedUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  return token ? verifyToken(token) : null
}

// POST /api/cards — create a card in a list
export async function POST(request: NextRequest) {
  const payload = await getAuthedUser()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { list_id, title, description } = await request.json()
  if (!list_id || !title?.trim())
    return NextResponse.json({ error: 'list_id and title required' }, { status: 400 })

  // Check access via the list's board
  const access = await query(
    `SELECT bm.role FROM lists l
     JOIN board_memberships bm ON bm.board_id = l.board_id AND bm.user_id = $2
     WHERE l.id = $1`,
    [list_id, payload.user_id]
  )
  if (access.rows.length === 0 || access.rows[0].role === 'viewer')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const posResult = await query(
    `SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM cards WHERE list_id = $1`,
    [list_id]
  )
  const position = posResult.rows[0].pos

  const result = await query(
    `INSERT INTO cards (list_id, title, description, position) VALUES ($1, $2, $3, $4) RETURNING *`,
    [list_id, title.trim(), description?.trim() || null, position]
  )
  return NextResponse.json(result.rows[0], { status: 201 })
}
