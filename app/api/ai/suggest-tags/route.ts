import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { cardId } = await request.json()
  if (!cardId) return NextResponse.json({ error: 'cardId required' }, { status: 400 })

  const cardResult = await query(
    `SELECT c.title, c.description FROM cards c
     JOIN lists l ON l.id = c.list_id
     JOIN board_memberships bm ON bm.board_id = l.board_id AND bm.user_id = $2
     WHERE c.id = $1`,
    [cardId, payload.user_id]
  )
  if (cardResult.rows.length === 0)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const card = cardResult.rows[0]
  const text = `Title: ${card.title}\n\nDescription: ${card.description || 'No description'}`

  let tags: string[]

  if (!process.env.OPENAI_API_KEY) {
    // Stub
    tags = ['stub-tag-1', 'stub-tag-2', 'add-openai-key']
  } else {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a research analyst. Suggest 3-5 short, relevant tags for the following research note. Return ONLY a JSON array of lowercase strings, e.g. ["usability","mobile","pain-point"].',
          },
          { role: 'user', content: text },
        ],
        max_tokens: 100,
      }),
    })
    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content || '[]'
    try {
      tags = JSON.parse(raw)
    } catch {
      tags = ['parse-error']
    }
  }

  await query(
    `INSERT INTO ai_outputs (entity_type, entity_id, output_type, content) VALUES ('card', $1, 'suggested_tags', $2)`,
    [cardId, JSON.stringify(tags)]
  )

  return NextResponse.json({ tags })
}
