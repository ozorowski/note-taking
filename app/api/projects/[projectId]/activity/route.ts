import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthedUser, unauthorized, notFound, getProjectRole } from '@/lib/api-helpers'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()
  const { projectId } = await params
  const role = await getProjectRole(projectId, user.user_id)
  if (!role) return notFound()

  const result = await query(
    `SELECT pa.*, u.name AS user_name FROM project_activity pa
     LEFT JOIN users u ON u.id = pa.user_id
     WHERE pa.project_id = $1 ORDER BY pa.created_at DESC LIMIT 50`,
    [projectId]
  )
  return NextResponse.json(result.rows)
}
