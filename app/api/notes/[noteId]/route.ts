import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, notFound, getProjectRole, logActivity } from '@/lib/api-helpers'
import { broadcastProjectUpdate } from '@/lib/pusher'

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

  const body = await request.json()
  const { content, interview_id, visibility, evidence_type } = body
  const guideQuestionChanged = 'guide_question_id' in body
  const guideQuestionValue = body.guide_question_id || null
  const captureGroupChanged = 'capture_group_id' in body
  const removingFromGroup = captureGroupChanged && body.capture_group_id === null
  const settingGroup = captureGroupChanged && body.capture_group_id !== null
  const newGroupId: string | null = settingGroup ? body.capture_group_id : null
  const oldGroupId: string | null = removingFromGroup ? (note.capture_group_id ?? null) : null

  // visibility and evidence_type can only be changed by the note creator
  if ((visibility !== undefined || evidence_type !== undefined) && note.created_by !== user.user_id) {
    return forbidden()
  }

  const result = await query(
    `UPDATE notes
     SET content = COALESCE($1, content),
         interview_id = COALESCE($2, interview_id),
         visibility = COALESCE($3, visibility),
         evidence_type = COALESCE($4, evidence_type),
         guide_question_id = CASE WHEN $5 THEN $6::uuid ELSE guide_question_id END,
         capture_group_id = CASE WHEN $8 THEN NULL WHEN $9 THEN $10::uuid ELSE capture_group_id END,
         updated_at = NOW()
     WHERE id = $7 RETURNING *`,
    [content?.trim() || null, interview_id !== undefined ? interview_id : null, visibility || null, evidence_type || null, guideQuestionChanged, guideQuestionValue, noteId, removingFromGroup, settingGroup, newGroupId]
  )

  // If removing from group, dissolve the group when ≤1 note remains
  if (oldGroupId) {
    const { rows } = await query(
      `SELECT COUNT(*) AS cnt FROM notes WHERE capture_group_id = $1`,
      [oldGroupId]
    )
    if (parseInt(rows[0].cnt) <= 1) {
      await query(`DELETE FROM capture_groups WHERE id = $1`, [oldGroupId])
    }
  }

  await broadcastProjectUpdate(note.project_id)
  await logActivity(note.project_id, user.user_id, 'edited', 'note', noteId)
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
  const deletedGroupId: string | null = note.capture_group_id ?? null
  await query('DELETE FROM notes WHERE id = $1', [noteId])
  // Dissolve group if ≤1 note remains after deletion
  if (deletedGroupId) {
    const { rows } = await query(
      `SELECT COUNT(*) AS cnt FROM notes WHERE capture_group_id = $1`,
      [deletedGroupId]
    )
    if (parseInt(rows[0].cnt) <= 1) {
      await query(`DELETE FROM capture_groups WHERE id = $1`, [deletedGroupId])
    }
  }
  await broadcastProjectUpdate(note.project_id)
  return NextResponse.json({ success: true })
}
