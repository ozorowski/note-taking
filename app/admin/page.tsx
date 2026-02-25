import { verifyAuth } from '@/lib/auth'
import { query } from '@/lib/db'
import { redirect } from 'next/navigation'
import AdminDashboard from './AdminDashboard'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

export default async function AdminPage() {
  const user = await verifyAuth()
  if (!user) redirect('/auth/login')
  if (!ADMIN_EMAIL || user.email !== ADMIN_EMAIL) redirect('/projects')

  const [totalsRes, userStatsRes, phaseRes, usersRes, projectsRes, signupsByDayRes] = await Promise.all([
    query<{
      projects: number; demo_projects: number; interviews: number
      notes: number; themes: number; insights: number; recommendations: number
    }>(`SELECT
      (SELECT COUNT(*) FROM projects WHERE demo = false)::int AS projects,
      (SELECT COUNT(*) FROM projects WHERE demo = true)::int  AS demo_projects,
      (SELECT COUNT(*) FROM interviews)::int                  AS interviews,
      (SELECT COUNT(*) FROM notes)::int                       AS notes,
      (SELECT COUNT(*) FROM themes)::int                      AS themes,
      (SELECT COUNT(*) FROM insights)::int                    AS insights,
      (SELECT COUNT(*) FROM recommendations)::int             AS recommendations`),

    query<{ real_users: number; guest_users: number; new_7d: number; new_30d: number }>(`SELECT
      COUNT(*) FILTER (WHERE is_guest IS DISTINCT FROM true)::int AS real_users,
      COUNT(*) FILTER (WHERE is_guest = true)::int                AS guest_users,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int  AS new_7d,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::int AS new_30d
    FROM users`),

    query<{ phase: string; count: number }>(`
      SELECT current_phase AS phase, COUNT(*)::int AS count
      FROM projects WHERE demo = false
      GROUP BY current_phase ORDER BY count DESC`),

    query<{ id: string; name: string; email: string; created_at: string }>(`
      SELECT id, name, email, created_at::text
      FROM users
      WHERE is_guest IS DISTINCT FROM true AND email IS NOT NULL
      ORDER BY created_at DESC`),

    query<{ id: string; title: string; current_phase: string; created_at: string; updated_at: string; member_count: number }>(`
      SELECT p.id, p.title, p.current_phase, p.created_at::text, p.updated_at::text,
        (SELECT COUNT(*) FROM project_memberships pm WHERE pm.project_id = p.id)::int AS member_count
      FROM projects p WHERE p.demo = false
      ORDER BY p.updated_at DESC`),

    query<{ day: string; count: number }>(`
      SELECT date_trunc('day', created_at)::date::text AS day, COUNT(*)::int AS count
      FROM users
      WHERE created_at > NOW() - INTERVAL '30 days'
        AND is_guest IS DISTINCT FROM true
      GROUP BY day ORDER BY day`),
  ])

  return (
    <AdminDashboard
      adminEmail={user.email!}
      userName={user.name}
      totals={totalsRes.rows[0]}
      userStats={userStatsRes.rows[0]}
      phases={phaseRes.rows}
      users={usersRes.rows}
      projects={projectsRes.rows}
      signupsByDay={signupsByDayRes.rows}
    />
  )
}
