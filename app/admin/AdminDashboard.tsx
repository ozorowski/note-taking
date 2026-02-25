'use client'

import { useState } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────

interface Totals {
  projects: number; demo_projects: number; interviews: number
  notes: number; themes: number; insights: number; recommendations: number
}
interface UserStats { real_users: number; guest_users: number; new_7d: number; new_30d: number }
interface PhaseRow { phase: string; count: number }
interface UserRow { id: string; name: string; email: string; created_at: string }
interface ProjectRow { id: string; title: string; current_phase: string; created_at: string; updated_at: string; member_count: number }
interface DayRow { day: string; count: number }

interface Props {
  adminEmail: string
  totals: Totals
  userStats: UserStats
  phases: PhaseRow[]
  users: UserRow[]
  projects: ProjectRow[]
  signupsByDay: DayRow[]
}

type Tab = 'overview' | 'users' | 'projects' | 'architecture'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',     label: 'Overview' },
  { id: 'users',        label: 'Users' },
  { id: 'projects',     label: 'Projects' },
  { id: 'architecture', label: 'Architecture' },
]

// ── Phase colours ──────────────────────────────────────────────────────────

const PHASE_META: Record<string, { label: string; chip: string; bar: string }> = {
  interviews:      { label: 'Interviews',      chip: 'bg-slate-100 text-slate-600',    bar: 'bg-slate-400' },
  capture:         { label: 'Capture',         chip: 'bg-sky-100 text-sky-700',        bar: 'bg-sky-400' },
  notes:           { label: 'Notes',           chip: 'bg-blue-100 text-blue-700',      bar: 'bg-blue-400' },
  themes:          { label: 'Themes',          chip: 'bg-purple-100 text-purple-700',  bar: 'bg-purple-400' },
  insights:        { label: 'Insights',        chip: 'bg-green-100 text-green-700',    bar: 'bg-green-400' },
  recommendations: { label: 'Recommendations', chip: 'bg-orange-100 text-orange-700',  bar: 'bg-orange-400' },
  complete:        { label: 'Complete',        chip: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-400' },
}

function PhaseChip({ phase }: { phase: string }) {
  const m = PHASE_META[phase]
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m?.chip ?? 'bg-gray-100 text-gray-500'}`}>
      {m?.label ?? phase}
    </span>
  )
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Root component ─────────────────────────────────────────────────────────

export default function AdminDashboard({ adminEmail, totals, userStats, phases, users, projects, signupsByDay }: Props) {
  const [tab, setTab] = useState<Tab>('overview')

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
          <span className="text-xs text-gray-400">{adminEmail}</span>
        </div>
      </nav>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {tab === 'overview'     && <OverviewTab totals={totals} userStats={userStats} phases={phases} signupsByDay={signupsByDay} />}
        {tab === 'users'        && <UsersTab users={users} userStats={userStats} />}
        {tab === 'projects'     && <ProjectsTab projects={projects} phases={phases} />}
        {tab === 'architecture' && <ArchitectureTab totals={totals} />}
      </main>
    </div>
  )
}

// ── Overview tab ───────────────────────────────────────────────────────────

function OverviewTab({ totals, userStats, phases, signupsByDay }: {
  totals: Totals; userStats: UserStats; phases: PhaseRow[]; signupsByDay: DayRow[]
}) {
  const totalProjects = phases.reduce((s, p) => s + p.count, 0)
  const maxPhaseCount = Math.max(...phases.map(p => p.count), 1)

  // Build 30-day spark data (fill missing days with 0)
  const today = new Date()
  const sparkDays: { label: string; count: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const found = signupsByDay.find(r => r.day === key)
    sparkDays.push({ label: key.slice(5), count: found?.count ?? 0 })
  }
  const maxSpark = Math.max(...sparkDays.map(d => d.count), 1)

  return (
    <div className="space-y-6">
      {/* Stat grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <BigStat label="Real users"    value={userStats.real_users}    sub={`+${userStats.new_7d} this week`} accent="blue" />
        <BigStat label="Guest sessions" value={userStats.guest_users}  accent="gray" />
        <BigStat label="Active projects" value={totals.projects}       sub={`+${totals.demo_projects} demo`} accent="purple" />
        <BigStat label="Interviews"     value={totals.interviews}      accent="gray" />
        <BigStat label="Notes"          value={totals.notes}           accent="gray" />
        <BigStat label="Themes"         value={totals.themes}          accent="gray" />
        <BigStat label="Insights"       value={totals.insights}        accent="gray" />
        <BigStat label="Recommendations" value={totals.recommendations} accent="gray" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* New signups sparkline */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">New sign-ups — last 30 days</p>
          <div className="flex items-end gap-0.5 h-16 mt-3">
            {sparkDays.map(d => (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div
                  className="w-full rounded-sm bg-blue-400 group-hover:bg-blue-500 transition-colors"
                  style={{ height: `${Math.max(2, (d.count / maxSpark) * 56)}px` }}
                />
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                  {d.label}: {d.count}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-gray-300">
            <span>30 days ago</span><span>today</span>
          </div>
          <div className="flex gap-6 mt-4 pt-4 border-t border-gray-100">
            <div><p className="text-2xl font-bold text-gray-800">{userStats.new_7d}</p><p className="text-xs text-gray-400">Last 7 days</p></div>
            <div><p className="text-2xl font-bold text-gray-800">{userStats.new_30d}</p><p className="text-xs text-gray-400">Last 30 days</p></div>
            <div><p className="text-2xl font-bold text-gray-800">{userStats.real_users}</p><p className="text-xs text-gray-400">Total accounts</p></div>
          </div>
        </div>

        {/* Projects by phase bar chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Projects by phase</p>
          {totalProjects === 0 ? (
            <p className="text-sm text-gray-400">No projects yet.</p>
          ) : (
            <div className="space-y-3">
              {phases.map(row => {
                const pct = Math.round((row.count / totalProjects) * 100)
                const m = PHASE_META[row.phase]
                return (
                  <div key={row.phase}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600">{m?.label ?? row.phase}</span>
                      <span className="text-xs font-semibold text-gray-700">{row.count} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${m?.bar ?? 'bg-gray-400'}`} style={{ width: `${(row.count / maxPhaseCount) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Users tab ──────────────────────────────────────────────────────────────

function UsersTab({ users, userStats }: { users: UserRow[]; userStats: UserStats }) {
  const [search, setSearch] = useState('')
  const filtered = search
    ? users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
    : users

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <div className="text-center"><p className="text-2xl font-bold text-blue-600">{userStats.real_users}</p><p className="text-xs text-gray-400">Total accounts</p></div>
          <div className="text-center"><p className="text-2xl font-bold text-gray-700">{userStats.new_7d}</p><p className="text-xs text-gray-400">This week</p></div>
          <div className="text-center"><p className="text-2xl font-bold text-gray-700">{userStats.new_30d}</p><p className="text-xs text-gray-400">This month</p></div>
        </div>
        <input
          type="text"
          placeholder="Search name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 w-56"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              <th className="px-4 py-3 text-xs text-gray-400 font-medium">#</th>
              <th className="px-4 py-3 text-xs text-gray-400 font-medium">Name</th>
              <th className="px-4 py-3 text-xs text-gray-400 font-medium">Email</th>
              <th className="px-4 py-3 text-xs text-gray-400 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => (
              <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2.5 text-gray-300 text-xs">{users.length - users.indexOf(u)}</td>
                <td className="px-4 py-2.5 text-gray-800 font-medium">{u.name}</td>
                <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{u.email}</td>
                <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap text-xs">{fmt(u.created_at)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">No results for &quot;{search}&quot;</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {search && <p className="text-xs text-gray-400">{filtered.length} of {users.length} users</p>}
    </div>
  )
}

// ── Projects tab ───────────────────────────────────────────────────────────

function ProjectsTab({ projects, phases }: { projects: ProjectRow[]; phases: PhaseRow[] }) {
  const [phaseFilter, setPhaseFilter] = useState('all')
  const filtered = phaseFilter === 'all' ? projects : projects.filter(p => p.current_phase === phaseFilter)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setPhaseFilter('all')}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${phaseFilter === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}
        >
          All ({projects.length})
        </button>
        {phases.map(row => (
          <button
            key={row.phase}
            onClick={() => setPhaseFilter(row.phase)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${phaseFilter === row.phase ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}
          >
            {PHASE_META[row.phase]?.label ?? row.phase} ({row.count})
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              <th className="px-4 py-3 text-xs text-gray-400 font-medium">Title</th>
              <th className="px-4 py-3 text-xs text-gray-400 font-medium">Phase</th>
              <th className="px-4 py-3 text-xs text-gray-400 font-medium">Members</th>
              <th className="px-4 py-3 text-xs text-gray-400 font-medium">Created</th>
              <th className="px-4 py-3 text-xs text-gray-400 font-medium">Last active</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2.5">
                  <Link href={`/projects/${p.id}`} className="text-blue-600 hover:underline font-medium">{p.title}</Link>
                </td>
                <td className="px-4 py-2.5"><PhaseChip phase={p.current_phase} /></td>
                <td className="px-4 py-2.5 text-gray-500">{p.member_count}</td>
                <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap text-xs">{fmt(p.created_at)}</td>
                <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap text-xs">{fmt(p.updated_at)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">No projects in this phase.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Architecture tab ───────────────────────────────────────────────────────

function ArchitectureTab({ totals }: { totals: Totals }) {
  return (
    <div className="space-y-8">

      {/* HLD diagram */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">High-level architecture</p>
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">

          {/* Browser layer */}
          <ArchLayer color="blue" title="Browser — Client" subtitle="User's device">
            <ArchBox label="Next.js App Router" detail="React server + client components, Tailwind CSS" color="blue" />
            <ArchBox label="Pusher JS Client" detail="Real-time subscriptions, falls back to 15s polling" color="blue" />
          </ArchLayer>

          {/* Arrow down */}
          <ArchArrow label="HTTPS / WebSocket" />

          {/* Server layer */}
          <ArchLayer color="purple" title="Render.com — Server" subtitle="Node.js · Next.js 15">
            <ArchBox label="Server Components" detail="Page rendering, DB queries at request time" color="purple" />
            <ArchBox label="API Routes /api/*" detail="REST endpoints, JSON, auth middleware" color="purple" />
            <ArchBox label="JWT Auth" detail="httpOnly cookie · 30d expiry · magic link + guest" color="purple" />
            <ArchBox label="AI Routes" detail="Groq → Gemini → OpenAI (fallback chain)" color="purple" />
          </ArchLayer>

          {/* Arrow down */}
          <ArchArrow label="pg (PostgreSQL driver) · Pusher SDK · Resend SDK · HTTP" />

          {/* Data / services layer */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ServiceBox
              title="PostgreSQL"
              badge="Render DB"
              color="emerald"
              items={['users', 'projects', 'interviews', 'notes', 'themes', 'insights', 'recommendations']}
            />
            <ServiceBox
              title="Pusher Channels"
              badge="eu cluster"
              color="sky"
              items={['Broadcast on any write', 'project:{id} channel', 'Client subscriptions']}
            />
            <ServiceBox
              title="AI APIs"
              badge="3-tier fallback"
              color="orange"
              items={['Groq (primary)', 'Gemini (fallback)', 'OpenAI (tertiary)', 'Prompts: insight, theme, rec, summary']}
            />
            <ServiceBox
              title="Resend"
              badge="Email"
              color="rose"
              items={['Magic link auth', '15-min tokens', 'onboarding@resend.dev (dev)']}
            />
          </div>
        </div>
      </div>

      {/* Research phase flow */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Research phase flow</p>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-1 flex-wrap">
            {['interviews', 'capture', 'notes', 'themes', 'insights', 'recommendations', 'complete'].map((phase, i, arr) => (
              <div key={phase} className="flex items-center gap-1">
                <div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${PHASE_META[phase]?.chip ?? 'bg-gray-100 text-gray-500'}`}>
                  {PHASE_META[phase]?.label ?? phase}
                </div>
                {i < arr.length - 1 && <span className="text-gray-300 text-sm">→</span>}
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-gray-500">
            <div className="p-3 bg-gray-50 rounded-lg"><span className="font-medium text-gray-700">Interviews</span> — Add research participants. Gate: ≥1 interview to advance.</div>
            <div className="p-3 bg-gray-50 rounded-lg"><span className="font-medium text-gray-700">Capture</span> — Private note-taking per interview. Evidence types: Quote / Observation / Pain Point / Need.</div>
            <div className="p-3 bg-gray-50 rounded-lg"><span className="font-medium text-gray-700">Notes</span> — Share captured notes with the team. Gate: all notes must be shared before advancing.</div>
            <div className="p-3 bg-gray-50 rounded-lg"><span className="font-medium text-gray-700">Themes</span> — AI-assisted clustering of notes into themes. Gate: ≥1 theme, all notes clustered.</div>
            <div className="p-3 bg-gray-50 rounded-lg"><span className="font-medium text-gray-700">Insights</span> — Synthesise themes into insights. Gate: ≥1 insight, all linked to themes.</div>
            <div className="p-3 bg-gray-50 rounded-lg"><span className="font-medium text-gray-700">Recommendations</span> — Action items linked to insights. Gate: ≥1 recommendation linked to insight.</div>
          </div>
        </div>
      </div>

      {/* Tech stack */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Tech stack</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { cat: 'Framework',    items: ['Next.js 15 (App Router)', 'React 18', 'TypeScript'] },
            { cat: 'Styling',      items: ['Tailwind CSS', 'IBM Plex Mono (capture font)'] },
            { cat: 'Database',     items: ['PostgreSQL (Render)', 'pg driver', 'Raw SQL (no ORM)'] },
            { cat: 'Auth',         items: ['JWT (30d)', 'httpOnly cookie', 'Magic link via Resend', 'Guest (name-only)'] },
            { cat: 'Real-time',    items: ['Pusher Channels (eu)', '15s polling fallback'] },
            { cat: 'AI',           items: ['Groq llama-3.3-70b', 'Gemini 2.0 Flash', 'OpenAI (tertiary)'] },
            { cat: 'Email',        items: ['Resend', 'Magic link auth flow'] },
            { cat: 'Deployment',   items: ['Render.com (web service)', 'Render Managed Postgres', 'Auto-migrate on deploy'] },
          ].map(({ cat, items }) => (
            <div key={cat} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">{cat}</p>
              <ul className="space-y-1">
                {items.map(item => (
                  <li key={item} className="text-xs text-gray-600 flex items-start gap-1.5">
                    <span className="text-gray-300 mt-0.5">·</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* DB schema summary */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Database schema</p>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
            {[
              { table: 'users', cols: ['id', 'name', 'email?', 'password_hash?', 'is_guest', 'created_at'] },
              { table: 'magic_link_tokens', cols: ['id', 'email', 'token', 'expires_at', 'used_at'] },
              { table: 'projects', cols: ['id', 'title', 'description?', 'current_phase', 'owner_id', 'demo', 'executive_summary?'] },
              { table: 'project_memberships', cols: ['id', 'project_id', 'user_id', 'role'] },
              { table: 'project_invites', cols: ['id', 'project_id', 'token', 'role', 'expires_at'] },
              { table: 'interviews', cols: ['id', 'project_id', 'participant_name', 'raw_notes?', 'created_by'] },
              { table: 'notes', cols: ['id', 'project_id', 'interview_id?', 'content', 'evidence_type?', 'visibility', 'created_by'] },
              { table: 'note_themes', cols: ['note_id', 'theme_id'] },
              { table: 'themes', cols: ['id', 'project_id', 'title', 'description?', 'created_by'] },
              { table: 'insights', cols: ['id', 'project_id', 'content', 'evidence_summary?', 'created_by'] },
              { table: 'insight_themes', cols: ['insight_id', 'theme_id'] },
              { table: 'recommendations', cols: ['id', 'project_id', 'content', 'rationale?', 'created_by'] },
              { table: 'recommendation_insights', cols: ['recommendation_id', 'insight_id'] },
              { table: 'project_activity', cols: ['id', 'project_id', 'user_id?', 'action', 'entity_type?', 'entity_id?'] },
            ].map(({ table, cols }) => (
              <div key={table} className="bg-gray-50 rounded-lg p-3">
                <p className="font-semibold text-gray-700 font-mono mb-2">{table}</p>
                <ul className="space-y-0.5">
                  {cols.map(c => (
                    <li key={c} className="text-gray-500 font-mono text-[11px]">{c}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}

// ── Architecture sub-components ────────────────────────────────────────────

function ArchLayer({ color, title, subtitle, children }: {
  color: 'blue' | 'purple'; title: string; subtitle: string; children: React.ReactNode
}) {
  const border = color === 'blue' ? 'border-blue-200 bg-blue-50/50' : 'border-purple-200 bg-purple-50/50'
  const label  = color === 'blue' ? 'text-blue-700' : 'text-purple-700'
  return (
    <div className={`rounded-xl border-2 p-4 ${border}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs font-semibold ${label}`}>{title}</span>
        <span className="text-xs text-gray-400">{subtitle}</span>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function ArchBox({ label, detail, color }: { label: string; detail: string; color: 'blue' | 'purple' }) {
  const bg = color === 'blue' ? 'bg-white border-blue-200' : 'bg-white border-purple-200'
  return (
    <div className={`border rounded-lg px-3 py-2 ${bg}`}>
      <p className="text-xs font-semibold text-gray-700">{label}</p>
      <p className="text-[11px] text-gray-400 mt-0.5">{detail}</p>
    </div>
  )
}

function ArchArrow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-1 pl-4">
      <div className="flex flex-col items-center">
        <div className="w-px h-3 bg-gray-300" />
        <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-gray-300" />
      </div>
      <span className="text-[11px] text-gray-400">{label}</span>
    </div>
  )
}

function ServiceBox({ title, badge, color, items }: {
  title: string; badge: string; color: 'emerald' | 'sky' | 'orange' | 'rose'; items: string[]
}) {
  const colors: Record<string, string> = {
    emerald: 'border-emerald-200 bg-emerald-50/50',
    sky:     'border-sky-200 bg-sky-50/50',
    orange:  'border-orange-200 bg-orange-50/50',
    rose:    'border-rose-200 bg-rose-50/50',
  }
  const badgeColors: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-700',
    sky:     'bg-sky-100 text-sky-700',
    orange:  'bg-orange-100 text-orange-700',
    rose:    'bg-rose-100 text-rose-700',
  }
  return (
    <div className={`border-2 rounded-xl p-4 ${colors[color]}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-xs font-semibold text-gray-700">{title}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badgeColors[color]}`}>{badge}</span>
      </div>
      <ul className="space-y-1">
        {items.map(item => (
          <li key={item} className="text-[11px] text-gray-500 flex items-start gap-1">
            <span className="text-gray-300 mt-0.5">·</span>{item}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── BigStat ────────────────────────────────────────────────────────────────

function BigStat({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent: 'blue' | 'purple' | 'gray' }) {
  const bg  = accent === 'blue' ? 'bg-blue-50 border-blue-100' : accent === 'purple' ? 'bg-purple-50 border-purple-100' : 'bg-white border-gray-200'
  const num = accent === 'blue' ? 'text-blue-700' : accent === 'purple' ? 'text-purple-700' : 'text-gray-800'
  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${num}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}
