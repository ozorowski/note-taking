'use client'

import { useState, useEffect } from 'react'
import type { Interview } from '@/lib/types'

type Action = 'disassociate' | 'reassign' | 'delete_notes'

interface Props {
  interview: Interview
  otherInterviews: Interview[]
  onConfirm: (action: Action, reassignToId?: string) => Promise<void>
  onCancel: () => void
}

export default function DeleteInterviewModal({ interview, otherInterviews, onConfirm, onCancel }: Props) {
  const [action, setAction] = useState<Action>('disassociate')
  const [reassignToId, setReassignToId] = useState(otherInterviews[0]?.id ?? '')
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  async function handleConfirm() {
    setConfirming(true)
    await onConfirm(action, action === 'reassign' ? reassignToId : undefined)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-5">
        {/* Header */}
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Delete &ldquo;{interview.participant_name}&rdquo;?
          </h2>
          <p className="text-sm text-red-500 mt-1 font-medium">This cannot be undone.</p>
        </div>

        {/* Options */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            What should happen to linked notes?
          </p>
          <div className="flex flex-col gap-2">
            {/* Disassociate */}
            <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
              action === 'disassociate' ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="radio"
                name="action"
                value="disassociate"
                checked={action === 'disassociate'}
                onChange={() => setAction('disassociate')}
                className="mt-0.5 accent-blue-600"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">Keep notes, remove interview link</p>
                <p className="text-xs text-gray-500 mt-0.5">Notes stay in the project but won&apos;t be linked to any interview.</p>
              </div>
            </label>

            {/* Reassign */}
            {otherInterviews.length > 0 && (
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                action === 'reassign' ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="action"
                  value="reassign"
                  checked={action === 'reassign'}
                  onChange={() => setAction('reassign')}
                  className="mt-0.5 accent-blue-600"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">Move notes to another interview</p>
                  <p className="text-xs text-gray-500 mt-0.5 mb-2">All linked notes will be reassigned.</p>
                  {action === 'reassign' && (
                    <select
                      value={reassignToId}
                      onChange={e => setReassignToId(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className="w-full text-sm px-2.5 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                    >
                      {otherInterviews.map(i => (
                        <option key={i.id} value={i.id}>{i.participant_name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </label>
            )}

            {/* Delete notes */}
            <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
              action === 'delete_notes' ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="radio"
                name="action"
                value="delete_notes"
                checked={action === 'delete_notes'}
                onChange={() => setAction('delete_notes')}
                className="mt-0.5 accent-red-600"
              />
              <div>
                <p className="text-sm font-medium text-red-700">Delete all linked notes permanently</p>
                <p className="text-xs text-red-400 mt-0.5">Notes will be gone forever. This cannot be undone.</p>
              </div>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={confirming}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming || (action === 'reassign' && !reassignToId)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-40 transition-colors"
          >
            {confirming ? 'Deleting…' : 'Delete interview'}
          </button>
        </div>
      </div>
    </div>
  )
}
