import { verifyAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { query } from '@/lib/db'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import { PHASE_LABELS } from '@/lib/phases'
import type { Phase } from '@/lib/types'

export default async function ProjectsPage() {
  const user = await verifyAuth()
  if (!user) redirect('/auth/login')

  const result = await query(
    `SELECT p.*, pm.role FROM projects p
     JOIN project_memberships pm ON pm.project_id = p.id AND pm.user_id = $1
     ORDER BY p.updated_at DESC`,
    [user.id]
  )
  const projects = result.rows

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight">Trace</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{user.name}</span>
            <LogoutButton />
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Your projects</h1>
            <p className="text-gray-500 text-sm mt-1">Research synthesis workspace</p>
          </div>
          <Link
            href="/projects/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + New project
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <div className="text-4xl mb-4">🔬</div>
            <h2 className="text-lg font-semibold mb-2">No projects yet</h2>
            <p className="text-gray-500 text-sm mb-6">Start with a blank project or load the demo to see how Trace works.</p>
            <Link href="/projects/new" className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              Create your first project
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 leading-tight">{p.title}</h3>
                  {p.demo && (
                    <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full flex-shrink-0">demo</span>
                  )}
                </div>
                {p.description && <p className="text-sm text-gray-500 mb-4 line-clamp-2">{p.description}</p>}
                <div className="flex items-center justify-between">
                  <PhaseChip phase={p.current_phase} />
                  <span className="text-xs text-gray-400 capitalize">{p.role}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function PhaseChip({ phase }: { phase: Phase }) {
  const colors: Record<string, string> = {
    interviews: 'bg-slate-100 text-slate-600',
    notes: 'bg-blue-100 text-blue-700',
    themes: 'bg-purple-100 text-purple-700',
    insights: 'bg-green-100 text-green-700',
    recommendations: 'bg-orange-100 text-orange-700',
    complete: 'bg-emerald-100 text-emerald-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[phase] || 'bg-gray-100 text-gray-600'}`}>
      {PHASE_LABELS[phase]}
    </span>
  )
}
