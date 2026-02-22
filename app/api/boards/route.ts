import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'

// GET /api/boards — list boards for current user
export async function GET(_request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await query(
    `SELECT b.*, bm.role
     FROM boards b
     LEFT JOIN board_memberships bm ON b.id = bm.board_id AND bm.user_id = $1
     WHERE b.owner_id = $1 OR bm.user_id = $1
     ORDER BY b.created_at DESC`,
    [payload.user_id]
  )
  return NextResponse.json(result.rows)
}

// POST /api/boards — create a board
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, description } = await request.json()
  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  const result = await query(
    `INSERT INTO boards (title, description, owner_id) VALUES ($1, $2, $3) RETURNING *`,
    [title.trim(), description?.trim() || null, payload.user_id]
  )
  const board = result.rows[0]

  // Owner is also a member with role 'owner'
  await query(
    `INSERT INTO board_memberships (board_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [board.id, payload.user_id]
  )

  return NextResponse.json(board, { status: 201 })
}
