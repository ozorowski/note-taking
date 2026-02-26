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
            generationConfig: { maxOutputTokens: 2000 },
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
          max_tokens: 2000,
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
          max_tokens: 2000,
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

interface RecDraft {
  recommendation: string
  primary_insight_id: string
  link_justification: string
}

function parseRecDrafts(raw: string, fallbackInsightId: string): RecDraft[] {
  // Strip markdown code fences then try JSON
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
        .filter((d: unknown) => typeof d === 'object' && d !== null && 'recommendation' in (d as object))
        .map((d: Record<string, unknown>) => ({
          recommendation: String(d.recommendation),
          primary_insight_id: d.primary_insight_id ? String(d.primary_insight_id) : fallbackInsightId,
          link_justification: d.link_justification ? String(d.link_justification) : '',
        }))
    }
  } catch {
    // fall through to text-based parsing
  }

  // Fallback: numbered list → link all to first insight
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  const drafts: RecDraft[] = []
  let current = ''
  for (const line of lines) {
    if (/^\d+[.)]\s/.test(line)) {
      if (current.trim()) drafts.push({ recommendation: current.trim(), primary_insight_id: fallbackInsightId, link_justification: '' })
      current = line.replace(/^\d+[.)]\s+/, '')
    } else if (current) {
      current += ' ' + line
    }
  }
  if (current.trim()) drafts.push({ recommendation: current.trim(), primary_insight_id: fallbackInsightId, link_justification: '' })

  if (drafts.length >= 1) return drafts
  if (raw.trim()) return [{ recommendation: raw.trim(), primary_insight_id: fallbackInsightId, link_justification: '' }]
  return []
}

export async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const { project_id } = await request.json()
  if (!project_id)
    return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  const role = await getProjectRole(project_id, user.user_id)
  if (!role || role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [insightsRes, projectRes] = await Promise.all([
    query(
      `SELECT i.id, i.content, i.root_cause, i.iqs_score,
              array_agg(t.title) FILTER (WHERE t.title IS NOT NULL) AS theme_titles
       FROM insights i
       LEFT JOIN insight_themes it ON it.insight_id = i.id
       LEFT JOIN themes t ON t.id = it.theme_id
       WHERE i.project_id = $1
       GROUP BY i.id ORDER BY i.created_at`,
      [project_id]
    ),
    query(`SELECT description FROM projects WHERE id = $1`, [project_id]),
  ])

  if (insightsRes.rows.length === 0) {
    return NextResponse.json({ error: 'No insights found — add insights first.' }, { status: 400 })
  }

  const description = projectRes.rows[0]?.description?.trim() || null
  const firstInsightId = insightsRes.rows[0].id
  const lowQualityCount = insightsRes.rows.filter(i => i.iqs_score == null || i.iqs_score < 50).length

  const insightsList = insightsRes.rows.map((i, idx) => {
    const themes = i.theme_titles?.length ? ` [${i.theme_titles.join(', ')}]` : ''
    const rc = i.root_cause ? `\n   Root cause: ${i.root_cause}` : ''
    return `${idx + 1}. ID: ${i.id}\n   Insight: ${i.content}${themes}${rc}`
  }).join('\n\n')

  const objectiveLine = description
    ? `\n\nWhere possible, frame recommendations to also address the stated research objective: "${description}"`
    : ''

  const systemPrompt = `You are generating targeted interventions from qualitative research insights.

For each insight:
1. Extract the root_cause (provided alongside the insight content).
2. Generate 1–2 concrete, implementable recommendations that directly reduce or eliminate that root cause.
3. Each recommendation: 2–3 sentences — what to do, and why it matters based on the insight.
4. Avoid strategic umbrella language.
5. Default: link each recommendation to ONE primary insight (the one whose root cause it addresses). Use its exact ID.
6. Only link to a secondary insight if root causes are materially identical.
7. Include one-sentence justification per recommendation.${objectiveLine}

Output as a JSON array only — no other text:
[{
  "recommendation": "...",
  "primary_insight_id": "the-uuid-here",
  "link_justification": "This addresses [brief insight description] because it reduces [root_cause]."
}]`

  const userPrompt = `Insights:\n\n${insightsList}`

  const aiResult = await callAI(systemPrompt, userPrompt)

  if (!aiResult) {
    return NextResponse.json({
      drafts: [{
        recommendation: `Add a GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY environment variable to get AI-generated recommendations.`,
        primary_insight_id: firstInsightId,
        link_justification: '',
      }],
      low_quality_count: lowQualityCount,
    })
  }

  const drafts = parseRecDrafts(aiResult, firstInsightId)
  return NextResponse.json({ drafts, low_quality_count: lowQualityCount })
}
