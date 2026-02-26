'use client'

import { useState, useRef, useEffect } from 'react'
import type { Note, Interview } from '@/lib/types'
import NoteCard from './NoteCard'
import NoteEditModal from './NoteEditModal'

type EvidenceType = 'quote' | 'observation' | 'pain_point' | 'need'

interface Props {
  projectId: string
  currentUserId: string
  interviews: Interview[]
  notes: Note[]
  isEditor: boolean
  onRefresh: () => void
}

const EVIDENCE_TYPES: { type: EvidenceType; label: string; key: string; color: string; activeColor: string }[] = [
  { type: 'quote', label: 'Quote', key: 'Q', color: 'border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100', activeColor: 'bg-blue-500 text-white border-blue-500' },
  { type: 'observation', label: 'Observation', key: 'O', color: 'border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100', activeColor: 'bg-purple-500 text-white border-purple-500' },
  { type: 'pain_point', label: 'Pain Point', key: 'P', color: 'border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100', activeColor: 'bg-rose-500 text-white border-rose-500' },
  { type: 'need', label: 'Other', key: 'X', color: 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100', activeColor: 'bg-amber-500 text-white border-amber-500' },
]


export default function CapturePhase({ projectId, currentUserId, interviews, notes, isEditor, onRefresh }: Props) {
  const [selectedInterviewId, setSelectedInterviewId] = useState(interviews[0]?.id || '')
  const [content, setContent] = useState('')
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('observation')
  const [saving, setSaving] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [sharedMessage, setSharedMessage] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [newNoteId, setNewNoteId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const myNotes = notes
    .filter(n => n.created_by === currentUserId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const privateCount = myNotes.filter(n => n.visibility === 'private').length

  async function saveNote() {
    if (!content.trim()) return
    if (!selectedInterviewId) return
    setSaving(true)
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        interview_id: selectedInterviewId,
        content: content.trim(),
        evidence_type: evidenceType,
        visibility: 'private',
      }),
    })
    if (res.ok) {
      const note = await res.json()
      setNewNoteId(note.id)
      setTimeout(() => setNewNoteId(null), 800)
    }
    setSaving(false)
    setContent('')
    textareaRef.current?.focus()
    onRefresh()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      saveNote()
      return
    }
    // Ctrl+Q/O/P/N to change evidence type
    if (e.ctrlKey || e.metaKey) {
      const map: Record<string, EvidenceType> = { q: 'quote', o: 'observation', p: 'pain_point', x: 'need' }
      const t = map[e.key.toLowerCase()]
      if (t) {
        e.preventDefault()
        setEvidenceType(t)
      }
    }
  }

  async function shareAll() {
    setSharing(true)
    await fetch('/api/notes/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId }),
    })
    setSharing(false)
    setSharedMessage(true)
    setTimeout(() => setSharedMessage(false), 2500)
    onRefresh()
  }

  async function deleteNote(noteId: string) {
    await fetch(`/api/notes/${noteId}`, { method: 'DELETE' })
    onRefresh()
  }

  async function shareNote(noteId: string) {
    await fetch(`/api/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility: 'shared' }),
    })
    onRefresh()
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center flex-shrink-0">
        {/* Left — spacer */}
        <div className="flex-1" />

        {/* Centre — title + guide icon */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-gray-700">🔒 Private Capture Mode</span>
          <div className="relative group/guide">
            <button className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold leading-none flex items-center justify-center hover:bg-gray-300 transition-colors">
              ?
            </button>
            <div className="absolute top-6 left-1/2 -translate-x-1/2 w-64 bg-gray-900 text-white text-xs rounded-lg px-3 py-2.5 leading-relaxed shadow-lg opacity-0 group-hover/guide:opacity-100 pointer-events-none transition-opacity z-10">
              <p className="font-medium mb-1">Why private?</p>
              <p className="text-gray-300 mb-2">Your notes are only visible to you while capturing, so you can think freely without anchoring others.</p>
              <p className="font-medium mb-1">When you&apos;re ready</p>
              <p className="text-gray-300">Click <span className="text-emerald-400 font-medium">Share all notes →</span> to make them visible to your team and move to the synthesis phase.</p>
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-1.5 overflow-hidden">
                <div className="w-2 h-2 bg-gray-900 rotate-45 translate-y-1 mx-auto" />
              </div>
            </div>
          </div>
        </div>

        {/* Right — share button */}
        <div className="flex-1 flex justify-end">
          {privateCount > 0 && (
            <button
              onClick={shareAll}
              disabled={sharing}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-colors"
            >
              {sharedMessage ? '✓ Shared!' : sharing ? 'Sharing...' : `Share all ${privateCount} notes →`}
            </button>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="px-6 py-6 flex-shrink-0 max-w-5xl w-full mx-auto">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 space-y-4">
          {/* Interview selector — inside the card, above the textarea */}
          <div>
            {interviews.length > 0 ? (
              <select
                value={selectedInterviewId}
                onChange={e => setSelectedInterviewId(e.target.value)}
                className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
              >
                <option value="">— Select interview —</option>
                {interviews.map(i => (
                  <option key={i.id} value={i.id}>{i.participant_name}</option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-amber-600">⚠ Add interviews first to start capturing</span>
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your observation..."
            rows={4}
            disabled={!selectedInterviewId || !isEditor}
            className="w-full text-[20px] leading-relaxed resize-none focus:outline-none placeholder-gray-300 disabled:opacity-50 text-gray-800"
            style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
          />

          {/* Evidence type selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 mr-1">Type:</span>
            {EVIDENCE_TYPES.map(et => (
              <button
                key={et.type}
                type="button"
                onClick={() => { setEvidenceType(et.type); textareaRef.current?.focus() }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  evidenceType === et.type ? et.activeColor : et.color
                }`}
              >
                <span>{et.label}</span>
                <span className="opacity-40 text-[10px] ml-0.5">⌃{et.key}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between pt-3 mt-1 border-t border-gray-100">
            <p className="text-xs text-gray-400">Enter to save · Shift+Enter for new line</p>
            <button
              onClick={saveNote}
              disabled={!content.trim() || !selectedInterviewId || saving || !isEditor}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {saving ? 'Saving...' : 'Save note'}
            </button>
          </div>
        </div>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="max-w-5xl w-full mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-500">
              Your notes{myNotes.length > 0 && ` (${myNotes.length})`}
            </h3>
            {privateCount > 0 && (
              <span className="text-xs text-gray-400">🔒 {privateCount} private</span>
            )}
          </div>

          {myNotes.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              No notes yet — start capturing above
            </div>
          ) : (
            <>
              <style>{`
                @keyframes noteSlideIn {
                  from { opacity: 0; transform: translateY(-24px); }
                  to   { opacity: 1; transform: translateY(0); }
                }
                .note-enter { animation: noteSlideIn 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
              `}</style>
              <div className="space-y-2">
                {myNotes.map(note => (
                  <div key={note.id} className={note.id === newNoteId ? 'note-enter' : ''}>
                    <NoteCard
                      note={note}
                      currentUserId={currentUserId}
                      isEditor={isEditor}
                      onEdit={() => setEditingNote(note)}
                      onDelete={() => deleteNote(note.id)}
                      onShare={() => shareNote(note.id)}
                      showTimestamp
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {editingNote && (
        <NoteEditModal
          note={editingNote}
          interviews={interviews}
          currentUserId={currentUserId}
          onClose={() => setEditingNote(null)}
          onRefresh={onRefresh}
        />
      )}
    </div>
  )
}
