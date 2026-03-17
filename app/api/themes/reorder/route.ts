import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
import { getAuthedUser, unauthorized, forbidden, getProjectRole } from '@/lib/api-helpers'

export async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const { project_id, theme_ids } = await request.json()
  if (!project_id || !Array.isArray(theme_ids)) {
    return NextResponse.json({ error: 'project_id and theme_ids required' }, { status: 400 })
  }

  const role = await getProjectRole(project_id, user.user_id)
  if (!role || role === 'viewer') return forbidden()

  const client = await getClient()
  try {
    await client.query('BEGIN')
    for (let i = 0; i < theme_ids.length; i++) {
      await client.query(
        `UPDATE themes SET sort_order = $1 WHERE id = $2 AND project_id = $3`,
        [i + 1, theme_ids[i], project_id]
      )
    }
    await client.query('COMMIT')
    return NextResponse.json({ ok: true })
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('Reorder themes error:', e)
    return NextResponse.json({ error: 'Failed to reorder themes' }, { status: 500 })
  } finally {
    client.release()
  }
}
