import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, notFound, getProjectRole } from '@/lib/api-helpers'

type Params = { params: Promise<{ noteId: string }> }

async function getNote(id: string) {
  const r = await query('SELECT * FROM notes WHERE id = $1', [id])
  return r.rows[0] || null
}

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { noteId } = await params
  const note = await getNote(noteId)
  if (!note) return notFound()
  const role = await getProjectRole(note.project_id, user.user_id)
  if (!role) return notFound()

  const [tagsRes, themesRes, commentsRes] = await Promise.all([
    query('SELECT tag FROM note_tags WHERE note_id = $1 ORDER BY tag', [noteId]),
    query(`SELECT t.* FROM themes t JOIN note_themes nt ON nt.theme_id = t.id WHERE nt.note_id = $1`, [noteId]),
    query(`SELECT c.*, u.name AS author_name FROM comments c JOIN users u ON u.id = c.user_id WHERE c.card_id = $1 ORDER BY c.created_at`, [noteId]),
  ])

  return NextResponse.json({
    ...note,
    tags: tagsRes.rows.map(r => r.tag),
    themes: themesRes.rows,
    comments: commentsRes.rows,
  })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { noteId } = await params
  const note = await getNote(noteId)
  if (!note) return notFound()
  const role = await getProjectRole(note.project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()

  const { content, interview_id } = await request.json()
  const result = await query(
    `UPDATE notes SET content = COALESCE($1, content), interview_id = COALESCE($2, interview_id), updated_at = NOW() WHERE id = $3 RETURNING *`,
    [content?.trim() || null, interview_id !== undefined ? interview_id : null, noteId]
  )
  return NextResponse.json(result.rows[0])
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { noteId } = await params
  const note = await getNote(noteId)
  if (!note) return notFound()
  const role = await getProjectRole(note.project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()
  await query('DELETE FROM notes WHERE id = $1', [noteId])
  return NextResponse.json({ success: true })
}
