import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, notFound, getProjectRole } from '@/lib/api-helpers'
import { broadcastProjectUpdate } from '@/lib/pusher'

type Params = { params: Promise<{ insightId: string }> }

async function getInsight(id: string) {
  return (await query('SELECT * FROM insights WHERE id = $1', [id])).rows[0] || null
}

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { insightId } = await params
  const insight = await getInsight(insightId)
  if (!insight) return notFound()
  const role = await getProjectRole(insight.project_id, user.user_id)
  if (!role) return notFound()

  const themesRes = await query(
    `SELECT t.* FROM themes t JOIN insight_themes it ON it.theme_id = t.id WHERE it.insight_id = $1`,
    [insightId]
  )
  return NextResponse.json({ ...insight, themes: themesRes.rows })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { insightId } = await params
  const insight = await getInsight(insightId)
  if (!insight) return notFound()
  const role = await getProjectRole(insight.project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()

  const { content, evidence_summary } = await request.json()
  const result = await query(
    `UPDATE insights SET content = COALESCE($1, content), evidence_summary = COALESCE($2, evidence_summary), updated_at = NOW() WHERE id = $3 RETURNING *`,
    [content?.trim() || null, evidence_summary !== undefined ? evidence_summary?.trim() ?? null : null, insightId]
  )
  await broadcastProjectUpdate(insight.project_id)
  return NextResponse.json(result.rows[0])
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { insightId } = await params
  const insight = await getInsight(insightId)
  if (!insight) return notFound()
  const role = await getProjectRole(insight.project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()
  await query('DELETE FROM insights WHERE id = $1', [insightId])
  await broadcastProjectUpdate(insight.project_id)
  return NextResponse.json({ success: true })
}
