import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, getProjectRole } from '@/lib/api-helpers'

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  if (process.env.GEMINI_API_KEY) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { maxOutputTokens: 800 },
        }),
      }
    )
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
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
        max_tokens: 800,
      }),
    })
    const data = await res.json()
    return data.choices?.[0]?.message?.content || ''
  }

  return ''
}

function parseDrafts(raw: string): string[] {
  // Build up multi-line numbered items
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  const drafts: string[] = []
  let current = ''
  for (const line of lines) {
    if (/^\d+[.)]\s/.test(line)) {
      if (current.trim()) drafts.push(current.trim())
      current = line.replace(/^\d+[.)]\s+/, '')
    } else if (current) {
      current += ' ' + line
    }
  }
  if (current.trim()) drafts.push(current.trim())
  return drafts.length >= 2 ? drafts : raw.trim() ? [raw.trim()] : []
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
     WHERE nt.theme_id = ANY($1::uuid[]) AND n.project_id = $2 LIMIT 30`,
    [theme_ids, project_id]
  )

  const themesList = themesRes.rows.map(t => `- ${t.title}${t.description ? ': ' + t.description : ''}`).join('\n')
  const notesList = notesRes.rows.map(n => `- ${n.content}`).join('\n')

  const systemPrompt = `You are a senior UX researcher. Generate exactly 3 distinct, evidence-based insights from the themes and notes provided.

Format each insight using this exact template — as a single sentence:
When [context/situation], [participants] [behaviour or struggle], because [underlying cause], which leads to [impact or consequence].

Rules:
- Each insight must be one complete sentence following the template exactly.
- Be specific — reference the actual themes and notes.
- Do not start with "Users". Use "researchers", "teams", or a specific role.
- Number them 1. 2. 3. — output nothing else.`

  const userPrompt = `Themes:\n${themesList}\n\nSupporting notes:\n${notesList}`

  const aiRaw = await callAI(systemPrompt, userPrompt)

  if (!aiRaw) {
    const stub = themesRes.rows.map(t => t.title).join(', ')
    return NextResponse.json({
      drafts: [`When working with themes like ${stub}, researchers struggle to synthesise findings, because no AI key is configured — add a GEMINI_API_KEY environment variable to get real AI drafts.`],
    })
  }

  const drafts = parseDrafts(aiRaw)
  return NextResponse.json({ drafts })
}
