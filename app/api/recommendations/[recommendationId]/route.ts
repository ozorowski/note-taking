import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, notFound, getProjectRole } from '@/lib/api-helpers'

type Params = { params: Promise<{ recommendationId: string }> }

async function getRec(id: string) {
  return (await query('SELECT * FROM recommendations WHERE id = $1', [id])).rows[0] || null
}

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { recommendationId } = await params
  const rec = await getRec(recommendationId)
  if (!rec) return notFound()
  const role = await getProjectRole(rec.project_id, user.user_id)
  if (!role) return notFound()

  const insightsRes = await query(
    `SELECT i.* FROM insights i JOIN recommendation_insights ri ON ri.insight_id = i.id WHERE ri.recommendation_id = $1`,
    [recommendationId]
  )
  return NextResponse.json({ ...rec, insights: insightsRes.rows })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { recommendationId } = await params
  const rec = await getRec(recommendationId)
  if (!rec) return notFound()
  const role = await getProjectRole(rec.project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()

  const { content, rationale } = await request.json()
  const result = await query(
    `UPDATE recommendations SET content = COALESCE($1, content), rationale = COALESCE($2, rationale), updated_at = NOW() WHERE id = $3 RETURNING *`,
    [content?.trim() || null, rationale !== undefined ? rationale?.trim() ?? null : null, recommendationId]
  )
  return NextResponse.json(result.rows[0])
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { recommendationId } = await params
  const rec = await getRec(recommendationId)
  if (!rec) return notFound()
  const role = await getProjectRole(rec.project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()
  await query('DELETE FROM recommendations WHERE id = $1', [recommendationId])
  return NextResponse.json({ success: true })
}
