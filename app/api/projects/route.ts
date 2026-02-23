import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getAuthedUser, unauthorized, badRequest } from '@/lib/api-helpers'

export async function GET(_req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const result = await query(
    `SELECT p.*, pm.role
     FROM projects p
     JOIN project_memberships pm ON pm.project_id = p.id AND pm.user_id = $1
     ORDER BY p.updated_at DESC`,
    [user.user_id]
  )
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const { title, description, demo } = await request.json()
  if (!title?.trim()) return badRequest('Title is required')

  const client = await getClient()
  try {
    await client.query('BEGIN')

    const startPhase = demo ? 'themes' : 'interviews'

    const projResult = await client.query(
      `INSERT INTO projects (title, description, owner_id, demo, current_phase)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title.trim(), description?.trim() || null, user.user_id, !!demo, startPhase]
    )
    const project = projResult.rows[0]

    await client.query(
      `INSERT INTO project_memberships (project_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [project.id, user.user_id]
    )

    if (demo) {
      await seedDemoData(client, project.id, user.user_id)
    }

    await client.query('COMMIT')
    return NextResponse.json(project, { status: 201 })
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('Create project error:', e)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  } finally {
    client.release()
  }
}

async function seedDemoData(client: any, projectId: string, userId: string) {
  // 3 demo interviews
  const interviews = [
    { name: 'Alex Chen', notes: 'Frequent user. Mentioned difficulty tracking where research lives. "I always end up re-doing analysis I\'ve done before."' },
    { name: 'Priya Sharma', notes: 'Team lead. Frustrated by lack of traceability. "How do I know which insight came from which interview?"' },
    { name: 'Tom Nguyen', notes: 'Junior researcher. Spends too long in synthesis. "I copy-paste between Miro, Notion, and Docs constantly."' },
  ]

  const interviewIds: string[] = []
  for (const iv of interviews) {
    const r = await client.query(
      `INSERT INTO interviews (project_id, participant_name, raw_notes, created_by) VALUES ($1,$2,$3,$4) RETURNING id`,
      [projectId, iv.name, iv.notes, userId]
    )
    interviewIds.push(r.rows[0].id)
  }

  // 30 notes spread across interviews
  const notesData = [
    { content: '"I never know where the latest version of the synthesis doc is."', i: 0 },
    { content: '"We use Miro for clustering but the notes just float around with no structure."', i: 0 },
    { content: '"When I join a project mid-way, there\'s no way to get up to speed quickly."', i: 0 },
    { content: 'Observed: user had 4 browser tabs open with different versions of the same document.', i: 0 },
    { content: '"I duplicate my Notion template every time. It takes 30 minutes just to set up."', i: 0 },
    { content: '"Sometimes I forget which quote came from which participant."', i: 0 },
    { content: '"The hardest part is turning themes into insights — it feels arbitrary."', i: 0 },
    { content: 'Observed: researcher spent 20 min searching Slack for a note shared 2 weeks ago.', i: 0 },
    { content: '"We rarely get back to recommendations because synthesis takes too long."', i: 0 },
    { content: '"I wish I could see which recommendation is backed by the most evidence."', i: 0 },
    { content: '"We have no audit trail. Stakeholders ask where insights come from and I can\'t show them."', i: 1 },
    { content: '"I can\'t tell my junior researchers what process to follow. Everyone does it differently."', i: 1 },
    { content: '"Our recommendations get challenged in meetings because they look like opinions."', i: 1 },
    { content: '"I copy quotes into a doc, then themes into another doc, then insights into a slide deck."', i: 1 },
    { content: 'Observed: team used a shared spreadsheet to track themes. It had 3 conflicting versions.', i: 1 },
    { content: '"When I hand off to another researcher, context is always lost."', i: 1 },
    { content: '"If AI could help me name themes that would save hours."', i: 1 },
    { content: '"I want to be able to show a stakeholder the exact quote that backs up a recommendation."', i: 1 },
    { content: '"The gap between raw notes and actionable insights is where things fall apart."', i: 1 },
    { content: '"We don\'t have a shared language for what a theme vs insight vs recommendation is."', i: 1 },
    { content: '"Synthesis takes me 2–3 days and I\'m still not confident in the output."', i: 2 },
    { content: '"I got feedback that my insights were too vague. I didn\'t know how to make them more concrete."', i: 2 },
    { content: 'Observed: drag-and-drop in current tool was laggy. User gave up and used text lists instead.', i: 2 },
    { content: '"I spend more time formatting than thinking."', i: 2 },
    { content: '"I\'d love a tool that forces me to follow a consistent process."', i: 2 },
    { content: '"When we did a second round of research, we couldn\'t compare it to the first round."', i: 2 },
    { content: '"I want to work on synthesis with my team at the same time, not hand off a doc."', i: 2 },
    { content: '"The biggest problem is going from a pile of sticky notes to something I can present."', i: 2 },
    { content: '"I\'m always worried I\'m missing something important in the data."', i: 2 },
    { content: '"A demo showing me the workflow would have saved me weeks of figuring it out."', i: 2 },
  ]

  const noteIds: string[] = []
  for (const n of notesData) {
    const r = await client.query(
      `INSERT INTO notes (project_id, interview_id, content, created_by) VALUES ($1,$2,$3,$4) RETURNING id`,
      [projectId, interviewIds[n.i], n.content, userId]
    )
    noteIds.push(r.rows[0].id)
  }

  // 5 themes
  const themesData = [
    { title: 'Tool fragmentation', desc: 'Researchers use too many disconnected tools during synthesis.' },
    { title: 'Lack of traceability', desc: 'No clear link from recommendations back to source evidence.' },
    { title: 'Process inconsistency', desc: 'No shared structure or workflow for synthesis across the team.' },
    { title: 'Collaboration friction', desc: 'Hard to work on synthesis together or hand off context.' },
    { title: 'AI as a time-saver', desc: 'Researchers want AI help with naming and drafting, not replacing thinking.' },
  ]

  const themeIds: string[] = []
  for (const t of themesData) {
    const r = await client.query(
      `INSERT INTO themes (project_id, title, description, created_by) VALUES ($1,$2,$3,$4) RETURNING id`,
      [projectId, t.title, t.desc, userId]
    )
    themeIds.push(r.rows[0].id)
  }

  // Cluster ~22 notes into themes (≥70%)
  const noteMappings: [number, number][] = [
    [0,0],[1,0],[2,3],[3,0],[4,2],[5,1],[6,2],[7,0],[8,2],[9,1],
    [10,1],[11,2],[12,1],[13,0],[14,2],[15,3],[16,4],[17,1],[18,2],[19,2],
    [20,2],[21,2],[22,3],
  ]

  for (const [nIdx, tIdx] of noteMappings) {
    await client.query(
      `INSERT INTO note_themes (note_id, theme_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [noteIds[nIdx], themeIds[tIdx]]
    )
  }
}
