'use client'

import { useState, useEffect, useRef } from 'react'
import type { Note, Interview } from '@/lib/types'

type EvidenceType = 'quote' | 'observation' | 'pain_point' | 'need'

const EVIDENCE_TYPES: { type: EvidenceType; label: string; color: string; activeColor: string }[] = [
  { type: 'quote', label: 'Quote', color: 'border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100', activeColor: 'bg-blue-500 text-white border-blue-500' },
  { type: 'observation', label: 'Observation', color: 'border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100', activeColor: 'bg-purple-500 text-white border-purple-500' },
  { type: 'pain_point', label: 'Pain Point', color: 'border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100', activeColor: 'bg-rose-500 text-white border-rose-500' },
  { type: 'need', label: 'Need', color: 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100', activeColor: 'bg-amber-500 text-white border-amber-500' },
]

interface Props {
  note: Note
  interviews: Interview[]
  currentUserId: string
  onClose: () => void
  onRefresh: () => void
}

export default function NoteEditModal({ note, interviews, currentUserId, onClose, onRefresh }: Props) {
  const [content, setContent] = useState(note.content)
  const [evidenceType, setEvidenceType] = useState<EvidenceType>(
    (note.evidence_type as EvidenceType) ?? 'observation'
  )
  const [interviewId, setInterviewId] = useState(note.interview_id ?? '')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { textareaRef.current?.focus() }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const isOwn = note.created_by === currentUserId
  const isPrivate = note.visibility === 'private'

  async function save() {
    if (!content.trim() || saving) return
    setSaving(true)
    await fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: content.trim(),
        evidence_type: evidenceType,
        interview_id: interviewId || null,
      }),
    })
    setSaving(false)
    onClose()
    onRefresh()
  }

  async function shareNote() {
    await fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility: 'shared' }),
    })
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
          <h2 className="font-semibold text-gray-800">Note</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Content */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Content
            </label>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={6}
              className="w-full text-sm text-gray-800 leading-relaxed border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </div>

          {/* Evidence type */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Type
            </label>
            <div className="flex flex-wrap gap-2">
              {EVIDENCE_TYPES.map(et => (
                <button
                  key={et.type}
                  type="button"
                  onClick={() => setEvidenceType(et.type)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    evidenceType === et.type ? et.activeColor : et.color
                  }`}
                >
                  {et.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interview */}
          {interviews.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Interview
              </label>
              <select
                value={interviewId}
                onChange={e => setInterviewId(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-700"
              >
                <option value="">— None —</option>
                {interviews.map(i => (
                  <option key={i.id} value={i.id}>{i.participant_name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Visibility (own private notes only) */}
          {isOwn && isPrivate && (
            <div className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
              <span className="text-xs text-gray-500">🔒 This note is private — only you can see it</span>
              <button
                onClick={shareNote}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Share with team
              </button>
            </div>
          )}

          {/* Save / Cancel */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={save}
              disabled={!content.trim() || saving}
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
        </div>
      </div>
    </div>
  )
}
