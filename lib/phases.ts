import type { Phase, PhaseStatus, ProjectCounts } from './types'

export const PHASES: Phase[] = ['interviews', 'notes', 'themes', 'insights', 'recommendations']

export const PHASE_LABELS: Record<Phase, string> = {
  interviews: 'Interviews',
  notes: 'Notes',
  themes: 'Themes',
  insights: 'Insights',
  recommendations: 'Recommendations',
  complete: 'Complete',
}

export const MIN_NOTES = 10
export const MIN_CLUSTER_PERCENT = 70

export function getPhaseStatus(currentPhase: Phase, phase: Phase): PhaseStatus {
  if (currentPhase === 'complete') return 'complete'
  const currentIndex = PHASES.indexOf(currentPhase)
  const phaseIndex = PHASES.indexOf(phase)
  if (phaseIndex < currentIndex) return 'complete'
  if (phaseIndex === currentIndex) return 'in_progress'
  return 'locked'
}

export function nextPhase(phase: Phase): Phase {
  const index = PHASES.indexOf(phase)
  if (index === -1 || index === PHASES.length - 1) return 'complete'
  return PHASES[index + 1]
}

export function canAdvancePhase(
  currentPhase: Phase,
  counts: ProjectCounts
): { canAdvance: boolean; blockers: string[] } {
  const blockers: string[] = []

  if (currentPhase === 'interviews') {
    if (counts.interview_count < 1)
      blockers.push('Add at least 1 interview')
  } else if (currentPhase === 'notes') {
    if (counts.note_count < MIN_NOTES)
      blockers.push(`Add at least ${MIN_NOTES} notes (${counts.note_count} so far)`)
    if (counts.notes_linked_to_interview < counts.note_count)
      blockers.push(`All notes must be linked to an interview (${counts.note_count - counts.notes_linked_to_interview} unlinked)`)
  } else if (currentPhase === 'themes') {
    if (counts.theme_count < 1)
      blockers.push('Create at least 1 theme')
    const pct = counts.note_count > 0
      ? Math.round((counts.clustered_note_count / counts.note_count) * 100)
      : 0
    if (pct < MIN_CLUSTER_PERCENT)
      blockers.push(`Cluster at least ${MIN_CLUSTER_PERCENT}% of notes into themes (${pct}% done)`)
  } else if (currentPhase === 'insights') {
    if (counts.insight_count < 1)
      blockers.push('Create at least 1 insight')
    if (counts.insights_with_themes < counts.insight_count)
      blockers.push('Every insight must be linked to at least 1 theme')
  } else if (currentPhase === 'recommendations') {
    if (counts.recommendation_count < 1)
      blockers.push('Create at least 1 recommendation')
    if (counts.recommendations_with_insights < counts.recommendation_count)
      blockers.push('Every recommendation must be linked to at least 1 insight')
  }

  return { canAdvance: blockers.length === 0, blockers }
}

export function getClusteringProgress(counts: ProjectCounts): number {
  if (counts.note_count === 0) return 0
  return Math.round((counts.clustered_note_count / counts.note_count) * 100)
}
