import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'

async function getAuthedUser(_request?: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  return token ? verifyToken(token) : null
}

// GET /api/boards/[boardId] — full board with lists and cards
export async function GET(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const payload = await getAuthedUser(request)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { boardId } = await params

  // Check membership
  const access = await query(
    `SELECT role FROM board_memberships WHERE board_id = $1 AND user_id = $2`,
    [boardId, payload.user_id]
  )
  if (access.rows.length === 0)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const boardResult = await query(`SELECT * FROM boards WHERE id = $1`, [boardId])
  const board = boardResult.rows[0]
  if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const listsResult = await query(
    `SELECT * FROM lists WHERE board_id = $1 ORDER BY position ASC`,
    [boardId]
  )

  const cardsResult = await query(
    `SELECT c.*, COALESCE(
       json_agg(ct.tag ORDER BY ct.tag) FILTER (WHERE ct.tag IS NOT NULL), '[]'
     ) AS tags
     FROM cards c
     LEFT JOIN card_tags ct ON ct.card_id = c.id
     WHERE c.list_id = ANY(
       SELECT id FROM lists WHERE board_id = $1
     )
     GROUP BY c.id
     ORDER BY c.position ASC`,
    [boardId]
  )

  const membersResult = await query(
    `SELECT u.id, u.name, u.email, bm.role
     FROM board_memberships bm
     JOIN users u ON u.id = bm.user_id
     WHERE bm.board_id = $1`,
    [boardId]
  )

  return NextResponse.json({
    ...board,
    role: access.rows[0].role,
    lists: listsResult.rows,
    cards: cardsResult.rows,
    members: membersResult.rows,
  })
}

// PATCH /api/boards/[boardId] — update title/description
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const payload = await getAuthedUser(request)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { boardId } = await params
  const access = await query(
    `SELECT role FROM board_memberships WHERE board_id = $1 AND user_id = $2`,
    [boardId, payload.user_id]
  )
  if (access.rows.length === 0 || access.rows[0].role === 'viewer')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { title, description } = await request.json()
  const result = await query(
    `UPDATE boards SET title = COALESCE($1, title), description = COALESCE($2, description),
     updated_at = NOW() WHERE id = $3 RETURNING *`,
    [title?.trim() || null, description?.trim() ?? null, boardId]
  )
  return NextResponse.json(result.rows[0])
}

// DELETE /api/boards/[boardId] — delete board (owner only)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const payload = await getAuthedUser(request)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { boardId } = await params
  const access = await query(
    `SELECT role FROM board_memberships WHERE board_id = $1 AND user_id = $2`,
    [boardId, payload.user_id]
  )
  if (access.rows.length === 0 || access.rows[0].role !== 'owner')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await query(`DELETE FROM boards WHERE id = $1`, [boardId])
  return NextResponse.json({ success: true })
}
