'use client'

import { useState } from 'react'
import type { Note, Interview } from '@/lib/types'

type Filter = 'all' | 'tagged' | 'unlinked'

interface Props {
  projectId: string
  notes: Note[]
  interviews: Interview[]
  isEditor: boolean
  onRefresh: () => void
}

export default function NotesPhase({ projectId, notes, interviews, isEditor, onRefresh }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [adding, setAdding] = useState(false)
  const [content, setContent] = useState('')
  const [interviewId, setInterviewId] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingTagsId, setEditingTagsId] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')

  const filtered = notes.filter(n => {
    if (filter === 'tagged') return n.tags && n.tags.length > 0
    if (filter === 'unlinked') return !n.interview_id
    return true
  })

  async function addNote(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setLoading(true)
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        content: content.trim(),
        interview_id: interviewId || null,
      }),
    })
    setLoading(false)
    if (res.ok) {
      setContent('')
      setInterviewId('')
      setAdding(false)
      onRefresh()
    }
  }

  async function deleteNote(id: string) {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  async function saveTags(noteId: string, tagsStr: string) {
    const tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean)
    await fetch(`/api/notes/${noteId}/tags`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    })
    setEditingTagsId(null)
    onRefresh()
  }

  const taggedCount = notes.filter(n => n.tags && n.tags.length > 0).length
  const unlinkedCount = notes.filter(n => !n.interview_id).length

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Notes</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Capture observations and quotes. Need at least 10 notes, all linked to an interview.
          </p>
        </div>
        {isEditor && (
          <button
            onClick={() => setAdding(true)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Add note
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        {([
          { id: 'all', label: `All (${notes.length})` },
          { id: 'tagged', label: `Tagged (${taggedCount})` },
          { id: 'unlinked', label: `No interview (${unlinkedCount})` },
        ] as { id: Filter; label: string }[]).map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              filter === f.id ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {adding && (
        <form onSubmit={addNote} className="bg-white border border-gray-200 rounded-xl p-5 mb-5 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note / quote</label>
            <textarea
              autoFocus
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={`e.g. "I always forget where I saved my files" — participant frustrated during task 2`}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Link to interview</label>
            <select
              value={interviewId}
              onChange={e => setInterviewId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select interview —</option>
              {interviews.map(i => (
                <option key={i.id} value={i.id}>{i.participant_name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add note'}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setContent(''); setInterviewId('') }}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
          <div className="text-3xl mb-3">📝</div>
          <p className="text-gray-500 text-sm">
            {filter === 'all'
              ? 'No notes yet. Start capturing observations from your interviews.'
              : `No ${filter === 'tagged' ? 'tagged' : 'interview-linked'} notes.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(note => (
            <div
              key={note.id}
              className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2 group"
            >
              <div className="flex items-start gap-2">
                <p className="flex-1 text-sm text-gray-800 leading-relaxed">{note.content}</p>
                {isEditor && (
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="text-gray-200 hover:text-red-500 text-xl leading-none opacity-0 group-hover:opacity-100 flex-shrink-0"
                  >
                    ×
                  </button>
                )}
              </div>

              {note.interview_name && (
                <span className="text-xs text-blue-600 bg-blue-50 rounded-full px-2.5 py-0.5 w-fit">
                  {note.interview_name}
                </span>
              )}

              {/* Tags — click to edit */}
              {editingTagsId === note.id ? (
                <input
                  autoFocus
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onBlur={() => saveTags(note.id, tagInput)}
                  onKeyDown={e => e.key === 'Enter' && saveTags(note.id, tagInput)}
                  placeholder="tag1, tag2..."
                  className="px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              ) : (
                <div
                  className="flex flex-wrap gap-1 cursor-pointer min-h-[18px]"
                  onClick={() => isEditor && (setEditingTagsId(note.id), setTagInput((note.tags || []).join(', ')))}
                >
                  {(note.tags || []).length > 0
                    ? note.tags!.map(tag => (
                        <span key={tag} className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                          {tag}
                        </span>
                      ))
                    : isEditor && (
                        <span className="text-xs text-gray-300 hover:text-gray-500">+ add tags</span>
                      )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
