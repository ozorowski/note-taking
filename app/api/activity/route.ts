import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, badRequest, getProjectRole } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const { searchParams } = new URL(request.url)
  const entity_type = searchParams.get('entity_type')
  const entity_id = searchParams.get('entity_id')
  if (!entity_type || !entity_id) return badRequest('entity_type and entity_id required')

  // Look up entity to get project_id for role check
  const tableMap: Record<string, string> = {
    note: 'notes',
    interview: 'interviews',
    insight: 'insights',
    recommendation: 'recommendations',
    theme: 'themes',
  }
  const table = tableMap[entity_type]
  if (!table) return badRequest('invalid entity_type')

  const entityRes = await query(`SELECT project_id FROM ${table} WHERE id = $1`, [entity_id])
  if (!entityRes.rows[0]) return NextResponse.json([])

  const role = await getProjectRole(entityRes.rows[0].project_id, user.user_id)
  if (!role) return NextResponse.json([])

  const result = await query(
    `SELECT pa.action, pa.created_at, u.name AS user_name
     FROM project_activity pa
     LEFT JOIN users u ON u.id = pa.user_id
     WHERE pa.entity_type = $1 AND pa.entity_id = $2 AND pa.action = 'edited'
     ORDER BY pa.created_at DESC`,
    [entity_type, entity_id]
  )

  return NextResponse.json(result.rows)
}
