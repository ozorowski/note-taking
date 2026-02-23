import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, notFound, badRequest, getProjectRole } from '@/lib/api-helpers'

type Params = { params: Promise<{ insightId: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { insightId } = await params
  const insight = (await query('SELECT * FROM insights WHERE id = $1', [insightId])).rows[0]
  if (!insight) return notFound()
  const role = await getProjectRole(insight.project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()

  const { theme_id } = await request.json()
  if (!theme_id) return badRequest('theme_id required')
  await query('INSERT INTO insight_themes (insight_id, theme_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [insightId, theme_id])
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { insightId } = await params
  const insight = (await query('SELECT * FROM insights WHERE id = $1', [insightId])).rows[0]
  if (!insight) return notFound()
  const role = await getProjectRole(insight.project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()

  const themeId = new URL(request.url).searchParams.get('themeId')
  if (!themeId) return badRequest('themeId required')
  await query('DELETE FROM insight_themes WHERE insight_id = $1 AND theme_id = $2', [insightId, themeId])
  return NextResponse.json({ success: true })
}
