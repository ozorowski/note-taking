import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, notFound, getProjectRole } from '@/lib/api-helpers'

type Params = { params: Promise<{ themeId: string }> }

async function getTheme(id: string) {
  return (await query('SELECT * FROM themes WHERE id = $1', [id])).rows[0] || null
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { themeId } = await params
  const theme = await getTheme(themeId)
  if (!theme) return notFound()
  const role = await getProjectRole(theme.project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()

  const { title, description } = await request.json()
  const result = await query(
    `UPDATE themes SET title = COALESCE($1, title), description = COALESCE($2, description), updated_at = NOW() WHERE id = $3 RETURNING *`,
    [title?.trim() || null, description !== undefined ? description?.trim() ?? null : null, themeId]
  )
  return NextResponse.json(result.rows[0])
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { themeId } = await params
  const theme = await getTheme(themeId)
  if (!theme) return notFound()
  const role = await getProjectRole(theme.project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()
  await query('DELETE FROM themes WHERE id = $1', [themeId])
  return NextResponse.json({ success: true })
}
