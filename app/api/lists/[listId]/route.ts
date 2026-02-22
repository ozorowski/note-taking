import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'

async function getAuthedUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  return token ? verifyToken(token) : null
}

async function checkListAccess(listId: string, userId: string) {
  const result = await query(
    `SELECT bm.role FROM lists l
     JOIN board_memberships bm ON bm.board_id = l.board_id AND bm.user_id = $2
     WHERE l.id = $1`,
    [listId, userId]
  )
  return result.rows[0] || null
}

// PATCH /api/lists/[listId] — rename a list
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ listId: string }> }) {
  const payload = await getAuthedUser()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { listId } = await params
  const access = await checkListAccess(listId, payload.user_id)
  if (!access || access.role === 'viewer')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { title } = await request.json()
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  const result = await query(
    `UPDATE lists SET title = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [title.trim(), listId]
  )
  return NextResponse.json(result.rows[0])
}

// DELETE /api/lists/[listId] — delete a list (and all its cards)
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ listId: string }> }) {
  const payload = await getAuthedUser()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { listId } = await params
  const access = await checkListAccess(listId, payload.user_id)
  if (!access || access.role === 'viewer')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await query(`DELETE FROM lists WHERE id = $1`, [listId])
  return NextResponse.json({ success: true })
}
