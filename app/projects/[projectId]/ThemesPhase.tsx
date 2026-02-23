'use client'

import { useState } from 'react'
import { getClusteringProgress } from '@/lib/phases'
import type { Note, Theme, ProjectCounts } from '@/lib/types'

interface Props {
  projectId: string
  notes: Note[]
  themes: Theme[]
  counts: ProjectCounts
  isEditor: boolean
  onRefresh: () => void
}

export default function ThemesPhase({ projectId, notes, themes, counts, isEditor, onRefresh }: Props) {
  const [addingTheme, setAddingTheme] = useState(false)
  const [themeTitle, setThemeTitle] = useState('')
  const [dragNoteId, setDragNoteId] = useState<string | null>(null)
  const [dragSourceThemeId, setDragSourceThemeId] = useState<string | null>(null)
  const [dragOverThemeId, setDragOverThemeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [aiClustering, setAiClustering] = useState(false)
  const [aiError, setAiError] = useState('')

  const clusterPct = getClusteringProgress(counts)
  const ungrouped = notes.filter(n => !n.theme_ids || n.theme_ids.length === 0)

  function notesForTheme(themeId: string): Note[] {
    return notes.filter(n => n.theme_ids?.includes(themeId)).reverse()
  }

  async function createTheme(e: React.FormEvent) {
    e.preventDefault()
    if (!themeTitle.trim()) return
    setLoading(true)
    const res = await fetch('/api/themes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, title: themeTitle.trim() }),
    })
    setLoading(false)
    if (res.ok) {
      setThemeTitle('')
      setAddingTheme(false)
      onRefresh()
    }
  }

  async function attachNote(themeId: string, noteId: string) {
    await fetch(`/api/themes/${themeId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note_id: noteId }),
    })
    onRefresh()
  }

  async function detachNote(themeId: string, noteId: string) {
    await fetch(`/api/themes/${themeId}/notes?noteId=${noteId}`, { method: 'DELETE' })
    onRefresh()
  }

  async function moveNote(fromThemeId: string, toThemeId: string, noteId: string) {
    await fetch(`/api/themes/${fromThemeId}/notes?noteId=${noteId}`, { method: 'DELETE' })
    await fetch(`/api/themes/${toThemeId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note_id: noteId }),
    })
    onRefresh()
  }

  async function deleteTheme(id: string) {
    if (!confirm('Delete this theme? Notes will be ungrouped.')) return
    await fetch(`/api/themes/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  async function clusterWithAI() {
    setAiClustering(true)
    setAiError('')
    const res = await fetch('/api/ai/cluster-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId }),
    })
    if (res.ok) {
      onRefresh()
    } else {
      const data = await res.json()
      setAiError(data.error || 'Clustering failed — try again')
    }
    setAiClustering(false)
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 140px)' }}>
      {/* Progress bar + controls */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="max-w-6xl mx-auto flex items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-600">Notes clustered</span>
              <span className={`text-xs font-semibold ${clusterPct >= 70 ? 'text-green-600' : 'text-gray-500'}`}>
                {counts.clustered_note_count}/{counts.note_count} notes ({clusterPct}%)
                {clusterPct >= 70 ? ' ✓' : ' — need 70%'}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${clusterPct >= 70 ? 'bg-green-500' : 'bg-blue-400'}`}
                style={{ width: `${Math.min(clusterPct, 100)}%` }}
              />
            </div>
          </div>
          {isEditor && (
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={clusterWithAI}
                disabled={aiClustering}
                className="px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium hover:bg-purple-100 disabled:opacity-50"
              >
                {aiClustering ? 'Clustering…' : '✨ Cluster with AI'}
              </button>
              <button
                onClick={() => setAddingTheme(true)}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                + Add theme
              </button>
            </div>
          )}
          {aiError && (
            <p className="text-xs text-red-500 mt-1">{aiError}</p>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: ungrouped notes */}
        <div className="w-64 flex-shrink-0 bg-gray-50 border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Ungrouped ({ungrouped.length})
            </h3>
            <div className="space-y-2">
              {ungrouped.map(note => (
                <div
                  key={note.id}
                  draggable={isEditor}
                  onDragStart={() => { setDragNoteId(note.id); setDragSourceThemeId(null) }}
                  onDragEnd={() => { setDragNoteId(null); setDragSourceThemeId(null); setDragOverThemeId(null) }}
                  className={[
                    'bg-white border border-gray-200 rounded-lg p-3 text-xs text-gray-700 leading-relaxed select-none',
                    isEditor ? 'cursor-grab active:cursor-grabbing' : '',
                    dragNoteId === note.id ? 'opacity-40 border-blue-300' : 'hover:shadow-sm',
                  ].join(' ')}
                >
                  <p>{note.content}</p>
                  {note.interview_name && (
                    <p className="text-blue-500 mt-1.5 text-[11px]">{note.interview_name}</p>
                  )}
                </div>
              ))}
              {ungrouped.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6">All notes are grouped ✓</p>
              )}
            </div>
          </div>
        </div>

        {/* Right panel: themes */}
        <div className="flex-1 overflow-x-auto overflow-y-auto bg-gray-50">
          {addingTheme && (
            <form onSubmit={createTheme} className="m-4 flex gap-2 items-center">
              <input
                autoFocus
                type="text"
                value={themeTitle}
                onChange={e => setThemeTitle(e.target.value)}
                placeholder="Theme name..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => { setAddingTheme(false); setThemeTitle('') }}
                className="px-3 py-2 text-gray-500 text-sm hover:text-gray-700"
              >
                Cancel
              </button>
            </form>
          )}

          {themes.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <div className="text-3xl mb-3">🗂</div>
                <p className="text-sm text-gray-500">No themes yet. Create one and drag notes into it.</p>
              </div>
            </div>
          ) : (
            <div className="flex gap-4 p-4 items-start min-h-full">
              {themes.map(theme => {
                const themeNotes = notesForTheme(theme.id)
                const isOver = dragOverThemeId === theme.id

                return (
                  <div
                    key={theme.id}
                    className={[
                      'bg-white border-2 rounded-xl w-64 flex-shrink-0 flex flex-col min-h-[160px] transition-colors',
                      isOver ? 'border-blue-400 bg-blue-50' : 'border-dashed border-gray-200',
                    ].join(' ')}
                    onDragOver={e => { e.preventDefault(); setDragOverThemeId(theme.id) }}
                    onDragLeave={() => setDragOverThemeId(null)}
                    onDrop={() => {
                      if (dragNoteId && isEditor && dragOverThemeId !== dragSourceThemeId) {
                        if (dragSourceThemeId) {
                          moveNote(dragSourceThemeId, theme.id, dragNoteId)
                        } else {
                          attachNote(theme.id, dragNoteId)
                        }
                        setDragNoteId(null)
                        setDragSourceThemeId(null)
                        setDragOverThemeId(null)
                      }
                    }}
                  >
                    <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
                      <h4 className="font-semibold text-sm text-gray-800 flex-1 leading-tight">{theme.title}</h4>
                      <span className="text-xs text-gray-400 mx-2">{themeNotes.length}</span>
                      {isEditor && (
                        <button
                          onClick={() => deleteTheme(theme.id)}
                          className="text-gray-300 hover:text-red-400 text-lg leading-none"
                          title="Delete theme"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <div className="p-3 flex flex-col gap-2 flex-1">
                      {themeNotes.map(note => (
                        <div
                          key={note.id}
                          draggable={isEditor}
                          onDragStart={e => {
                            e.stopPropagation()
                            setDragNoteId(note.id)
                            setDragSourceThemeId(theme.id)
                          }}
                          onDragEnd={() => { setDragNoteId(null); setDragSourceThemeId(null); setDragOverThemeId(null) }}
                          className={[
                            'bg-gray-50 border border-gray-100 rounded-lg p-2.5 text-xs text-gray-700 group relative',
                            isEditor ? 'cursor-grab active:cursor-grabbing' : '',
                            dragNoteId === note.id ? 'opacity-40' : '',
                          ].join(' ')}
                        >
                          <p className="leading-relaxed pr-4">{note.content}</p>
                          {note.interview_name && (
                            <p className="text-blue-500 mt-1 text-[11px]">{note.interview_name}</p>
                          )}
                          {isEditor && (
                            <button
                              onClick={() => detachNote(theme.id, note.id)}
                              className="absolute top-1.5 right-1.5 text-gray-300 hover:text-red-400 text-sm opacity-0 group-hover:opacity-100"
                              title="Remove from theme"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      {themeNotes.length === 0 && !isOver && (
                        <p className="text-xs text-gray-300 text-center py-4">Drop notes here</p>
                      )}
                      {isOver && (
                        <div className="border-2 border-dashed border-blue-300 rounded-lg py-4 text-center">
                          <p className="text-xs text-blue-400">Drop to add</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
