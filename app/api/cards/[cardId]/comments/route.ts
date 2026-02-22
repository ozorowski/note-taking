import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'

async function getAuthedUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  return token ? verifyToken(token) : null
}

// POST /api/cards/[cardId]/comments — add a comment
export async function POST(request: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const payload = await getAuthedUser()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { cardId } = await params
  const { content } = await request.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 })

  const access = await query(
    `SELECT bm.role FROM cards c
     JOIN lists l ON l.id = c.list_id
     JOIN board_memberships bm ON bm.board_id = l.board_id AND bm.user_id = $2
     WHERE c.id = $1`,
    [cardId, payload.user_id]
  )
  if (access.rows.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const result = await query(
    `INSERT INTO comments (card_id, user_id, content) VALUES ($1, $2, $3)
     RETURNING *, (SELECT name FROM users WHERE id = $2) AS author_name`,
    [cardId, payload.user_id, content.trim()]
  )
  return NextResponse.json(result.rows[0], { status: 201 })
}
