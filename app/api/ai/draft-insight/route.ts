import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, getProjectRole } from '@/lib/api-helpers'
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
            generationConfig: { maxOutputTokens: 3000 },
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
          max_tokens: 3000,
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
          max_tokens: 3000,
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

interface InsightDraft {
  content: string
  root_cause: string | null
  iqs_score: number | null
  linked_theme_ids: string[]
  link_rationale: Record<string, string>
  supporting_note_ids: string[]
  needs_new_theme: boolean
  suggested_new_theme_name: string | null
}

function emptyDraft(content: string, fallbackThemeIds: string[]): InsightDraft {
  return {
    content,
    root_cause: null,
    iqs_score: null,
    linked_theme_ids: fallbackThemeIds,
    link_rationale: {},
    supporting_note_ids: [],
    needs_new_theme: false,
    suggested_new_theme_name: null,
  }
}

function parseInsightDrafts(raw: string, validThemeIds: string[]): InsightDraft[] {
  const validSet = new Set(validThemeIds)
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed) && parsed.length > 0) {
      const mapped = parsed
        .filter((d: unknown) => {
          if (typeof d !== 'object' || d === null) return false
          const obj = d as Record<string, unknown>
          return 'insight_text' in obj || 'content' in obj
        })
        .map((d: Record<string, unknown>) => {
          const rawText = d.insight_text ?? d.content

          const linkedIds = Array.isArray(d.linked_theme_ids)
            ? (d.linked_theme_ids as string[]).filter(id => validSet.has(id))
            : []

          const rationale: Record<string, string> = {}
          if (typeof d.link_rationale === 'object' && d.link_rationale !== null) {
            for (const [k, v] of Object.entries(d.link_rationale as Record<string, unknown>)) {
              if (typeof v === 'string' && validSet.has(k)) rationale[k] = v
            }
          }

          return {
            content: String(rawText),
            root_cause: d.root_cause ? String(d.root_cause) : null,
            iqs_score: typeof d.iqs_score === 'number'
              ? Math.min(100, Math.max(0, Math.round(d.iqs_score as number)))
              : null,
            linked_theme_ids: linkedIds,
            link_rationale: rationale,
            supporting_note_ids: Array.isArray(d.supporting_note_ids)
              ? (d.supporting_note_ids as string[]).filter((id): id is string => typeof id === 'string')
              : [],
            needs_new_theme: Boolean(d.needs_new_theme),
            suggested_new_theme_name: d.suggested_new_theme_name
              ? String(d.suggested_new_theme_name)
              : null,
          } satisfies InsightDraft
        })
      if (mapped.length > 0) return mapped
    }
  } catch {
    // fall through to text-based parsing
  }

  // Fallback: numbered list → link to all selected themes
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  const drafts: InsightDraft[] = []
  let current = ''
  for (const line of lines) {
    if (/^\d+[.)]\s/.test(line)) {
      if (current.trim()) drafts.push(emptyDraft(current.trim(), validThemeIds))
      current = line.replace(/^\d+[.)]\s+/, '')
    } else if (current) {
      current += ' ' + line
    }
  }
  if (current.trim()) drafts.push(emptyDraft(current.trim(), validThemeIds))

  if (drafts.length >= 1) return drafts
  if (raw.trim()) return [emptyDraft(raw.trim(), validThemeIds)]
  return []
}

export async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const { project_id, theme_ids } = await request.json()
  if (!project_id || !Array.isArray(theme_ids) || theme_ids.length === 0)
    return NextResponse.json({ error: 'project_id and theme_ids required' }, { status: 400 })

  const role = await getProjectRole(project_id, user.user_id)
  if (!role || role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [themesRes, notesRes, projectRes] = await Promise.all([
    query(
      `SELECT t.id, t.title, t.description FROM themes t WHERE t.id = ANY($1::uuid[]) AND t.project_id = $2`,
      [theme_ids, project_id]
    ),
    query(
      `SELECT DISTINCT ON (n.id) n.id, n.content, nt.theme_id
       FROM notes n JOIN note_themes nt ON nt.note_id = n.id
       WHERE nt.theme_id = ANY($1::uuid[]) AND n.project_id = $2
       ORDER BY n.id LIMIT 60`,
      [theme_ids, project_id]
    ),
    query(`SELECT description FROM projects WHERE id = $1`, [project_id]),
  ])

  const themesList = themesRes.rows
    .map(t => `[${t.id}]: ${t.title}${t.description ? ' — ' + t.description : ''}`)
    .join('\n')
  const notesList = notesRes.rows
    .map(n => `[${n.id}] (theme: [${n.theme_id}]): ${n.content}`)
    .join('\n')
  const noteCount = notesRes.rows.length
  const projectDescription = projectRes.rows[0]?.description?.trim() || null

  const objectiveLine = projectDescription
    ? `\n\nResearch objective: "${projectDescription}"\nWhere the data supports it, frame insights so they speak directly to this objective — prioritise mechanisms that are most relevant to it.`
    : ''

  const systemPrompt = `You are generating draft insights from a set of selected themes and their underlying notes.

Important: Theme selection defines the evidence scope, not the tags. You must decide which theme(s) each insight should be linked to based on best fit.

Rules:
1. Atomic insights only — one insight per causal mechanism:
   When [context], [participants] [behaviour], because [single root cause], which leads to [impact].

2. Theme linking must be selective:
   - Default: 1 theme per insight
   - Allow 2 themes if the insight genuinely spans both
   - Allow 3 themes max only in rare cases — you must be able to justify it
   - Never link an insight to all themes

3. Use evidence to classify — choose themes based on the majority of supporting notes and the content focus of the insight (not vague relevance).

4. If an insight doesn't fit any selected theme well: either don't generate it, or set needs_new_theme: true and propose a theme name in suggested_new_theme_name.

5. IQS score (integer 0–100):
   Atomicity (0–25): 25=single clear root cause, 0=multiple mechanisms
   Behaviour specificity (0–20): 20=clear observable behaviour, 0=purely thematic
   Causal clarity (0–20): 20=clear cause→effect chain, 0=no mechanism
   Impact specificity (0–15): 15=concrete consequence, 0=vague
   Non-solution bias (0–10): 10=no implied solution, 0=contains solution
   Evidence strength (0–10): ${noteCount} notes in input — 10=10+, 7=5–9, 5=3–4, 2=1–2${objectiveLine}

Output as a JSON array only — no other text:
[{
  "insight_text": "When ..., [who] ..., because [single root cause], which leads to ...",
  "root_cause": "the single causal mechanism in 5–15 words",
  "iqs_score": 82,
  "linked_theme_ids": ["exact-uuid-from-input"],
  "link_rationale": {"exact-uuid": "This insight belongs here because…"},
  "supporting_note_ids": ["note-uuid-1", "note-uuid-2"],
  "needs_new_theme": false,
  "suggested_new_theme_name": null
}]`

  const userPrompt = `THEMES (use these exact IDs in your response):\n${themesList}\n\nNOTES (use these exact IDs in supporting_note_ids):\n${notesList}`

  const aiRaw = await callAI(systemPrompt, userPrompt)

  if (!aiRaw) {
    return NextResponse.json({ error: 'AI provider unavailable — check your API keys or rate limits' }, { status: 503 })
  }

  const drafts = parseInsightDrafts(aiRaw, theme_ids)
  return NextResponse.json({ drafts })
}
