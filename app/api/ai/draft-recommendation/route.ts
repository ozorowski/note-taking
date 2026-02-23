import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, getProjectRole } from '@/lib/api-helpers'

async function callAI(systemPrompt: string, userPrompt: string): Promise<string | null> {
  if (process.env.GEMINI_API_KEY) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: { maxOutputTokens: 200 },
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

  if (process.env.GROQ_API_KEY) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 200,
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

  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 200,
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

  return null
}

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

  const systemPrompt = 'You are a senior UX researcher. Draft a concise, actionable recommendation (2-3 sentences) based on the insights provided. Be specific about what should be done and why.'
  const userPrompt = `Insights:\n${insightsList}`

  const aiResult = await callAI(systemPrompt, userPrompt)
  const draft = aiResult ?? `[No AI key set] Based on ${insightsRes.rows.length} insight(s) — add a GEMINI_API_KEY environment variable to get real AI drafts.`

  return NextResponse.json({ draft })
}
