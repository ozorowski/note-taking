import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getAuthedUser, unauthorized, getProjectRole } from '@/lib/api-helpers'
import { getSetting } from '@/lib/settings'

async function callAI(prompt: string): Promise<{ text: string; error?: string }> {
  const [geminiKey, groqKey, openaiKey] = await Promise.all([getSetting('GEMINI_API_KEY'), getSetting('GROQ_API_KEY'), getSetting('OPENAI_API_KEY')])

  let lastError = 'No AI key configured — add GROQ_API_KEY to your environment'

  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 4000 },
          }),
        }
      )
      const data = await res.json()
      if (res.ok) {
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (text) return { text }
        lastError = `Gemini returned empty response (finish reason: ${data.candidates?.[0]?.finishReason})`
      } else {
        lastError = `Gemini error: ${data?.error?.message || res.status}`
      }
      console.error('Gemini failed, trying next provider:', lastError)
    } catch (e) {
      lastError = `Gemini exception: ${e}`
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
            { role: 'system', content: 'You are a senior UX researcher. You must respond with valid JSON only — no markdown, no explanation.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 4000,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        const text = data.choices?.[0]?.message?.content || ''
        if (text) return { text }
        lastError = 'Groq returned empty response'
      } else {
        lastError = `Groq error: ${data?.error?.message || res.status}`
      }
      console.error('Groq failed:', lastError)
    } catch (e) {
      lastError = `Groq exception: ${e}`
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
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4000,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        const text = data.choices?.[0]?.message?.content || ''
        if (text) return { text }
        lastError = 'OpenAI returned empty response'
      } else {
        lastError = `OpenAI error: ${data?.error?.message || res.status}`
      }
      console.error('OpenAI failed:', lastError)
    } catch (e) {
      lastError = `OpenAI exception: ${e}`
      console.error('OpenAI error:', e)
    }
  }

  return { text: '', error: lastError }
}

function extractJSON(raw: string) {
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  return JSON.parse((match ? match[1] : raw).trim())
}

