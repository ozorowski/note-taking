import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, getProjectRole } from '@/lib/api-helpers'

export async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const { project_id, theme_ids } = await request.json()
  if (!project_id || !Array.isArray(theme_ids) || theme_ids.length === 0)
    return NextResponse.json({ error: 'project_id and theme_ids required' }, { status: 400 })

  const role = await getProjectRole(project_id, user.user_id)
  if (!role || role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch themes and their notes
  const themesRes = await query(
    `SELECT t.title, t.description FROM themes t WHERE t.id = ANY($1::uuid[]) AND t.project_id = $2`,
    [theme_ids, project_id]
  )
  const notesRes = await query(
    `SELECT n.content FROM notes n JOIN note_themes nt ON nt.note_id = n.id
     WHERE nt.theme_id = ANY($1::uuid[]) AND n.project_id = $2 LIMIT 20`,
    [theme_ids, project_id]
  )

  const themesList = themesRes.rows.map(t => `- ${t.title}: ${t.description || ''}`).join('\n')
  const notesList = notesRes.rows.map(n => `- ${n.content}`).join('\n')

  let draft: string

  if (!process.env.OPENAI_API_KEY) {
    draft = `[AI stub] Based on themes: ${themesRes.rows.map(t => t.title).join(', ')} — users experience friction during research synthesis due to tool fragmentation and lack of structured process. Add OPENAI_API_KEY to get real AI drafts.`
  } else {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a senior UX researcher. Draft a concise, evidence-based insight (2-3 sentences) from the themes and notes provided. Start with the key finding, not "Users...".' },
          { role: 'user', content: `Themes:\n${themesList}\n\nSupporting notes:\n${notesList}` },
        ],
        max_tokens: 200,
      }),
    })
    const data = await res.json()
    draft = data.choices?.[0]?.message?.content || 'Could not generate draft.'
  }

  await query(
    `INSERT INTO ai_outputs (entity_type, entity_id, output_type, content) VALUES ('project', $1, 'insight_draft', $2)`,
    [project_id, draft]
  )

  return NextResponse.json({ draft })
}
