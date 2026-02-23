import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, notFound, badRequest, getProjectRole } from '@/lib/api-helpers'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ noteId: string }> }) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { noteId } = await params
  const note = (await query('SELECT * FROM notes WHERE id = $1', [noteId])).rows[0]
  if (!note) return notFound()
  const role = await getProjectRole(note.project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()

  const { tags } = await request.json()
  if (!Array.isArray(tags)) return badRequest('tags must be an array')
  const clean = [...new Set((tags as string[]).map(t => t.trim().toLowerCase()).filter(Boolean))]

  await query('DELETE FROM note_tags WHERE note_id = $1', [noteId])
  for (const tag of clean) {
    await query('INSERT INTO note_tags (note_id, tag) VALUES ($1,$2) ON CONFLICT DO NOTHING', [noteId, tag])
  }
  return NextResponse.json({ tags: clean })
}
