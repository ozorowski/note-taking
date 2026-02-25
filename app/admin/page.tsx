import { verifyAuth } from '@/lib/auth'
import { query } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PHASE_LABELS } from '@/lib/phases'
import type { Phase } from '@/lib/types'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

export default async function AdminPage() {
  const user = await verifyAuth()
  if (!user) redirect('/auth/login')
  if (!ADMIN_EMAIL || user.email !== ADMIN_EMAIL) redirect('/projects')

  // ── Aggregate stats ───────────────────────────────────────────────────────
  const [totalsRes, userStatsRes, phaseRes, recentUsersRes, recentProjectsRes] = await Promise.all([
    query<{
      projects: string
      demo_projects: string
      interviews: string
      notes: string
      themes: string
      insights: string
      recommendations: string
    }>(`SELECT
      (SELECT COUNT(*) FROM projects WHERE demo = false)::int AS projects,
      (SELECT COUNT(*) FROM projects WHERE demo = true)::int  AS demo_projects,
      (SELECT COUNT(*) FROM interviews)::int                  AS interviews,
      (SELECT COUNT(*) FROM notes)::int                       AS notes,
      (SELECT COUNT(*) FROM themes)::int                      AS themes,
      (SELECT COUNT(*) FROM insights)::int                    AS insights,
      (SELECT COUNT(*) FROM recommendations)::int             AS recommendations`),

    query<{
      real_users: string
      guest_users: string
      new_7d: string
      new_30d: string
    }>(`SELECT
      COUNT(*) FILTER (WHERE is_guest IS DISTINCT FROM true)::int AS real_users,
      COUNT(*) FILTER (WHERE is_guest = true)::int                AS guest_users,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int  AS new_7d,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::int AS new_30d
    FROM users`),

    query<{ phase: string; count: string }>(`
      SELECT current_phase AS phase, COUNT(*)::int AS count
      FROM projects WHERE demo = false
      GROUP BY current_phase ORDER BY count DESC`),

    // All real (non-guest) signed-up users
    query<{ id: string; name: string; email: string; created_at: Date }>(`
      SELECT id, name, email, created_at
      FROM users
      WHERE is_guest IS DISTINCT FROM true AND email IS NOT NULL
      ORDER BY created_at DESC`),

    query<{ id: string; title: string; current_phase: string; created_at: Date; updated_at: Date; member_count: string }>(`
      SELECT p.id, p.title, p.current_phase, p.created_at, p.updated_at,
        (SELECT COUNT(*) FROM project_memberships pm WHERE pm.project_id = p.id)::int AS member_count
      FROM projects p WHERE p.demo = false
      ORDER BY p.updated_at DESC LIMIT 20`),
  ])

  const totals = totalsRes.rows[0]
  const userStats = userStatsRes.rows[0]
  const phases = phaseRes.rows
  const signedUpUsers = recentUsersRes.rows
  const recentProjects = recentProjectsRes.rows

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/projects" className="text-gray-400 hover:text-gray-600 text-sm">← Back</Link>
            <span className="text-gray-300">|</span>
            <span className="text-sm font-semibold text-gray-800">Admin</span>
          </div>
          <span className="text-xs text-gray-400">Logged in as {user.email}</span>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* ── Top stat cards ── */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Real users" value={userStats.real_users} sub={`+${userStats.new_7d} this week`} color="blue" />
            <StatCard label="Guest users" value={userStats.guest_users} color="gray" />
            <StatCard label="Projects" value={totals.projects} sub={`${totals.demo_projects} demo`} color="purple" />
            <StatCard label="Interviews" value={totals.interviews} color="gray" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <StatCard label="Notes" value={totals.notes} color="gray" />
            <StatCard label="Themes" value={totals.themes} color="gray" />
            <StatCard label="Insights" value={totals.insights} color="gray" />
            <StatCard label="Recommendations" value={totals.recommendations} color="gray" />
          </div>
        </section>

        {/* ── User growth ── */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">User growth</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-5 flex gap-8">
            <GrowthStat label="New last 7 days" value={userStats.new_7d} />
            <GrowthStat label="New last 30 days" value={userStats.new_30d} />
            <GrowthStat label="Total real accounts" value={userStats.real_users} />
            <GrowthStat label="Total guests" value={userStats.guest_users} />
          </div>
        </section>

        {/* ── Projects by phase ── */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Projects by phase</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            {phases.length === 0 ? (
              <p className="text-sm text-gray-400">No projects yet.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {phases.map(row => (
                  <div key={row.phase} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
                    <PhaseChip phase={row.phase as Phase} />
                    <span className="text-sm font-semibold text-gray-700">{row.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Signed-up users (full list) ── */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Signed-up users ({signedUpUsers.length})
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-400 font-normal">#</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-400 font-normal">Name</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-400 font-normal">Email</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-400 font-normal">Joined</th>
                </tr>
              </thead>
              <tbody>
                {signedUpUsers.map((u, i) => (
                  <tr key={u.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-2.5 text-gray-300 text-xs">{signedUpUsers.length - i}</td>
                    <td className="px-4 py-2.5 text-gray-800">{u.name}</td>
                    <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{formatDate(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Recent projects ── */}
        <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Recent projects</h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-400 font-normal">Title</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-400 font-normal">Phase</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-400 font-normal">Members</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-400 font-normal">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {recentProjects.map(p => (
                    <tr key={p.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-2.5">
                        <Link href={`/projects/${p.id}`} className="text-blue-600 hover:underline">{p.title}</Link>
                      </td>
                      <td className="px-4 py-2.5"><PhaseChip phase={p.current_phase as Phase} /></td>
                      <td className="px-4 py-2.5 text-gray-500">{p.member_count}</td>
                      <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{formatDate(p.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

      </main>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: 'blue' | 'purple' | 'gray' }) {
  const bg = color === 'blue' ? 'bg-blue-50 border-blue-100' : color === 'purple' ? 'bg-purple-50 border-purple-100' : 'bg-white border-gray-200'
  const num = color === 'blue' ? 'text-blue-700' : color === 'purple' ? 'text-purple-700' : 'text-gray-800'
  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${num}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function GrowthStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}

function PhaseChip({ phase }: { phase: Phase }) {
  const colors: Record<string, string> = {
    interviews: 'bg-slate-100 text-slate-600',
    capture:    'bg-sky-100 text-sky-700',
    notes:      'bg-blue-100 text-blue-700',
    themes:     'bg-purple-100 text-purple-700',
    insights:   'bg-green-100 text-green-700',
    recommendations: 'bg-orange-100 text-orange-700',
    complete:   'bg-emerald-100 text-emerald-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[phase] || 'bg-gray-100 text-gray-600'}`}>
      {PHASE_LABELS[phase] ?? phase}
    </span>
  )
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
