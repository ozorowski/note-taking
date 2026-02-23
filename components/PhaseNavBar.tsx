'use client'

import { PHASES, PHASE_LABELS, getPhaseStatus } from '@/lib/phases'
import type { Phase } from '@/lib/types'

interface Props {
  currentPhase: Phase
  viewingPhase: Phase
  onPhaseClick: (phase: Phase) => void
}

export default function PhaseNavBar({ currentPhase, viewingPhase, onPhaseClick }: Props) {
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex overflow-x-auto">
          {PHASES.map((phase, i) => {
            const status = getPhaseStatus(currentPhase, phase)
            const isViewing = viewingPhase === phase
            const isClickable = status !== 'locked'

            return (
              <button
                key={phase}
                onClick={() => isClickable && onPhaseClick(phase)}
                disabled={!isClickable}
                className={[
                  'flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
                  isViewing ? 'border-blue-500 text-blue-600' : 'border-transparent',
                  isClickable && !isViewing ? 'text-gray-500 hover:text-gray-800 cursor-pointer' : '',
                  !isClickable ? 'text-gray-300 cursor-default' : '',
                ].join(' ')}
              >
                {i > 0 && <span className="text-gray-200 -ml-1 mr-1">›</span>}
                <span
                  className={[
                    'w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0',
                    status === 'complete' ? 'bg-green-500 text-white' : '',
                    status === 'in_progress' ? 'bg-blue-500 text-white' : '',
                    status === 'locked' ? 'bg-gray-100 text-gray-300' : '',
                  ].join(' ')}
                >
                  {status === 'complete' && '✓'}
                  {status === 'in_progress' && '●'}
                  {status === 'locked' && '○'}
                </span>
                {PHASE_LABELS[phase]}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
