'use client'

import { useState, useEffect } from 'react'
import type { Interview } from '@/lib/types'

interface Props {
  interview: Interview
  onClose: () => void
  onRefresh: () => void
  onRequestDelete: () => void
}

export default function InterviewDrawer({ interview, onClose, onRefresh, onRequestDelete }: Props) {
  const [name, setName] = useState(interview.participant_name)
  const [rawNotes, setRawNotes] = useState(interview.raw_notes ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function save() {
    if (!name.trim() || saving) return
    setSaving(true)
    await fetch(`/api/interviews/${interview.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_name: name.trim(),
        raw_notes: rawNotes.trim() || null,
      }),
    })
    setSaving(false)
    onClose()
    onRefresh()
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-[480px] max-w-full bg-white shadow-xl flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="font-semibold text-gray-800">Interview</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Participant name */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Participant name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save() }}
              className="w-full text-sm text-gray-800 border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Raw notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Raw notes <span className="font-normal text-gray-300">(optional)</span>
            </label>
            <textarea
              value={rawNotes}
              onChange={e => setRawNotes(e.target.value)}
              placeholder="Paste a transcript or rough notes from the session..."
              rows={10}
              className="w-full text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </div>

          {/* Date */}
          <p className="text-xs text-gray-400">
            Added {new Date(interview.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>

          {/* Save / Cancel */}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={!name.trim() || saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>

          {/* Delete */}
          <div className="pt-4 border-t border-gray-100">
            <button
              onClick={onRequestDelete}
              className="text-sm text-red-400 hover:text-red-600 transition-colors"
            >
              Delete interview…
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
