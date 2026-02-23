import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, getProjectRole } from '@/lib/api-helpers'

export async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const { project_id, insight_ids } = await request.json()
  if (!project_id || !Array.isArray(insight_ids) || insight_ids.length === 0)
    return NextResponse.json({ error: 'project_id and insight_ids required' }, { status: 400 })

  const role = await getProjectRole(project_id, user.user_id)
  if (!role || role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const insightsRes = await query(
    `SELECT content FROM insights WHERE id = ANY($1::uuid[]) AND project_id = $2`,
    [insight_ids, project_id]
  )

  const insightsList = insightsRes.rows.map(i => `- ${i.content}`).join('\n')

  let draft: string

  if (!process.env.OPENAI_API_KEY) {
    draft = `[AI stub] Based on ${insightsRes.rows.length} insight(s) — we recommend redesigning the synthesis workflow to be structured and tool-agnostic. Add OPENAI_API_KEY for real drafts.`
  } else {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a senior UX researcher. Draft a concise, actionable recommendation (2-3 sentences) based on the insights provided. Be specific about what should be done and why.' },
          { role: 'user', content: `Insights:\n${insightsList}` },
        ],
        max_tokens: 200,
      }),
    })
    const data = await res.json()
    draft = data.choices?.[0]?.message?.content || 'Could not generate draft.'
  }

  return NextResponse.json({ draft })
}
