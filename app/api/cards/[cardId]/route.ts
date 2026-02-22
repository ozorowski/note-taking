import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'

async function getAuthedUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  return token ? verifyToken(token) : null
}

async function checkCardAccess(cardId: string, userId: string) {
  const result = await query(
    `SELECT bm.role FROM cards c
     JOIN lists l ON l.id = c.list_id
     JOIN board_memberships bm ON bm.board_id = l.board_id AND bm.user_id = $2
     WHERE c.id = $1`,
    [cardId, userId]
  )
  return result.rows[0] || null
}

// GET /api/cards/[cardId] — get card with tags and comments
export async function GET(_request: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const payload = await getAuthedUser()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { cardId } = await params
  const access = await checkCardAccess(cardId, payload.user_id)
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const cardResult = await query(`SELECT * FROM cards WHERE id = $1`, [cardId])
  const card = cardResult.rows[0]

  const tagsResult = await query(`SELECT tag FROM card_tags WHERE card_id = $1 ORDER BY tag`, [cardId])
  const commentsResult = await query(
    `SELECT c.*, u.name as author_name FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.card_id = $1 ORDER BY c.created_at ASC`,
    [cardId]
  )

  return NextResponse.json({
    ...card,
    tags: tagsResult.rows.map(r => r.tag),
    comments: commentsResult.rows,
  })
}

// PATCH /api/cards/[cardId] — update title, description, list_id (move), position
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const payload = await getAuthedUser()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { cardId } = await params
  const access = await checkCardAccess(cardId, payload.user_id)
  if (!access || access.role === 'viewer')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { title, description, list_id, position } = await request.json()

  const result = await query(
    `UPDATE cards
     SET title = COALESCE($1, title),
         description = COALESCE($2, description),
         list_id = COALESCE($3, list_id),
         position = COALESCE($4, position),
         updated_at = NOW()
     WHERE id = $5 RETURNING *`,
    [title?.trim() || null, description !== undefined ? description?.trim() || null : null, list_id || null, position ?? null, cardId]
  )
  return NextResponse.json(result.rows[0])
}

// DELETE /api/cards/[cardId]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const payload = await getAuthedUser()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { cardId } = await params
  const access = await checkCardAccess(cardId, payload.user_id)
  if (!access || access.role === 'viewer')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await query(`DELETE FROM cards WHERE id = $1`, [cardId])
  return NextResponse.json({ success: true })
}
