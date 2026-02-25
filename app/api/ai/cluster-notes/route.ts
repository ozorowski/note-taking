import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getAuthedUser, unauthorized, getProjectRole } from '@/lib/api-helpers'

async function callAI(prompt: string): Promise<{ text: string; error?: string }> {
  if (process.env.GEMINI_API_KEY) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 2000 },
          }),
        }
      )
      const data = await res.json()
      if (res.ok) {
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (text) return { text }
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
            { role: 'system', content: 'You are a senior UX researcher. You must respond with valid JSON only — no markdown, no explanation.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 2000,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        const text = data.choices?.[0]?.message?.content || ''
        if (text) return { text }
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
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2000,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        const text = data.choices?.[0]?.message?.content || ''
        if (text) return { text }
      }
      console.error('OpenAI failed:', data?.error?.message || res.status)
    } catch (e) {
      console.error('OpenAI error:', e)
    }
  }

  return { text: '', error: 'No AI key configured — add GROQ_API_KEY to your environment' }
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
      `SELECT n.id, n.content
       FROM notes n
       LEFT JOIN note_themes nt ON nt.note_id = n.id
       WHERE n.project_id = $1 AND nt.note_id IS NULL
       ORDER BY n.created_at`,
      [project_id]
    ),
    query(
      `SELECT id, title, description FROM themes WHERE project_id = $1 ORDER BY created_at`,
      [project_id]
    ),
  ])

  const notes = notesRes.rows
  const existingThemes = existingThemesRes.rows

  if (notes.length === 0)
    return NextResponse.json({ error: 'All notes are already grouped into themes' }, { status: 400 })

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
    const created: unknown[] = []
    for (const theme of parsed.themes) {
      let themeId: string

      if (theme.id && existingThemeIds.has(theme.id)) {
        // Assign notes to an existing theme — no insert needed
        themeId = theme.id
      } else {
        // Create a new theme
        const r = await client.query(
          `INSERT INTO themes (project_id, title, description, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
          [project_id, theme.title || 'Untitled Theme', theme.description || null, user.user_id]
        )
        themeId = r.rows[0].id
        created.push(r.rows[0])
      }

      for (const idx of theme.note_indices ?? []) {
        const note = notes[idx]
        if (!note) continue
        await client.query(
          `INSERT INTO note_themes (note_id, theme_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [note.id, themeId]
        )
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
