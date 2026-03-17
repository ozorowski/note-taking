import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, badRequest, getProjectRole } from '@/lib/api-helpers'
import { broadcastProjectUpdate } from '@/lib/pusher'

export async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const { project_id, note_ids } = await request.json()
  if (!project_id || !Array.isArray(note_ids) || note_ids.length < 2)
    return badRequest('project_id and at least 2 note_ids required')

  const role = await getProjectRole(project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()

  const client = await getClient()
  try {
    await client.query('BEGIN')

    // Fetch the notes to validate
    const { rows: notes } = await client.query(
      `SELECT id, interview_id, capture_group_id FROM notes
       WHERE id = ANY($1) AND project_id = $2`,
      [note_ids, project_id]
    )

    if (notes.length !== note_ids.length)
      return NextResponse.json({ error: 'One or more notes not found in this project' }, { status: 400 })

    // Guard: all notes must share the same interview_id
    const interviewIds = new Set(notes.map((n: { interview_id: string }) => n.interview_id))
    if (interviewIds.size > 1) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { error: 'Duplicate grouping is only available within the same interview. Selected notes belong to different interviews.' },
        { status: 400 }
      )
    }

    const interview_id = notes[0].interview_id

    // Guard: no note already belongs to a different group
    const existingGroupIds = new Set(
      notes.map((n: { capture_group_id: string | null }) => n.capture_group_id).filter(Boolean)
    )
    if (existingGroupIds.size > 1) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { error: 'Some notes already belong to different groups. Remove them from their groups first.' },
        { status: 400 }
      )
    }

    // Create capture group
    const { rows: [group] } = await client.query(
      `INSERT INTO capture_groups (project_id, interview_id, created_by) VALUES ($1, $2, $3) RETURNING id`,
      [project_id, interview_id, user.user_id]
    )

    // Assign all notes to the group
    await client.query(
      `UPDATE notes SET capture_group_id = $1 WHERE id = ANY($2)`,
      [group.id, note_ids]
    )

    // If notes span different themes (or a mix of themed/unthemed), pull them all out of themes
    const { rows: themeRows } = await client.query(
      `SELECT note_id, theme_id FROM note_themes WHERE note_id = ANY($1)`,
      [note_ids]
    )
    if (themeRows.length > 0) {
      const distinctThemes = new Set(themeRows.map((r: { theme_id: string }) => r.theme_id))
      const notesWithTheme = new Set(themeRows.map((r: { note_id: string }) => r.note_id))
      const allInSameTheme = distinctThemes.size === 1 && note_ids.every((id: string) => notesWithTheme.has(id))
      if (!allInSameTheme) {
        await client.query(`DELETE FROM note_themes WHERE note_id = ANY($1)`, [note_ids])
      }
    }

    await client.query('COMMIT')
    await broadcastProjectUpdate(project_id)

    return NextResponse.json({ group_id: group.id, note_count: note_ids.length }, { status: 201 })
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('Create capture group error:', e)
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })
  } finally {
    client.release()
  }
}
