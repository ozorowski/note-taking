'use client'

import { useState } from 'react'
import type { Interview } from '@/lib/types'
import InterviewDrawer from './InterviewDrawer'
import DeleteInterviewModal from './DeleteInterviewModal'

interface Props {
  projectId: string
  interviews: Interview[]
  isEditor: boolean
  onRefresh: () => void
}

export default function InterviewsPhase({ projectId, interviews, isEditor, onRefresh }: Props) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [rawNotes, setRawNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [drawerInterview, setDrawerInterview] = useState<Interview | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Interview | null>(null)

  async function addInterview(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const res = await fetch('/api/interviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, participant_name: name.trim(), raw_notes: rawNotes.trim() || null }),
    })
    setLoading(false)
    if (res.ok) {
      setName('')
      setRawNotes('')
      setAdding(false)
      onRefresh()
    }
  }

  async function confirmDelete(action: 'disassociate' | 'reassign' | 'delete_notes', reassignToId?: string) {
    if (!deleteTarget) return
    await fetch(`/api/interviews/${deleteTarget.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reassignToId }),
    })
    setDeleteTarget(null)
    setDrawerInterview(null)
    onRefresh()
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Interviews</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Add each research participant. You need at least 1 interview to proceed.
          </p>
        </div>
        {isEditor && (
          <button
            onClick={() => setAdding(true)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Add interview
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={addInterview} className="bg-white border border-gray-200 rounded-xl p-5 mb-5 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Participant name</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Sarah M. (product designer)"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Raw notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={rawNotes}
              onChange={e => setRawNotes(e.target.value)}
              placeholder="Paste a transcript or rough notes from the session..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add interview'}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setName(''); setRawNotes('') }}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {interviews.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
          <div className="text-3xl mb-3">🎙️</div>
          <p className="text-gray-500 text-sm">No interviews yet. Add your first research participant.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {interviews.map(interview => (
            <div
              key={interview.id}
              className="bg-white border border-gray-200 rounded-xl p-5 flex items-start justify-between gap-4 group"
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900">{interview.participant_name}</h3>
                {interview.raw_notes && (
                  <p className="text-sm text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{interview.raw_notes}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(interview.created_at).toLocaleDateString()}
                </p>
              </div>
              {isEditor && (
                <button
                  onClick={() => setDrawerInterview(interview)}
                  className="text-gray-300 hover:text-blue-500 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-all"
                  title="Edit interview"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {drawerInterview && (
        <InterviewDrawer
          interview={drawerInterview}
          onClose={() => setDrawerInterview(null)}
          onRefresh={onRefresh}
          onRequestDelete={() => setDeleteTarget(drawerInterview)}
        />
      )}

      {deleteTarget && (
        <DeleteInterviewModal
          interview={deleteTarget}
          otherInterviews={interviews.filter(i => i.id !== deleteTarget.id)}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
