import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, getProjectRole } from '@/lib/api-helpers'
import { getSetting } from '@/lib/settings'
import type { ArchetypesData, EmergingNeed, UserArchetype } from '@/lib/types'

async function callAI(systemPrompt: string, userPrompt: string, maxTokens = 4000): Promise<string | null> {
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
            generationConfig: { maxOutputTokens: maxTokens },
          }),
        }
      )
      const data = await res.json()
      if (res.ok) {
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (text) return text
      }
      console.error('Gemini failed:', data?.error?.message || res.status)
    } catch (e) {
      console.error('Gemini error:', e)
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
          max_tokens: maxTokens,
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
          max_tokens: maxTokens,
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

function parseArchetypesData(raw: string, validInsightIds: Set<string>): ArchetypesData | null {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    if (!parsed || typeof parsed !== 'object') return null

    const needs: EmergingNeed[] = (Array.isArray(parsed.needs) ? parsed.needs : [])
      .filter((n: unknown) => typeof n === 'object' && n !== null && 'need_statement' in (n as object))
      .map((n: Record<string, unknown>) => ({
        need_statement: String(n.need_statement || ''),
        context: String(n.context || ''),
        linked_insight_ids: (Array.isArray(n.linked_insight_ids) ? n.linked_insight_ids : [])
          .map(String)
          .filter((id: string) => validInsightIds.has(id)),
        evidence_summary: String(n.evidence_summary || ''),
        confidence: (['High', 'Medium', 'Low'].includes(String(n.confidence)) ? n.confidence : 'Medium') as EmergingNeed['confidence'],
        rationale: String(n.rationale || ''),
      }))
      .filter((n: EmergingNeed) => n.need_statement && n.linked_insight_ids.length > 0)

    const archetypes: UserArchetype[] = (Array.isArray(parsed.archetypes) ? parsed.archetypes : [])
      .filter((a: unknown) => typeof a === 'object' && a !== null && 'name' in (a as object))
      .map((a: Record<string, unknown>) => ({
        name: String(a.name || ''),
        core_goal: String(a.core_goal || ''),
        typical_context: String(a.typical_context || ''),
        key_behaviours: Array.isArray(a.key_behaviours) ? a.key_behaviours.map(String) : [],
        attached_need_indices: Array.isArray(a.attached_need_indices)
          ? a.attached_need_indices.map(Number).filter((i: number) => i >= 0 && i < needs.length)
          : [],
        evidence_summary: String(a.evidence_summary || ''),
        confidence: (['High', 'Medium', 'Low'].includes(String(a.confidence)) ? a.confidence : 'Medium') as UserArchetype['confidence'],
        unknowns: String(a.unknowns || ''),
      }))
      .filter((a: UserArchetype) => a.name && a.attached_need_indices.length >= 1)

    if (needs.length === 0) return null
    return { needs, archetypes }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const { project_id } = await request.json()
  if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  const role = await getProjectRole(project_id, user.user_id)
  if (!role || role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [insightsRes, notesRes, projectRes] = await Promise.all([
    query(
      `SELECT i.id, i.content, i.root_cause, i.iqs_score, i.supporting_note_ids,
              COALESCE(array_agg(DISTINCT t.title) FILTER (WHERE t.title IS NOT NULL), '{}') AS theme_titles
       FROM insights i
       LEFT JOIN insight_themes it ON it.insight_id = i.id
       LEFT JOIN themes t ON t.id = it.theme_id
       WHERE i.project_id = $1
       GROUP BY i.id ORDER BY i.created_at`,
      [project_id]
    ),
    query(
      `SELECT n.id, n.content, i.participant_name, i.display_number
       FROM notes n
       LEFT JOIN interviews i ON i.id = n.interview_id
       WHERE n.project_id = $1 AND (n.visibility = 'shared' OR n.visibility IS NULL)`,
      [project_id]
    ),
    query(`SELECT description FROM projects WHERE id = $1`, [project_id]),
  ])

  if (insightsRes.rows.length === 0) {
    return NextResponse.json({ error: 'No insights found — add insights first.' }, { status: 400 })
  }

  const description = projectRes.rows[0]?.description?.trim() || null
  const validInsightIds = new Set(insightsRes.rows.map((i: any) => i.id as string))

  const anonymise = process.env.ENABLE_ANALYSIS_ANONYMISATION === 'true'

  // Build a lookup: noteId → participant label (anonymised or real)
  const noteToParticipant = new Map<string, string>()
  for (const n of notesRes.rows) {
    const label = anonymise
      ? `Participant ${n.display_number ?? 'unknown'}`
      : (n.participant_name || 'Unknown')
    noteToParticipant.set(n.id, label)
  }

  // For each insight, summarise evidence (unique participants, note count)
  const insightList = insightsRes.rows.map((ins: any, idx: number) => {
    const supportingIds: string[] = ins.supporting_note_ids || []
    const participants = supportingIds.length > 0
      ? [...new Set(supportingIds.map(id => noteToParticipant.get(id)).filter(Boolean))]
      : []
    const evidenceLine = supportingIds.length > 0
      ? `${supportingIds.length} note${supportingIds.length !== 1 ? 's' : ''}${participants.length > 0 ? ` from ${participants.length} participant${participants.length !== 1 ? 's' : ''} (${participants.join(', ')})` : ''}`
      : 'evidence count unknown'

    const themes = ins.theme_titles.length > 0 ? ` [themes: ${ins.theme_titles.join(', ')}]` : ''
    const rc = ins.root_cause ? `\n   Root cause: ${ins.root_cause}` : ''
    const qual = ins.iqs_score != null ? ` (strength: ${ins.iqs_score}/100)` : ''
    return `${idx + 1}. [ID: ${ins.id}]${qual}\n   Insight: ${ins.content}${themes}${rc}\n   Evidence: ${evidenceLine}`
  }).join('\n\n')

  const objectiveLine = description
    ? `\nResearch objective: "${description}"\n`
    : ''

  const totalParticipants = new Set(notesRes.rows.map((n: any) =>
    anonymise ? `Participant ${n.display_number}` : n.participant_name
  ).filter(Boolean)).size
  const contextLine = `Total interviews: ${totalParticipants}. Total shared notes: ${notesRes.rows.length}.`

  const systemPrompt = `You are a qualitative research analyst synthesising validated insights into emerging user needs and behavioural archetypes.

STAGE A — EMERGING USER NEEDS
Derive needs from INSIGHTS only (not raw notes).
Rules:
- Each need is phrased exactly: "Users need a way to [verb phrase]…"
- One behavioural constraint or goal per need — no compound needs
- No solution language. No feature suggestions.
- Link each need to 1–3 insights using their exact IDs.
- Generate only as many needs as evidence clearly supports.
  - Prefer 6–10 when signal is strong. Fewer if patterns are thin. Never exceed 12.
  - Merge highly similar needs. Prefer fewer, stronger needs.
- Confidence scoring:
  - High: repeated across multiple participants and contexts
  - Medium: visible but limited spread
  - Low: emerging, thin support

STAGE B — USER ARCHETYPES
Derive archetypes from the needs you generated in Stage A.
Rules:
- Only create an archetype for a DISTINCT behavioural strategy or goal.
- Each archetype must be supported by 2–5 needs (use attached_need_indices: 0-based indices into the needs array).
- Typical: 2–3 archetypes. Maximum: 4. Generate 1 if evidence is thin. Merge if unsure.
- Names: describe behaviour or strategy. Never invent demographics.
  - Good: "Time-pressured repeat user", "Discount-focused planner"
  - Bad: "Busy Brenda", "Urban Millennial"
- Every archetype must include a "What we don't know yet" section.

GUARDRAILS
- Never fabricate evidence or invent users.
- Always surface uncertainty explicitly.
- If evidence is insufficient, reduce counts and mark confidence Low.

Output ONLY valid JSON — no markdown fences, no other text:
{
  "needs": [
    {
      "need_statement": "Users need a way to…",
      "context": "When/where this need surfaces",
      "linked_insight_ids": ["uuid1"],
      "evidence_summary": "Observed across N participants in themes X and Y",
      "confidence": "High|Medium|Low",
      "rationale": "Why this need is supported by the linked insights"
    }
  ],
  "archetypes": [
    {
      "name": "Behavioural archetype name",
      "core_goal": "What this user is trying to achieve",
      "typical_context": "When and where they appear",
      "key_behaviours": ["behaviour 1", "behaviour 2"],
      "attached_need_indices": [0, 2],
      "evidence_summary": "Supported by N insights across M participants",
      "confidence": "High|Medium|Low",
      "unknowns": "What we don't know yet about this group"
    }
  ]
}`

  const userPrompt = `${objectiveLine}${contextLine}\n\nValidated insights:\n\n${insightList}`

  const aiResult = await callAI(systemPrompt, userPrompt, 4000)

  if (!aiResult) {
    return NextResponse.json({ error: 'No AI provider available. Add GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY.' }, { status: 503 })
  }

  const data = parseArchetypesData(aiResult, validInsightIds)
  if (!data) {
    console.error('Failed to parse archetypes AI output:', aiResult.slice(0, 500))
    return NextResponse.json({ error: 'AI returned unparseable output — try regenerating.' }, { status: 500 })
  }

  return NextResponse.json(data)
}
