import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, getProjectRole } from '@/lib/api-helpers'
import { getSetting } from '@/lib/settings'

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const [geminiKey, groqKey, openaiKey] = await Promise.all([getSetting('GEMINI_API_KEY'), getSetting('GROQ_API_KEY'), getSetting('OPENAI_API_KEY')])

  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: { maxOutputTokens: 1500 },
          }),
        }
      )
      const data = await res.json()
      if (res.ok) {
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (text) return text
      }
      console.error('Gemini failed, trying next provider:', data?.error?.message || res.status)
    } catch (e) {
      console.error('Gemini error, trying next provider:', e)
    }
  }

  if (groqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 1500,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        const text = data.choices?.[0]?.message?.content || ''
        if (text) return text
      }
      console.error('Groq failed:', data?.error?.message || res.status)
    } catch (e) {
      console.error('Groq error:', e)
    }
  }

  if (openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 1500,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        const text = data.choices?.[0]?.message?.content || ''
        if (text) return text
      }
      console.error('OpenAI failed:', data?.error?.message || res.status)
    } catch (e) {
      console.error('OpenAI error:', e)
    }
  }

  return ''
}

export async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const { project_id } = await request.json()
  if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  const role = await getProjectRole(project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()

  const [projRes, insightsRes, recsRes] = await Promise.all([
    query('SELECT title, description FROM projects WHERE id = $1', [project_id]),
    query(
      `SELECT ins.content, ins.evidence_summary,
              COALESCE(array_agg(t.title) FILTER (WHERE t.title IS NOT NULL), '{}') AS theme_titles
       FROM insights ins
       LEFT JOIN insight_themes it ON it.insight_id = ins.id
       LEFT JOIN themes t ON t.id = it.theme_id
       WHERE ins.project_id = $1
       GROUP BY ins.id ORDER BY ins.created_at ASC`,
      [project_id]
    ),
    query(
      `SELECT r.content
       FROM recommendations r
       WHERE r.project_id = $1
       ORDER BY r.created_at ASC`,
      [project_id]
    ),
  ])

  if (!projRes.rows[0]) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const proj = projRes.rows[0]
  const insights = insightsRes.rows
  const recs = recsRes.rows

  const systemPrompt = `You are Tracey, a senior UX research AI. Write a concise executive summary (4–6 paragraphs) of the research synthesis below. Do NOT invent new findings. Reference specific numbers and evidence from the insights and recommendations provided. Be factual, synthesis-focused, and professional — write for a stakeholder audience. Output plain paragraphs only, no bullet points, no headings, no markdown formatting.`

  const insightsList = insights
    .map((ins, i) => `${i + 1}. ${ins.content}${ins.evidence_summary ? ` [Evidence: ${ins.evidence_summary}]` : ''}`)
    .join('\n')

  const recsList = recs.map((r, i) => `${i + 1}. ${r.content}`).join('\n')

  const userPrompt = `Project: ${proj.title}
${proj.description ? `Objective: ${proj.description}\n` : ''}Scope: ${insights.length} insight${insights.length !== 1 ? 's' : ''}, ${recs.length} recommendation${recs.length !== 1 ? 's' : ''}

INSIGHTS:
${insightsList || 'None'}

RECOMMENDATIONS:
${recsList || 'None'}`

  const summary = await callAI(systemPrompt, userPrompt)

  if (!summary) {
    return NextResponse.json({ error: 'AI provider unavailable — check your API keys or rate limits' }, { status: 503 })
  }

  return NextResponse.json({ summary })
}