export async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const { project_id } = await request.json()
  if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  const role = await getProjectRole(project_id, user.user_id)
  if (!role || role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch ungrouped notes and existing themes in parallel
  const [notesRes, existingThemesRes] = await Promise.all([
    query(
      `SELECT n.id, n.content, n.capture_group_id
       FROM notes n
       LEFT JOIN note_themes nt ON nt.note_id = n.id
       WHERE n.project_id = $1 AND nt.note_id IS NULL
         AND (n.visibility IS NULL OR n.visibility = 'shared')
       ORDER BY n.capture_group_id NULLS LAST, n.created_at`,
      [project_id]
    ),
    query(
      `SELECT id, title, description FROM themes WHERE project_id = $1 ORDER BY created_at`,
      [project_id]
    ),
  ])

  const rawNotes = notesRes.rows
  const existingThemes = existingThemesRes.rows

  if (rawNotes.length === 0)
    return NextResponse.json({ error: 'All notes are already grouped into themes' }, { status: 400 })

  // Collapse capture groups into a single representative entry
  type Rep = { id: string; content: string; groupNoteIds?: string[] }
  const seenGroups = new Set<string>()
  const groupMembers = new Map<string, string[]>()
  for (const n of rawNotes) {
    if (n.capture_group_id) {
      const arr = groupMembers.get(n.capture_group_id) ?? []
      arr.push(n.id)
      groupMembers.set(n.capture_group_id, arr)
    }
  }
  const notes: Rep[] = []
  for (const n of rawNotes) {
    if (!n.capture_group_id) {
      notes.push({ id: n.id, content: n.content })
    } else if (!seenGroups.has(n.capture_group_id)) {
      seenGroups.add(n.capture_group_id)
      const ids = groupMembers.get(n.capture_group_id)!
      const suffix = ids.length > 1 ? ` [duplicate capture ×${ids.length} — treat as one finding]` : ''
      notes.push({ id: n.id, content: n.content + suffix, groupNoteIds: ids })
    }
  }

  const notesList = notes.map((n, i) => `${i}: ${n.content}`).join('\n')

  let prompt: string

  if (existingThemes.length > 0) {
    // Assign to existing themes first, only create new ones if truly necessary
    const themesList = existingThemes
      .map(t => `[id:${t.id}] ${t.title}${t.description ? ` — ${t.description}` : ''}`)
      .join('\n')
    prompt = `You are a senior UX researcher. Assign the following ${notes.length} ungrouped research notes to the most appropriate existing themes. Only create a new theme if a note clearly does not fit any existing theme.

Return ONLY valid JSON — no markdown, no explanation — in exactly this format:
{
  "themes": [
    {
      "id": "existing-theme-id-or-null",
      "title": "Only set if id is null — 2-4 words, title case",
      "description": "Only set if id is null — one sentence",
      "note_indices": [0, 3, 7]
    }
  ]
}

Rules:
- Strongly prefer assigning to existing themes — create new themes only when no existing theme fits
- When assigning to an existing theme, use its exact id string and omit title/description
- Set "id" to null only when a new theme is needed
- Every note index (0 to ${notes.length - 1}) must appear in exactly one theme entry
- New theme titles: 2-4 words, title case

Existing themes:
${themesList}

Ungrouped notes to assign:
${notesList}`
  } else {
    // No existing themes — create from scratch
    prompt = `You are a senior UX researcher. Group the following ${notes.length} research notes into themes.

Return ONLY valid JSON — no markdown, no explanation — in exactly this format:
{
  "themes": [
    {
      "id": null,
      "title": "Short theme title (2-4 words)",
      "description": "One sentence describing the pattern in these notes",
      "note_indices": [0, 3, 7]
    }
  ]
}

Rules:
- Create 4-7 themes that reflect the strongest recurring patterns
- Every note index (0 to ${notes.length - 1}) must appear in exactly one theme
- Theme titles: 2-4 words, title case, descriptive not generic
- Descriptions: one evidence-based sentence

Notes:
${notesList}`
  }

  const aiResult = await callAI(prompt)
  if (!aiResult.text) {
    const status = aiResult.error?.includes('No AI key') ? 503 : 502
    return NextResponse.json({ error: aiResult.error || 'AI returned no response' }, { status })
  }
  const raw = aiResult.text

  let parsed: { themes: { id: string | null; title?: string; description?: string; note_indices: number[] }[] }
  try {
    parsed = extractJSON(raw)
  } catch {
    return NextResponse.json({ error: 'AI returned invalid JSON — try again' }, { status: 500 })
  }

  if (!Array.isArray(parsed?.themes))
    return NextResponse.json({ error: 'Unexpected AI response structure' }, { status: 500 })

  const existingThemeIds = new Set(existingThemes.map(t => t.id))

  const client = await getClient()
  try {
    await client.query('BEGIN')

    // Fetch current max display_number and sort_order so new themes continue the sequence
    const { rows: [{ max_num, max_sort }] } = await client.query(
      `SELECT COALESCE(MAX(display_number), 0) AS max_num, COALESCE(MAX(sort_order), 0) AS max_sort FROM themes WHERE project_id = $1`,
      [project_id]
    )
    let nextNum = parseInt(max_num)
    let nextSort = parseInt(max_sort)

    const created: unknown[] = []
    for (const theme of parsed.themes) {
      let themeId: string

      if (theme.id && existingThemeIds.has(theme.id)) {
        // Assign notes to an existing theme — no insert needed
        themeId = theme.id
      } else {
        // Create a new theme with display_number and sort_order
        nextNum++
        nextSort++
        const r = await client.query(
          `INSERT INTO themes (project_id, title, description, created_by, display_number, sort_order) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [project_id, theme.title || 'Untitled Theme', theme.description || null, user.user_id, nextNum, nextSort]
        )
        themeId = r.rows[0].id
        created.push(r.rows[0])
      }

      for (const idx of theme.note_indices ?? []) {
        const rep = notes[idx]
        if (!rep) continue
        // Expand group representatives: assign all notes in the group to this theme
        const noteIds = rep.groupNoteIds ?? [rep.id]
        for (const noteId of noteIds) {
          await client.query(
            `INSERT INTO note_themes (note_id, theme_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [noteId, themeId]
          )
        }
      }
    }
    await client.query('COMMIT')
    return NextResponse.json({ themes: created })
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('Cluster notes error:', e)
    return NextResponse.json({ error: 'Failed to save themes' }, { status: 500 })
  } finally {
    client.release()
  }
}
