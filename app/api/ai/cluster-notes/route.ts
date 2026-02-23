import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getAuthedUser, unauthorized, getProjectRole } from '@/lib/api-helpers'

async function callAI(prompt: string): Promise<{ text: string; error?: string }> {
  if (process.env.GEMINI_API_KEY) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
    if (!res.ok) {
      console.error('Gemini API error:', data)
      return { text: '', error: `Gemini API error: ${data?.error?.message || res.status}` }
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    if (!text) {
      console.error('Gemini returned no text:', JSON.stringify(data))
      return { text: '', error: 'Gemini returned an empty response — try again' }
    }
    return { text }
  }

  if (process.env.OPENAI_API_KEY) {
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
    if (!res.ok) {
      console.error('OpenAI API error:', data)
      return { text: '', error: `OpenAI API error: ${data?.error?.message || res.status}` }
    }
    return { text: data.choices?.[0]?.message?.content || '' }
  }

  return { text: '', error: 'No AI key configured — add GEMINI_API_KEY to your environment' }
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

  const notesRes = await query(
    `SELECT id, content FROM notes WHERE project_id = $1 ORDER BY created_at`,
    [project_id]
  )
  const notes = notesRes.rows
  if (notes.length === 0)
    return NextResponse.json({ error: 'No notes to cluster' }, { status: 400 })

  const notesList = notes.map((n, i) => `${i}: ${n.content}`).join('\n')

  const prompt = `You are a senior UX researcher. Group the following ${notes.length} research notes into themes.

Return ONLY valid JSON — no markdown, no explanation — in exactly this format:
{
  "themes": [
    {
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

  const aiResult = await callAI(prompt)
  if (!aiResult.text) {
    const status = aiResult.error?.includes('No AI key') ? 503 : 502
    return NextResponse.json({ error: aiResult.error || 'AI returned no response' }, { status })
  }
  const raw = aiResult.text

  let parsed: { themes: { title: string; description: string; note_indices: number[] }[] }
  try {
    parsed = extractJSON(raw)
  } catch {
    return NextResponse.json({ error: 'AI returned invalid JSON — try again' }, { status: 500 })
  }

  if (!Array.isArray(parsed?.themes))
    return NextResponse.json({ error: 'Unexpected AI response structure' }, { status: 500 })

  const client = await getClient()
  try {
    await client.query('BEGIN')
    const created = []
    for (const theme of parsed.themes) {
      const r = await client.query(
        `INSERT INTO themes (project_id, title, description, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
        [project_id, theme.title, theme.description || null, user.user_id]
      )
      const themeId = r.rows[0].id
      created.push(r.rows[0])
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
