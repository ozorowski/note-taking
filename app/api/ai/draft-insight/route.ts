import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, getProjectRole } from '@/lib/api-helpers'

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  if (process.env.GEMINI_API_KEY) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not generate draft.'
  }

  if (process.env.OPENAI_API_KEY) {
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
    return data.choices?.[0]?.message?.content || 'Could not generate draft.'
  }

  return null as unknown as string // signals no key set
}

export async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const { project_id, theme_ids } = await request.json()
  if (!project_id || !Array.isArray(theme_ids) || theme_ids.length === 0)
    return NextResponse.json({ error: 'project_id and theme_ids required' }, { status: 400 })

  const role = await getProjectRole(project_id, user.user_id)
  if (!role || role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const themesRes = await query(
    `SELECT t.title, t.description FROM themes t WHERE t.id = ANY($1::uuid[]) AND t.project_id = $2`,
    [theme_ids, project_id]
  )
  const notesRes = await query(
    `SELECT n.content FROM notes n JOIN note_themes nt ON nt.note_id = n.id
     WHERE nt.theme_id = ANY($1::uuid[]) AND n.project_id = $2 LIMIT 20`,
    [theme_ids, project_id]
  )

  const themesList = themesRes.rows.map(t => `- ${t.title}${t.description ? ': ' + t.description : ''}`).join('\n')
  const notesList = notesRes.rows.map(n => `- ${n.content}`).join('\n')

  const systemPrompt = 'You are a senior UX researcher. Draft a concise, evidence-based insight (2-3 sentences) from the themes and notes provided. Start with the key finding, not "Users...".'
  const userPrompt = `Themes:\n${themesList}\n\nSupporting notes:\n${notesList}`

  const aiResult = await callAI(systemPrompt, userPrompt)
  const draft = aiResult ?? `[No AI key set] Based on themes: ${themesRes.rows.map(t => t.title).join(', ')} — add a GEMINI_API_KEY environment variable to get real AI drafts.`

  return NextResponse.json({ draft })
}
