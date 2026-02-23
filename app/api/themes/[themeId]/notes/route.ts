import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, notFound, badRequest, getProjectRole } from '@/lib/api-helpers'

type Params = { params: Promise<{ themeId: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { themeId } = await params
  const theme = (await query('SELECT * FROM themes WHERE id = $1', [themeId])).rows[0]
  if (!theme) return notFound()
  const role = await getProjectRole(theme.project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()

  const { note_id } = await request.json()
  if (!note_id) return badRequest('note_id required')

  await query(
    'INSERT INTO note_themes (note_id, theme_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
    [note_id, themeId]
  )
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { themeId } = await params
  const theme = (await query('SELECT * FROM themes WHERE id = $1', [themeId])).rows[0]
  if (!theme) return notFound()
  const role = await getProjectRole(theme.project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()

  const { searchParams } = new URL(request.url)
  const noteId = searchParams.get('noteId')
  if (!noteId) return badRequest('noteId required')

  await query('DELETE FROM note_themes WHERE note_id = $1 AND theme_id = $2', [noteId, themeId])
  return NextResponse.json({ success: true })
}
