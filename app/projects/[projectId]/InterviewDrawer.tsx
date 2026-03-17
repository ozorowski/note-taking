'use client'

import { useState, useEffect } from 'react'
import type { Interview } from '@/lib/types'

function fmt(d: string | Date) {
  const date = new Date(d)
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' · ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

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
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-gray-800">
              {interview.display_number ? `Interview ${interview.display_number}` : 'Interview'}
            </h2>
            <p className="text-[11px] text-gray-400 mt-1">
              {interview.creator_name && <>Created by <span className="font-medium">{interview.creator_name}</span> · </>}
              {fmt(interview.created_at)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none mt-0.5">
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

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Description <span className="font-normal text-gray-300">(optional)</span>
            </label>
            <textarea
              value={rawNotes}
              onChange={e => setRawNotes(e.target.value)}
              placeholder="e.g. role, context, or any notes about this participant..."
              rows={6}
              className="w-full text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </div>

          {/* Save / Cancel / Delete */}
          <div className="flex items-center gap-2">
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
            <button
              onClick={onRequestDelete}
              className="ml-auto px-4 py-2 text-sm text-red-400 hover:text-red-600 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
