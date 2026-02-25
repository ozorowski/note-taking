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
  const [dragInsertPoint, setDragInsertPoint] = useState<{ themeId: string; index: number } | null>(null)
  const [themeNoteOrder, setThemeNoteOrder] = useState<Record<string, string[]>>({})
  const [recentlyDroppedNoteId, setRecentlyDroppedNoteId] = useState<string | null>(null)
  const [filterInterview, setFilterInterview] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiClustering, setAiClustering] = useState(false)
  const [aiError, setAiError] = useState('')

  const clusterPct = getClusteringProgress(counts)

  // Unique interview names and tags across all notes
  const allInterviews = [...new Set(notes.map(n => n.interview_name).filter(Boolean))] as string[]
  const allTags = [...new Set(notes.flatMap(n => n.tags ?? []))]

  function applyFilter(noteList: Note[]): Note[] {
    return noteList.filter(n => {
      if (filterInterview && n.interview_name !== filterInterview) return false
      if (filterTag && !n.tags?.includes(filterTag)) return false
      return true
    })
  }

  // Newest first; filter applies only to ungrouped panel
  const allUngrouped = notes
    .filter(n => !n.theme_ids || n.theme_ids.length === 0)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const ungrouped = applyFilter(allUngrouped)

  function notesForTheme(themeId: string): Note[] {
    const base = notes.filter(n => n.theme_ids?.includes(themeId)).reverse()
    const order = themeNoteOrder[themeId]
    if (!order || order.length === 0) return base
    return [...base].sort((a, b) => {
      const ai = order.indexOf(a.id)
      const bi = order.indexOf(b.id)
      if (ai === -1 && bi === -1) return 0
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
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

  async function detachNote(themeId: string, noteId: string) {
    await fetch(`/api/themes/${themeId}/notes?noteId=${noteId}`, { method: 'DELETE' })
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

  function handleNoteDragOver(e: React.DragEvent, themeId: string, noteIndex: number) {
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const isTopHalf = e.clientY < rect.top + rect.height / 2
    setDragOverThemeId(themeId)
    setDragInsertPoint({ themeId, index: isTopHalf ? noteIndex : noteIndex + 1 })
  }

  function handleDrop(themeId: string, themeNotes: Note[]) {
    if (!dragNoteId || !isEditor) return

    const droppedId = dragNoteId
    const insertIndex = dragInsertPoint?.themeId === themeId
      ? dragInsertPoint.index
      : themeNotes.length

    if (dragSourceThemeId === themeId) {
      const currentOrder = themeNotes.map(n => n.id)
      const fromIndex = currentOrder.indexOf(droppedId)
      if (fromIndex === -1) return
      const adjustedTo = insertIndex > fromIndex ? insertIndex - 1 : insertIndex
      const newOrder = [...currentOrder]
      newOrder.splice(fromIndex, 1)
      newOrder.splice(adjustedTo, 0, droppedId)
      setThemeNoteOrder(prev => ({ ...prev, [themeId]: newOrder }))
    } else {
      const currentIds = themeNotes.map(n => n.id)
      const newOrder = [...currentIds]
      newOrder.splice(insertIndex, 0, droppedId)
      setThemeNoteOrder(prev => ({ ...prev, [themeId]: newOrder }))

      if (dragSourceThemeId) {
        fetch(`/api/themes/${dragSourceThemeId}/notes?noteId=${droppedId}`, { method: 'DELETE' })
          .then(() => fetch(`/api/themes/${themeId}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note_id: droppedId }),
          }))
          .then(() => onRefresh())
      } else {
        fetch(`/api/themes/${themeId}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note_id: droppedId }),
        }).then(() => onRefresh())
      }
    }

    // Flash the dropped note
    setRecentlyDroppedNoteId(droppedId)
    setTimeout(() => setRecentlyDroppedNoteId(null), 900)

    setDragNoteId(null)
    setDragSourceThemeId(null)
    setDragOverThemeId(null)
    setDragInsertPoint(null)
  }

  function clearDragState() {
    setDragNoteId(null)
    setDragSourceThemeId(null)
    setDragOverThemeId(null)
    setDragInsertPoint(null)
  }

  const hasFilter = filterInterview || filterTag

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 140px)' }}>
      {/* Progress bar + controls */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-6">
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
                  {aiClustering ? 'Tracey is clustering…' : '✨ Ask Tracey to cluster notes'}
                </button>
                <button
                  onClick={() => setAddingTheme(true)}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  + Add theme
                </button>
              </div>
            )}
          </div>

          {aiError && (
            <p className="text-xs text-red-500 mt-1.5">{aiError}</p>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: ungrouped notes */}
        <div className="w-64 flex-shrink-0 bg-gray-50 border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Ungrouped ({hasFilter ? `${ungrouped.length} of ${allUngrouped.length}` : allUngrouped.length})
              </h3>
              {hasFilter && (
                <button
                  onClick={() => { setFilterInterview(''); setFilterTag('') }}
                  className="text-[10px] text-blue-500 hover:text-blue-700"
                >
                  Clear
                </button>
              )}
            </div>
            {(allInterviews.length > 0 || allTags.length > 0) && (
              <div className="flex flex-col gap-1.5 mb-3">
                {allInterviews.length > 0 && (
                  <select
                    value={filterInterview}
                    onChange={e => setFilterInterview(e.target.value)}
                    className={`w-full text-xs px-2 py-1.5 rounded-md border focus:outline-none focus:ring-1 focus:ring-blue-400 ${
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
                    className={`w-full text-xs px-2 py-1.5 rounded-md border focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                      filterTag ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-500'
                    }`}
                  >
                    <option value="">All tags</option>
                    {allTags.map(tag => (
                      <option key={tag} value={tag}>{tag}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
            <div className="space-y-2">
              {ungrouped.map(note => (
                <div
                  key={note.id}
                  draggable={isEditor}
                  onDragStart={() => { setDragNoteId(note.id); setDragSourceThemeId(null) }}
                  onDragEnd={clearDragState}
                  className={[
                    'bg-white border border-gray-200 rounded-lg p-3 text-xs text-gray-700 leading-relaxed select-none transition-all duration-300',
                    isEditor ? 'cursor-grab active:cursor-grabbing' : '',
                    dragNoteId === note.id ? 'opacity-30 saturate-0 border-dashed border-blue-300' : dragNoteId ? '' : 'hover:shadow-sm',
                  ].join(' ')}
                >
                  <p className="leading-relaxed">{note.content}</p>
                  {(note.interview_name || note.evidence_type) && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      {note.interview_name && (
                        <span className="text-[11px] text-blue-600 bg-blue-50 rounded-full px-2 py-0.5">
                          {note.interview_name}
                        </span>
                      )}
                      {note.evidence_type && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          note.evidence_type === 'quote' ? 'bg-blue-100 text-blue-700' :
                          note.evidence_type === 'observation' ? 'bg-purple-100 text-purple-700' :
                          note.evidence_type === 'pain_point' ? 'bg-rose-100 text-rose-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {note.evidence_type === 'pain_point' ? 'Pain Point' :
                           note.evidence_type.charAt(0).toUpperCase() + note.evidence_type.slice(1)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {ungrouped.length === 0 && !hasFilter && (
                <p className="text-xs text-gray-400 text-center py-6">All notes are grouped ✓</p>
              )}
              {ungrouped.length === 0 && hasFilter && (
                <p className="text-xs text-gray-400 text-center py-6">No ungrouped notes match the filter.</p>
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
                      isOver ? 'border-blue-500 bg-blue-50 shadow-[inset_0_0_0_1px_#3b82f6]' : 'border-dashed border-gray-200',
                    ].join(' ')}
                    onDragOver={e => {
                      e.preventDefault()
                      setDragOverThemeId(theme.id)
                      setDragInsertPoint({ themeId: theme.id, index: themeNotes.length })
                    }}
                    onDragLeave={e => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setDragOverThemeId(null)
                        setDragInsertPoint(null)
                      }
                    }}
                    onDrop={() => handleDrop(theme.id, themeNotes)}
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
                      {themeNotes.map((note, noteIdx) => {
                        const insertLineBefore =
                          dragInsertPoint?.themeId === theme.id && dragInsertPoint.index === noteIdx
                        const insertLineAfter =
                          dragInsertPoint?.themeId === theme.id &&
                          dragInsertPoint.index === noteIdx + 1 &&
                          noteIdx === themeNotes.length - 1
                        const isDropped = recentlyDroppedNoteId === note.id

                        return (
                          <div
                            key={note.id}
                            draggable={isEditor}
                            onDragStart={e => {
                              e.stopPropagation()
                              setDragNoteId(note.id)
                              setDragSourceThemeId(theme.id)
                            }}
                            onDragEnd={clearDragState}
                            onDragOver={e => handleNoteDragOver(e, theme.id, noteIdx)}
                            className={[
                              'border rounded-lg p-2.5 text-xs text-gray-700 group relative transition-all duration-300',
                              isEditor ? 'cursor-grab active:cursor-grabbing' : '',
                              isDropped
                                ? 'bg-blue-50 border-blue-300 shadow-sm shadow-blue-100'
                                : dragNoteId === note.id
                                  ? 'bg-gray-50 border-gray-100 opacity-30 saturate-0 border-dashed border-blue-300'
                                  : dragNoteId
                                    ? 'bg-gray-50 border-gray-100'
                                    : 'bg-gray-50 border-gray-100 hover:bg-white hover:border-gray-200 hover:shadow-sm',
                              insertLineBefore ? "before:content-[''] before:absolute before:inset-x-0 before:h-[3px] before:bg-blue-500 before:rounded-full before:-top-[5px]" : '',
                              insertLineAfter ? "after:content-[''] after:absolute after:inset-x-0 after:h-[3px] after:bg-blue-500 after:rounded-full after:-bottom-[5px]" : '',
                            ].join(' ')}
                          >
                            <p className="leading-relaxed pr-4">{note.content}</p>
                            {(note.interview_name || note.evidence_type) && (
                              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                                {note.interview_name && (
                                  <span className="text-[11px] text-blue-600 bg-blue-50 rounded-full px-2 py-0.5">
                                    {note.interview_name}
                                  </span>
                                )}
                                {note.evidence_type && (
                                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                    note.evidence_type === 'quote' ? 'bg-blue-100 text-blue-700' :
                                    note.evidence_type === 'observation' ? 'bg-purple-100 text-purple-700' :
                                    note.evidence_type === 'pain_point' ? 'bg-rose-100 text-rose-700' :
                                    'bg-amber-100 text-amber-700'
                                  }`}>
                                    {note.evidence_type === 'pain_point' ? 'Pain Point' :
                                     note.evidence_type.charAt(0).toUpperCase() + note.evidence_type.slice(1)}
                                  </span>
                                )}
                              </div>
                            )}
                            {isEditor && (
                              <button
                                onClick={() => detachNote(theme.id, note.id)}
                                className="absolute top-1.5 right-1.5 text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-colors"
                                title="Move back to ungrouped"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                                  <line x1="2" y1="2" x2="22" y2="22"/>
                                </svg>
                              </button>
                            )}
                          </div>
                        )
                      })}

                      {themeNotes.length === 0 && (
                        isOver
                          ? <div className="border-2 border-dashed border-blue-500 bg-blue-50 rounded-lg h-16" />
                          : <p className="text-xs text-gray-300 text-center py-4">Drop notes here</p>
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
