'use client'

import { useState } from 'react'
import type { Note, Interview } from '@/lib/types'
import NoteCard from './NoteCard'
import NoteEditModal from './NoteEditModal'

interface Props {
  currentUserId: string
  notes: Note[]
  interviews: Interview[]
  isEditor: boolean
  onRefresh: () => void
}

export default function NotesPhase({ currentUserId, notes, interviews, isEditor, onRefresh }: Props) {
  const [filterInterview, setFilterInterview] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [editingNote, setEditingNote] = useState<Note | null>(null)

  const allTags = [...new Set(notes.flatMap(n => n.tags ?? []))]
  const allInterviews = [...new Set(notes.map(n => n.interview_name).filter(Boolean))] as string[]
  const hasImported = notes.some(n => n.source_type === 'url_import')

  const filtered = notes
    .filter(n => {
      if (filterInterview && n.interview_name !== filterInterview) return false
      if (filterTag && !n.tags?.includes(filterTag)) return false
      if (filterSource === 'imported' && n.source_type !== 'url_import') return false
      return true
    })
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const hasFilter = filterInterview || filterTag || filterSource

  async function deleteNote(id: string) {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">Notes</h2>
          <p className="text-sm text-gray-500 mt-0.5 mb-3">
            {hasImported
              ? 'Imported notes are ready to cluster. Review, edit or delete before moving to Themes.'
              : 'Capture observations and quotes. Need at least 10 notes, all linked to an interview.'}
          </p>
          <div className="flex items-center gap-2 justify-end">
            {allInterviews.length > 0 && (
              <select
                value={filterInterview}
                onChange={e => setFilterInterview(e.target.value)}
                className={`text-sm px-2.5 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                  filterInterview ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-500'
                }`}
              >
                <option value="">All interviews</option>
                {allInterviews.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            )}
            {allTags.length > 0 && (
              <select
                value={filterTag}
                onChange={e => setFilterTag(e.target.value)}
                className={`text-sm px-2.5 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                  filterTag ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-500'
                }`}
              >
                <option value="">All tags</option>
                {allTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            )}
            {hasImported && (
              <button
                onClick={() => setFilterSource(f => f === 'imported' ? '' : 'imported')}
                className={`text-sm px-2.5 py-1.5 rounded-lg border transition-colors ${
                  filterSource === 'imported'
                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                Imported
              </button>
            )}
            <button
              onClick={() => { setFilterInterview(''); setFilterTag(''); setFilterSource('') }}
              className={`text-gray-400 hover:text-gray-700 text-lg leading-none ${hasFilter ? 'visible' : 'invisible'}`}
              title="Clear filters"
            >
              ×
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
            <div className="text-3xl mb-3">📝</div>
            <p className="text-gray-500 text-sm">
              {hasFilter
                ? 'No notes match the current filters.'
                : 'No notes yet. Start capturing observations from your interviews.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                currentUserId={currentUserId}
                isEditor={isEditor}
                onEdit={() => setEditingNote(note)}
                onDelete={() => deleteNote(note.id)}
                showAuthor
                showTimestamp
              />
            ))}
          </div>
        )}
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
    </>
  )
}
