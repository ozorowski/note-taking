import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'

async function getAuthedUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  return token ? verifyToken(token) : null
}

// POST /api/cards/[cardId]/move
// Body: { toListId, toPosition }
// Moves a card to a new list and/or position, updating all affected positions atomically.
export async function POST(request: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const payload = await getAuthedUser()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { cardId } = await params
  const { toListId, toPosition } = await request.json()

  if (!toListId || toPosition === undefined)
    return NextResponse.json({ error: 'toListId and toPosition required' }, { status: 400 })

  const access = await query(
    `SELECT bm.role FROM cards c
     JOIN lists l ON l.id = c.list_id
     JOIN board_memberships bm ON bm.board_id = l.board_id AND bm.user_id = $2
     WHERE c.id = $1`,
    [cardId, payload.user_id]
  )
  if (access.rows.length === 0 || access.rows[0].role === 'viewer')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const client = await getClient()
  try {
    await client.query('BEGIN')

    // Get current card state
    const cardRes = await client.query(`SELECT list_id, position FROM cards WHERE id = $1`, [cardId])
    const card = cardRes.rows[0]
    const fromListId = card.list_id
    const fromPosition = card.position

    if (fromListId === toListId) {
      // Moving within the same list: shift other cards to make room
      if (fromPosition < toPosition) {
        await client.query(
          `UPDATE cards SET position = position - 1
           WHERE list_id = $1 AND position > $2 AND position <= $3 AND id != $4`,
          [fromListId, fromPosition, toPosition, cardId]
        )
      } else {
        await client.query(
          `UPDATE cards SET position = position + 1
           WHERE list_id = $1 AND position >= $2 AND position < $3 AND id != $4`,
          [fromListId, toPosition, fromPosition, cardId]
        )
      }
    } else {
      // Moving to a different list
      // Close the gap in the source list
      await client.query(
        `UPDATE cards SET position = position - 1
         WHERE list_id = $1 AND position > $2`,
        [fromListId, fromPosition]
      )
      // Open a gap in the target list
      await client.query(
        `UPDATE cards SET position = position + 1
         WHERE list_id = $1 AND position >= $2`,
        [toListId, toPosition]
      )
    }

    // Place the card
    const result = await client.query(
      `UPDATE cards SET list_id = $1, position = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [toListId, toPosition, cardId]
    )

    await client.query('COMMIT')
    return NextResponse.json(result.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Move card error:', err)
    return NextResponse.json({ error: 'Failed to move card' }, { status: 500 })
  } finally {
    client.release()
  }
}
