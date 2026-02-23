import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, notFound, getProjectRole, getProjectCounts } from '@/lib/api-helpers'

type Params = { params: Promise<{ projectId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { projectId } = await params

  const role = await getProjectRole(projectId, user.user_id)
  if (!role) return notFound()

  const [projRes, membersRes, interviewsRes, notesRes, themesRes, insightsRes, recsRes, counts] =
    await Promise.all([
      query('SELECT * FROM projects WHERE id = $1', [projectId]),
      query(`SELECT u.id, u.name, pm.role FROM project_memberships pm JOIN users u ON u.id = pm.user_id WHERE pm.project_id = $1`, [projectId]),
      query('SELECT * FROM interviews WHERE project_id = $1 ORDER BY created_at ASC', [projectId]),
      query(`SELECT n.*, COALESCE(array_agg(nt.tag) FILTER (WHERE nt.tag IS NOT NULL),'{}') AS tags,
               COALESCE(array_agg(nth.theme_id::text) FILTER (WHERE nth.theme_id IS NOT NULL), '{}') AS theme_ids,
               i.participant_name AS interview_name, u.name AS creator_name
             FROM notes n
             LEFT JOIN note_tags nt ON nt.note_id = n.id
             LEFT JOIN note_themes nth ON nth.note_id = n.id
             LEFT JOIN interviews i ON i.id = n.interview_id
             LEFT JOIN users u ON u.id = n.created_by
             WHERE n.project_id = $1
             GROUP BY n.id, i.participant_name, u.name
             ORDER BY n.created_at ASC`, [projectId]),
      query(`SELECT t.*, COUNT(nth.note_id)::int AS note_count
             FROM themes t
             LEFT JOIN note_themes nth ON nth.theme_id = t.id
             WHERE t.project_id = $1
             GROUP BY t.id ORDER BY t.created_at ASC`, [projectId]),
      query(`SELECT ins.*, u.name AS creator_name,
               COALESCE(array_agg(it.theme_id::text) FILTER (WHERE it.theme_id IS NOT NULL), '{}') AS theme_ids
             FROM insights ins
             LEFT JOIN insight_themes it ON it.insight_id = ins.id
             LEFT JOIN users u ON u.id = ins.created_by
             WHERE ins.project_id = $1
             GROUP BY ins.id, u.name ORDER BY ins.created_at ASC`, [projectId]),
      query(`SELECT r.*, u.name AS creator_name,
               COALESCE(array_agg(ri.insight_id::text) FILTER (WHERE ri.insight_id IS NOT NULL), '{}') AS insight_ids
             FROM recommendations r
             LEFT JOIN recommendation_insights ri ON ri.recommendation_id = r.id
             LEFT JOIN users u ON u.id = r.created_by
             WHERE r.project_id = $1
             GROUP BY r.id, u.name ORDER BY r.created_at ASC`, [projectId]),
      getProjectCounts(projectId),
    ])

  if (!projRes.rows[0]) return notFound()

  return NextResponse.json({
    ...projRes.rows[0],
    role,
    members: membersRes.rows,
    interviews: interviewsRes.rows,
    notes: notesRes.rows,
    themes: themesRes.rows,
    insights: insightsRes.rows,
    recommendations: recsRes.rows,
    counts,
  })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { projectId } = await params
  const role = await getProjectRole(projectId, user.user_id)
  if (!role || role === 'viewer') return forbidden()

  const { title, description, executive_summary } = await request.json()

  if (executive_summary !== undefined) {
    const result = await query(
      `UPDATE projects SET executive_summary = $1, executive_summary_generated_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *`,
      [executive_summary, projectId]
    )
    return NextResponse.json(result.rows[0])
  }

  const result = await query(
    `UPDATE projects SET title = COALESCE($1, title), description = COALESCE($2, description), updated_at = NOW() WHERE id = $3 RETURNING *`,
    [title?.trim() || null, description !== undefined ? description?.trim() ?? null : null, projectId]
  )
  return NextResponse.json(result.rows[0])
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { projectId } = await params
  const role = await getProjectRole(projectId, user.user_id)
  if (role !== 'owner') return forbidden()
  await query('DELETE FROM projects WHERE id = $1', [projectId])
  return NextResponse.json({ success: true })
}
