import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, notFound, badRequest, getProjectRole } from '@/lib/api-helpers'

type Params = { params: Promise<{ recommendationId: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { recommendationId } = await params
  const rec = (await query('SELECT * FROM recommendations WHERE id = $1', [recommendationId])).rows[0]
  if (!rec) return notFound()
  const role = await getProjectRole(rec.project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()

  const { insight_id } = await request.json()
  if (!insight_id) return badRequest('insight_id required')
  await query('INSERT INTO recommendation_insights (recommendation_id, insight_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [recommendationId, insight_id])
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { recommendationId } = await params
  const rec = (await query('SELECT * FROM recommendations WHERE id = $1', [recommendationId])).rows[0]
  if (!rec) return notFound()
  const role = await getProjectRole(rec.project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()

  const insightId = new URL(request.url).searchParams.get('insightId')
  if (!insightId) return badRequest('insightId required')
  await query('DELETE FROM recommendation_insights WHERE recommendation_id = $1 AND insight_id = $2', [recommendationId, insightId])
  return NextResponse.json({ success: true })
}
