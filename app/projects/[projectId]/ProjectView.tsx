'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { User, Phase } from '@/lib/types'
import { canAdvancePhase, nextPhase } from '@/lib/phases'
import { subscribeToProject } from '@/lib/pusher-client'
import PhaseNavBar from '@/components/PhaseNavBar'
import DemoProjectBanner from '@/components/DemoProjectBanner'
import LogoutButton from '@/components/LogoutButton'
import InterviewsPhase from './InterviewsPhase'
import CapturePhase from './CapturePhase'
import NotesPhase from './NotesPhase'
import ThemesPhase from './ThemesPhase'
import InsightsPhase from './InsightsPhase'
import RecommendationsPhase from './RecommendationsPhase'
import ReportView from './ReportView'

interface Props {
  projectId: string
  currentUser: User
}

export default function ProjectView({ projectId, currentUser }: Props) {
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [viewingPhase, setViewingPhase] = useState<Phase | 'report' | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const [advanceError, setAdvanceError] = useState<string[]>([])
  const [showMembersModal, setShowMembersModal] = useState(false)

  const fetchProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`)
    if (res.ok) {
      const data = await res.json()
      setProject(data)
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    fetchProject()
    const interval = setInterval(fetchProject, 15000)
    const unsubscribe = subscribeToProject(projectId, fetchProject)
    return () => {
      clearInterval(interval)
      unsubscribe()
    }
  }, [fetchProject, projectId])

  // Initialise viewing phase from project on first load
  useEffect(() => {
    if (project && viewingPhase === null) {
      const phase = project.current_phase === 'complete' ? 'report' : project.current_phase
      setViewingPhase(phase as Phase | 'report')
    }
  }, [project, viewingPhase])

  async function advancePhase() {
    setAdvancing(true)
    setAdvanceError([])
    const res = await fetch(`/api/projects/${projectId}/advance`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      const newPhase = data.current_phase as Phase
      setViewingPhase(newPhase === 'complete' ? 'report' : newPhase)
      await fetchProject()
    } else {
      setAdvanceError(data.blockers || [data.error || 'Failed to advance phase'])
    }
    setAdvancing(false)
  }

  if (loading || !project || !viewingPhase) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading project...</p>
      </div>
    )
  }

  const isOwner = project.role === 'owner'
  const isEditor = project.role === 'owner' || project.role === 'editor'
  const currentPhase: Phase = project.current_phase
  const isComplete = currentPhase === 'complete'

  // Can the current phase be advanced?
  const { canAdvance, blockers } = isComplete
    ? { canAdvance: false, blockers: [] }
    : canAdvancePhase(currentPhase, project.counts)

  const showAdvanceButton =
    isOwner &&
    !isComplete &&
    viewingPhase === currentPhase

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top nav */}
      <nav className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/projects" className="text-sm text-gray-400 hover:text-gray-600 flex-shrink-0">
              ← Projects
            </Link>
            <span className="text-gray-200">/</span>
            <h1 className="font-semibold text-gray-800 truncate">{project.title}</h1>
            {project.demo && (
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full flex-shrink-0">
                demo
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Member avatars */}
            <button
              onClick={() => setShowMembersModal(true)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
              title="Members"
            >
              <div className="flex -space-x-1.5">
                {project.members.slice(0, 4).map((m: any) => (
                  <div
                    key={m.id}
                    className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center ring-2 ring-white"
                    title={m.name}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
              {project.members.length > 4 && (
                <span className="text-xs text-gray-400">+{project.members.length - 4}</span>
              )}
            </button>
            <span className="text-sm text-gray-500 hidden sm:block">{currentUser.name}</span>
            <LogoutButton />
          </div>
        </div>
      </nav>

      {/* Demo banner */}
      {project.demo && <DemoProjectBanner />}

      {/* Phase nav */}
      <PhaseNavBar
        currentPhase={currentPhase}
        viewingPhase={viewingPhase ?? currentPhase}
        onPhaseClick={setViewingPhase}
        showReport={isComplete}
        onReportClick={() => setViewingPhase('report')}
      />

      {/* Advance section */}
      {showAdvanceButton && (
        <div className="bg-white border-b border-gray-100 px-6 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            {advanceError.length > 0 ? (
              <ul className="text-sm text-red-600 space-y-0.5 flex-1">
                {advanceError.map((e, i) => (
                  <li key={i}>• {e}</li>
                ))}
              </ul>
            ) : (
              <div className="flex-1">
                {canAdvance ? (
                  <p className="text-sm text-green-600 font-medium">
                    ✓ All criteria met — ready to proceed
                  </p>
                ) : (
                  <ul className="text-sm text-gray-500 space-y-0.5">
                    {blockers.map((b, i) => (
                      <li key={i} className="text-amber-600">• {b}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <button
              onClick={advancePhase}
              disabled={advancing || !canAdvance}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 flex-shrink-0"
            >
              {advancing
                ? 'Advancing...'
                : `Proceed to ${nextPhase(currentPhase) === 'complete' ? 'synthesis complete' : nextPhase(currentPhase)} →`}
            </button>
          </div>
        </div>
      )}

      {/* Completion banner — shown on non-report phases when complete */}
      {isComplete && viewingPhase !== 'report' && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <p className="text-sm text-emerald-700 font-medium">
              Synthesis complete — all phases finished.
            </p>
            <button
              onClick={() => setViewingPhase('report')}
              className="text-sm text-emerald-700 font-medium underline hover:no-underline flex-shrink-0"
            >
              View Research Summary →
            </button>
          </div>
        </div>
      )}

      {/* Phase content */}
      <div className="flex-1 overflow-auto">
        {viewingPhase === 'interviews' && (
          <InterviewsPhase
            projectId={projectId}
            interviews={project.interviews}
            isEditor={isEditor}
            onRefresh={fetchProject}
          />
        )}
        {viewingPhase === 'capture' && (
          <CapturePhase
            projectId={projectId}
            currentUserId={currentUser.id}
            interviews={project.interviews}
            notes={project.notes}
            isEditor={isEditor}
            onRefresh={fetchProject}
          />
        )}
        {viewingPhase === 'notes' && (
          <NotesPhase
            currentUserId={currentUser.id}
            notes={project.notes}
            interviews={project.interviews}
            isEditor={isEditor}
            onRefresh={fetchProject}
          />
        )}
        {viewingPhase === 'themes' && (
          <ThemesPhase
            projectId={projectId}
            notes={project.notes}
            themes={project.themes}
            counts={project.counts}
            isEditor={isEditor}
            onRefresh={fetchProject}
          />
        )}
        {viewingPhase === 'insights' && (
          <InsightsPhase
            projectId={projectId}
            insights={project.insights}
            themes={project.themes}
            notes={project.notes}
            isEditor={isEditor}
            onRefresh={fetchProject}
          />
        )}
        {viewingPhase === 'recommendations' && (
          <RecommendationsPhase
            projectId={projectId}
            recommendations={project.recommendations}
            insights={project.insights}
            themes={project.themes}
            notes={project.notes}
            isEditor={isEditor}
            onRefresh={fetchProject}
          />
        )}
        {viewingPhase === 'report' && (
          <ReportView
            project={project}
            isEditor={isEditor}
            onRefresh={fetchProject}
          />
        )}
      </div>

      {/* Members modal */}
      {showMembersModal && (
        <MembersModal
          projectId={projectId}
          members={project.members}
          isOwner={isOwner}
          isEditor={isEditor}
          currentUserId={currentUser.id}
          onClose={() => setShowMembersModal(false)}
          onRefresh={fetchProject}
        />
      )}
    </div>
  )
}

// ── Members modal ────────────────────────────────────────────────────────────

interface MembersModalProps {
  projectId: string
  members: any[]
  isOwner: boolean
  isEditor: boolean
  currentUserId: string
  onClose: () => void
  onRefresh: () => void
}

function MembersModal({ projectId, members, isOwner, isEditor, currentUserId, onClose, onRefresh }: MembersModalProps) {
  const [tab, setTab] = useState<'email' | 'link'>('email')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [linkRole, setLinkRole] = useState<'editor' | 'viewer'>('editor')
  const [inviteError, setInviteError] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [generatedLink, setGeneratedLink] = useState('')
  const [linkLoading, setLinkLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  async function inviteByEmail(e: React.FormEvent) {
    e.preventDefault()
    setInviteError('')
    setInviteSuccess('')
    setInviteLoading(true)
    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, roleToAssign: role }),
    })
    const data = await res.json()
    if (res.ok) {
      setInviteSuccess(`${data.name} added as ${role}`)
      setEmail('')
      onRefresh()
    } else {
      setInviteError(data.error || 'Failed to add member')
    }
    setInviteLoading(false)
  }

  async function generateLink() {
    setLinkLoading(true)
    setGeneratedLink('')
    const res = await fetch(`/api/projects/${projectId}/invite-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: linkRole }),
    })
    const data = await res.json()
    if (res.ok) setGeneratedLink(data.url)
    setLinkLoading(false)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(generatedLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function removeMember(userId: string) {
    setRemovingId(userId)
    await fetch(`/api/projects/${projectId}/members?userId=${userId}`, { method: 'DELETE' })
    onRefresh()
    setRemovingId(null)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Members</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Current members */}
        <div className="px-6 py-3 border-b border-gray-100 max-h-40 overflow-y-auto">
          {members.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-gray-800">{m.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 capitalize">{m.role}</span>
                {isOwner && m.id !== currentUserId && (
                  <button
                    onClick={() => removeMember(m.id)}
                    disabled={removingId === m.id}
                    className="text-gray-300 hover:text-red-400 text-sm leading-none disabled:opacity-50"
                    title="Remove"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Invite tabs — only for owner/editor */}
        {isEditor && (
          <>
            <div className="flex border-b border-gray-200 px-6">
              <button
                onClick={() => setTab('email')}
                className={`py-3 text-sm font-medium border-b-2 mr-4 transition-colors ${tab === 'email' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Invite by email
              </button>
              <button
                onClick={() => setTab('link')}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'link' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Shareable link
              </button>
            </div>

            <div className="px-6 py-4">
              {tab === 'email' ? (
                <form onSubmit={inviteByEmail} className="space-y-3">
                  {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
                  {inviteSuccess && <p className="text-sm text-green-600">{inviteSuccess}</p>}
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="colleague@example.com"
                      required
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={role}
                      onChange={e => setRole(e.target.value as 'editor' | 'viewer')}
                      className="px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none"
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={inviteLoading}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {inviteLoading ? 'Adding...' : 'Add member'}
                  </button>
                  <p className="text-xs text-gray-400">They need a Trace account first — share the sign-in link if needed.</p>
                </form>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <select
                      value={linkRole}
                      onChange={e => setLinkRole(e.target.value as 'editor' | 'viewer')}
                      className="px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none"
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      onClick={generateLink}
                      disabled={linkLoading}
                      className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {linkLoading ? 'Generating...' : 'Generate link'}
                    </button>
                  </div>
                  {generatedLink && (
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={generatedLink}
                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none"
                      />
                      <button
                        onClick={copyLink}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                      >
                        {copied ? '✓' : 'Copy'}
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-gray-400">Anyone with this link can join as {linkRole}. Expires in 7 days.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
