import { NextRequest, NextResponse } from 'next/server'
import { getSetting } from '@/lib/settings'
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

  // Fetch the card
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

  const openaiKey = await getSetting('OPENAI_API_KEY')
  let summary: string

  if (!openaiKey) {
    // Stub: no API key set
    summary = `[AI stub] Summary of "${card.title}": This card discusses ${card.title.toLowerCase()}. Add your OPENAI_API_KEY to .env.local to get real AI summaries.`
  } else {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a research analyst. Summarise the following research note in 2-3 concise sentences.' },
          { role: 'user', content: text },
        ],
        max_tokens: 200,
      }),
    })
    const data = await res.json()
    summary = data.choices?.[0]?.message?.content || 'Could not generate summary.'
  }

  // Save summary to the card
  await query(`UPDATE cards SET ai_summary = $1, updated_at = NOW() WHERE id = $2`, [summary, cardId])
  // Also store in ai_outputs
  await query(
    `INSERT INTO ai_outputs (entity_type, entity_id, output_type, content) VALUES ('card', $1, 'summary', $2)`,
    [cardId, summary]
  )

  return NextResponse.json({ summary })
}
