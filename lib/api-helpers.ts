import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifyToken } from './auth'
import { query } from './db'
import type { AuthToken, ProjectCounts } from './types'

export async function getAuthedUser(): Promise<AuthToken | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  return token ? verifyToken(token) : null
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 })
}

// Returns the user's role on a project, or null if no access
export async function getProjectRole(projectId: string, userId: string): Promise<string | null> {
  const result = await query(
    'SELECT role FROM project_memberships WHERE project_id = $1 AND user_id = $2',
    [projectId, userId]
  )
  return result.rows[0]?.role ?? null
}

// Log an activity event
export async function logActivity(
  projectId: string,
  userId: string,
  action: string,
  entityType?: string,
  entityId?: string
) {
  await query(
    `INSERT INTO project_activity (project_id, user_id, action, entity_type, entity_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [projectId, userId, action, entityType ?? null, entityId ?? null]
  )
}

// Fetch ProjectCounts for a project
export async function getProjectCounts(projectId: string): Promise<ProjectCounts> {
  const r = await query<ProjectCounts>(
    `SELECT
      (SELECT COUNT(*) FROM interviews WHERE project_id = $1)::int AS interview_count,
      (SELECT COUNT(*) FROM notes WHERE project_id = $1)::int AS note_count,
      (SELECT COUNT(DISTINCT note_id) FROM note_themes nt
        JOIN notes n ON n.id = nt.note_id WHERE n.project_id = $1)::int AS clustered_note_count,
      (SELECT COUNT(*) FROM themes WHERE project_id = $1)::int AS theme_count,
      (SELECT COUNT(*) FROM insights WHERE project_id = $1)::int AS insight_count,
      (SELECT COUNT(DISTINCT insight_id) FROM insight_themes it
        JOIN insights i ON i.id = it.insight_id WHERE i.project_id = $1)::int AS insights_with_themes,
      (SELECT COUNT(*) FROM recommendations WHERE project_id = $1)::int AS recommendation_count,
      (SELECT COUNT(DISTINCT recommendation_id) FROM recommendation_insights ri
        JOIN recommendations r ON r.id = ri.recommendation_id WHERE r.project_id = $1)::int AS recommendations_with_insights,
      (SELECT COUNT(*) FROM notes WHERE project_id = $1 AND interview_id IS NOT NULL)::int AS notes_linked_to_interview`,
    [projectId]
  )
  return r.rows[0]
}
