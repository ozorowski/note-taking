import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'

async function getAuthedUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  return token ? verifyToken(token) : null
}

// PUT /api/cards/[cardId]/tags — replace all tags on a card
export async function PUT(request: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const payload = await getAuthedUser()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { cardId } = await params

  const access = await query(
    `SELECT bm.role FROM cards c
     JOIN lists l ON l.id = c.list_id
     JOIN board_memberships bm ON bm.board_id = l.board_id AND bm.user_id = $2
     WHERE c.id = $1`,
    [cardId, payload.user_id]
  )
  if (access.rows.length === 0 || access.rows[0].role === 'viewer')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { tags } = await request.json()
  if (!Array.isArray(tags)) return NextResponse.json({ error: 'tags must be an array' }, { status: 400 })

  const cleanTags = [...new Set(tags.map((t: string) => t.trim().toLowerCase()).filter(Boolean))]

  await query(`DELETE FROM card_tags WHERE card_id = $1`, [cardId])

  for (const tag of cleanTags) {
    await query(`INSERT INTO card_tags (card_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [cardId, tag])
  }

  return NextResponse.json({ tags: cleanTags })
}
