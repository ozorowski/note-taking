'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { User, Phase } from '@/lib/types'
import { canAdvancePhase, nextPhase } from '@/lib/phases'
import PhaseNavBar from '@/components/PhaseNavBar'
import DemoProjectBanner from '@/components/DemoProjectBanner'
import LogoutButton from '@/components/LogoutButton'
import InterviewsPhase from './InterviewsPhase'
import NotesPhase from './NotesPhase'
import ThemesPhase from './ThemesPhase'
import InsightsPhase from './InsightsPhase'
import RecommendationsPhase from './RecommendationsPhase'

interface Props {
  projectId: string
  currentUser: User
}

export default function ProjectView({ projectId, currentUser }: Props) {
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [viewingPhase, setViewingPhase] = useState<Phase | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const [advanceError, setAdvanceError] = useState<string[]>([])

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
    return () => clearInterval(interval)
  }, [fetchProject])

  // Initialise viewing phase from project on first load
  useEffect(() => {
    if (project && viewingPhase === null) {
      const phase = project.current_phase === 'complete' ? 'recommendations' : project.current_phase
      setViewingPhase(phase as Phase)
    }
  }, [project, viewingPhase])

  async function advancePhase() {
    setAdvancing(true)
    setAdvanceError([])
    const res = await fetch(`/api/projects/${projectId}/advance`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      const newPhase = data.current_phase as Phase
      setViewingPhase(newPhase)
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
        viewingPhase={viewingPhase}
        onPhaseClick={setViewingPhase}
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

      {/* Completion banner */}
      {isComplete && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-3">
          <div className="max-w-6xl mx-auto">
            <p className="text-sm text-emerald-700 font-medium">
              🎉 Synthesis complete — all phases finished.
            </p>
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
        {viewingPhase === 'notes' && (
          <NotesPhase
            projectId={projectId}
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
      </div>
    </div>
  )
}
