'use client'

import React, { useState, useRef, Fragment, useEffect } from 'react'
import type { Note, Theme, ProjectCounts, GuideQuestion } from '@/lib/types'

import TraceyModal from '@/components/TraceyModal'

interface Props {
  projectId: string
  notes: Note[]
  themes: Theme[]
  counts: ProjectCounts
  isEditor: boolean
  guideQuestions: GuideQuestion[]
  onRefresh: () => void
}

type DragPayload =
  | { type: 'note'; id: string; sourceThemeId: string | null }
  | { type: 'group'; id: string; groupNotes: Note[]; sourceThemeId: string | null }

type SortMode = 'note_id' | 'participant' | 'evidence_type' | 'date_added'


export default function ThemesPhase({ projectId, notes, themes, isEditor, guideQuestions, onRefresh }: Props) {
  const [addingTheme, setAddingTheme] = useState(false)
  const [themeTitle, setThemeTitle] = useState('')
  const [themeNameError, setThemeNameError] = useState('')
  const [drag, setDrag] = useState<DragPayload | null>(null)
  const [dragOverThemeId, setDragOverThemeId] = useState<string | null>(null)
  const [insertPoint, setInsertPoint] = useState<{ themeId: string; index: number } | null>(null)
  const [themeItemOrder, setThemeItemOrder] = useState<Record<string, string[]>>({})
  const [recentlyDroppedNoteId, setRecentlyDroppedNoteId] = useState<string | null>(null)
  const [dragOverUngrouped, setDragOverUngrouped] = useState(false)
  const [filterInterview, setFilterInterview] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [filterQuestion, setFilterQuestion] = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiClustering, setAiClustering] = useState(false)
  const [aiError, setAiError] = useState('')
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null)
  const [editingThemeTitle, setEditingThemeTitle] = useState('')

  const [dragThemeId, setDragThemeId] = useState<string | null>(null)
  const [dragOverThemeInsertIdx, setDragOverThemeInsertIdx] = useState<number | null>(null)
  const [themeOrder, setThemeOrder] = useState<string[]>([])
  const [confirmDeleteThemeId, setConfirmDeleteThemeId] = useState<string | null>(null)
  const [expandedUngroupedGroupIds, setExpandedUngroupedGroupIds] = useState<Set<string>>(new Set())
  const [expandedThemeGroupIds, setExpandedThemeGroupIds] = useState<Set<string>>(new Set())
  const [aiProvider, setAiProvider] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/ai/provider').then(r => r.json()).then(d => setAiProvider(d.provider)).catch(() => {})
  }, [])
  const [dragOverAddTheme, setDragOverAddTheme] = useState(false)
  const [expandedThemeId, setExpandedThemeId] = useState<string | null>(null)
  const [openMenuThemeId, setOpenMenuThemeId] = useState<string | null>(null)
  const [themeSortMode, setThemeSortMode] = useState<Record<string, 'note_id' | 'participant' | 'evidence_type' | 'date_added'>>({})
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const savedScrollLeft = useRef(0)


  function setThemeSort(themeId: string, mode: SortMode) {
    setThemeSortMode(prev => ({ ...prev, [themeId]: mode }))
    setThemeItemOrder(prev => ({ ...prev, [themeId]: [] })) // clear manual order when sort applied
    setOpenMenuThemeId(null)
  }

  // Ordered themes — local optimistic override after drag-to-reorder
  const orderedThemes = themeOrder.length > 0
    ? themeOrder.map(id => themes.find(t => t.id === id)!).filter(Boolean)
    : themes

  // Only shared (or legacy unset) notes are visible in Themes
  const sharedNotes = notes.filter(n => !n.visibility || n.visibility === 'shared')

  // Count unique items (capture groups count as 1, not per individual note)
  const { sharedClustered, sharedTotal } = (() => {
    const seenGroups = new Set<string>()
    let clustered = 0, total = 0
    for (const n of sharedNotes) {
      const gid = n.capture_group_id
      if (gid) {
        if (seenGroups.has(gid)) continue
        seenGroups.add(gid)
      }
      total++
      if (n.theme_ids && n.theme_ids.length > 0) clustered++
    }
    return { sharedClustered: clustered, sharedTotal: total }
  })()
  const clusterPct = sharedTotal > 0 ? Math.round((sharedClustered / sharedTotal) * 100) : 0

  // Unique interview names, tags, and authors across all notes
  const allInterviews = [...new Set(sharedNotes.map(n => n.interview_name).filter(Boolean))] as string[]
  const allTags = [...new Set(sharedNotes.flatMap(n => n.tags ?? []))]
  const allUsers = [...new Set(sharedNotes.map(n => n.creator_name).filter(Boolean))] as string[]

  // Only questions that appear on at least one shared note
  const activeQuestions = guideQuestions.filter(q => sharedNotes.some(n => n.guide_question_id === q.id))

  function applyFilter(noteList: Note[]): Note[] {
    return noteList.filter(n => {
      if (filterInterview && n.interview_name !== filterInterview) return false
      if (filterTag && !n.tags?.includes(filterTag)) return false
      if (filterQuestion && n.guide_question_id !== filterQuestion) return false
      if (filterUser && n.creator_name !== filterUser) return false
      return true
    })
  }

  // Newest first; filter applies only to ungrouped panel
  const allUngrouped = sharedNotes
    .filter(n => !n.theme_ids || n.theme_ids.length === 0)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const ungrouped = applyFilter(allUngrouped)

  // Build capture-group map and ordered render list for ungrouped panel
  const ungroupedGroupMap = new Map<string, Note[]>()
  for (const note of ungrouped) {
    if (note.capture_group_id) {
      const arr = ungroupedGroupMap.get(note.capture_group_id) ?? []
      arr.push(note)
      ungroupedGroupMap.set(note.capture_group_id, arr)
    }
  }
  const seenUngroupedGroups = new Set<string>()
  const ungroupedItems: Array<{ type: 'note'; note: Note } | { type: 'group'; groupId: string }> = []
  for (const note of ungrouped) {
    if (note.capture_group_id) {
      if (!seenUngroupedGroups.has(note.capture_group_id)) {
        seenUngroupedGroups.add(note.capture_group_id)
        ungroupedItems.push({ type: 'group', groupId: note.capture_group_id })
      }
    } else {
      ungroupedItems.push({ type: 'note', note })
    }
  }

  type ThemeItem =
    | { type: 'note'; note: Note; id: string }
    | { type: 'group'; groupId: string; groupNotes: Note[]; id: string }

  function buildThemeItems(themeId: string): ThemeItem[] {
    const themeNotes = sharedNotes.filter(n => n.theme_ids?.includes(themeId)).reverse()
    const groupMap = new Map<string, Note[]>()
    for (const n of themeNotes) {
      if (n.capture_group_id) {
        const arr = groupMap.get(n.capture_group_id) ?? []
        arr.push(n)
        groupMap.set(n.capture_group_id, arr)
      }
    }
    const seenGroups = new Set<string>()
    const unordered: ThemeItem[] = []
    for (const n of themeNotes) {
      if (n.capture_group_id) {
        if (!seenGroups.has(n.capture_group_id)) {
          seenGroups.add(n.capture_group_id)
          unordered.push({ type: 'group', groupId: n.capture_group_id, groupNotes: groupMap.get(n.capture_group_id)!, id: n.capture_group_id })
        }
      } else {
        unordered.push({ type: 'note', note: n, id: n.id })
      }
    }
    const sortMode = themeSortMode[themeId]
    if (sortMode) {
      const getNote = (item: ThemeItem) => item.type === 'note' ? item.note : item.groupNotes[0]
      return [...unordered].sort((a, b) => {
        const na = getNote(a), nb = getNote(b)
        if (sortMode === 'note_id') return (na?.display_number ?? 0) - (nb?.display_number ?? 0)
        if (sortMode === 'participant') return (na?.interview_name ?? '').localeCompare(nb?.interview_name ?? '')
        if (sortMode === 'evidence_type') {
          const order = ['quote', 'observation', 'pain_point', 'need', null]
          return order.indexOf(na?.evidence_type ?? null) - order.indexOf(nb?.evidence_type ?? null)
        }
        if (sortMode === 'date_added') return new Date(na?.created_at ?? 0).getTime() - new Date(nb?.created_at ?? 0).getTime()
        return 0
      })
    }
    const order = themeItemOrder[themeId]
    if (!order || order.length === 0) return unordered
    return [...unordered].sort((a, b) => {
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
    const duplicate = themes.some(t => t.title.toLowerCase() === themeTitle.trim().toLowerCase())
    if (duplicate) { setThemeNameError('A theme with this name already exists.'); return }
    setThemeNameError('')
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
    } else {
      const d = await res.json()
      setThemeNameError(d.error || 'Could not create theme.')
    }
  }

  async function detachNote(themeId: string, noteId: string) {
    await fetch(`/api/themes/${themeId}/notes?noteId=${noteId}`, { method: 'DELETE' })
    onRefresh()
  }

  async function confirmDeleteTheme() {
    if (!confirmDeleteThemeId) return
    setConfirmDeleteThemeId(null)
    await fetch(`/api/themes/${confirmDeleteThemeId}`, { method: 'DELETE' })
    onRefresh()
  }

  async function renameTheme(id: string) {
    const trimmed = editingThemeTitle.trim()
    if (!trimmed || trimmed === themes.find(t => t.id === id)?.title) {
      setEditingThemeId(null)
      setThemeNameError('')
      return
    }
    const duplicate = themes.some(t => t.id !== id && t.title.toLowerCase() === trimmed.toLowerCase())
    if (duplicate) { setThemeNameError('A theme with this name already exists.'); return }
    setThemeNameError('')
    setEditingThemeId(null)
    await fetch(`/api/themes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    })
    onRefresh()
  }

  async function handleDropOnAddTheme(e: React.DragEvent) {
    e.preventDefault()
    if (!drag) return
    const capturedDrag = drag
    setDragOverAddTheme(false)
    clearDrag()

    let title = 'New theme'
    let i = 2
    while (themes.some(t => t.title.toLowerCase() === title.toLowerCase())) {
      title = `New theme ${i++}`
    }

    const res = await fetch('/api/themes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, title }),
    })
    if (!res.ok) return
    const { id: newThemeId } = await res.json()

    if (capturedDrag.type === 'note') {
      await fetch(`/api/themes/${newThemeId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_id: capturedDrag.id }),
      })
      if (capturedDrag.sourceThemeId) {
        await fetch(`/api/themes/${capturedDrag.sourceThemeId}/notes?noteId=${capturedDrag.id}`, { method: 'DELETE' })
      }
    } else if (capturedDrag.type === 'group') {
      await Promise.all(capturedDrag.groupNotes.map(note =>
        fetch(`/api/themes/${newThemeId}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note_id: note.id }),
        })
      ))
      if (capturedDrag.sourceThemeId) {
        await Promise.all(capturedDrag.groupNotes.map(note =>
          fetch(`/api/themes/${capturedDrag.sourceThemeId!}/notes?noteId=${note.id}`, { method: 'DELETE' })
        ))
      }
    }

    setEditingThemeId(newThemeId)
    setEditingThemeTitle(title)
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

  function clearDrag() {
    setDrag(null)
    setDragOverThemeId(null)
    setInsertPoint(null)
    setDragOverUngrouped(false)
  }

  function handleItemDragOver(e: React.DragEvent, themeId: string, itemIdx: number) {
    if (dragThemeId) return
    e.preventDefault()
    e.stopPropagation()
    setDragOverThemeId(themeId)
    if (drag?.sourceThemeId === themeId) {
      // Within-theme: source-relative to avoid wobble from layout shifts
      const items = buildThemeItems(themeId)
      const fromIdx = items.findIndex(i => i.id === drag.id)
      const newIndex = fromIdx !== -1 && fromIdx < itemIdx ? itemIdx + 1 : itemIdx
      if (insertPoint?.themeId !== themeId || insertPoint?.index !== newIndex) {
        setInsertPoint({ themeId, index: newIndex })
      }
    } else {
      // Cross-theme: 50/50 split — grid uses left/right half, list uses upper/lower half
      const rect = e.currentTarget.getBoundingClientRect()
      const isGrid = expandedThemeId === themeId
      const newIndex = isGrid
        ? (e.clientX < rect.left + rect.width / 2 ? itemIdx : itemIdx + 1)
        : (e.clientY < rect.top + rect.height / 2 ? itemIdx : itemIdx + 1)
      if (insertPoint?.themeId !== themeId || insertPoint?.index !== newIndex) {
        setInsertPoint({ themeId, index: newIndex })
      }
    }
  }

  function handleDrop(themeId: string) {
    if (!drag || !isEditor) { clearDrag(); return }
    const items = buildThemeItems(themeId)
    const insertIndex = insertPoint?.themeId === themeId ? insertPoint.index : items.length
    const currentIds = items.map(i => i.id)

    if (drag.type === 'group') {
      const capturedId = drag.id
      const capturedGroupNotes = drag.groupNotes
      const capturedSourceThemeId = drag.sourceThemeId

      if (capturedSourceThemeId === themeId) {
        // Within-theme reorder of group
        const fromIndex = currentIds.indexOf(capturedId)
        if (fromIndex === -1) { clearDrag(); return }
        const to = insertIndex > fromIndex ? insertIndex - 1 : insertIndex
        const newIds = [...currentIds]
        newIds.splice(fromIndex, 1)
        newIds.splice(to, 0, capturedId)
        setThemeItemOrder(prev => ({ ...prev, [themeId]: newIds }))
        clearDrag()
        return
      }

      // Cross-theme group move — optimistically insert then persist
      const newIds = [...currentIds]
      newIds.splice(insertIndex, 0, capturedId)
      setThemeItemOrder(prev => ({ ...prev, [themeId]: newIds }))
      clearDrag()
      const addToTheme = () => Promise.all(capturedGroupNotes.map(note =>
        fetch(`/api/themes/${themeId}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note_id: note.id }),
        })
      ))
      if (capturedSourceThemeId) {
        Promise.all(capturedGroupNotes.map(note =>
          fetch(`/api/themes/${capturedSourceThemeId}/notes?noteId=${note.id}`, { method: 'DELETE' })
        )).then(() => addToTheme()).then(() => onRefresh())
      } else {
        addToTheme().then(() => onRefresh())
      }
      return
    }

    // Note
    const capturedNoteId = drag.id
    const capturedSourceThemeId = drag.sourceThemeId

    if (capturedSourceThemeId === themeId) {
      // Within-theme reorder
      const fromIndex = currentIds.indexOf(capturedNoteId)
      if (fromIndex === -1) { clearDrag(); return }
      const to = insertIndex > fromIndex ? insertIndex - 1 : insertIndex
      const newIds = [...currentIds]
      newIds.splice(fromIndex, 1)
      newIds.splice(to, 0, capturedNoteId)
      setThemeItemOrder(prev => ({ ...prev, [themeId]: newIds }))
      clearDrag()
      return
    }

    // Cross-theme note move — optimistically insert then persist
    const newIds = [...currentIds]
    newIds.splice(insertIndex, 0, capturedNoteId)
    setThemeItemOrder(prev => ({ ...prev, [themeId]: newIds }))
    clearDrag()
    if (capturedSourceThemeId) {
      fetch(`/api/themes/${capturedSourceThemeId}/notes?noteId=${capturedNoteId}`, { method: 'DELETE' })
        .then(() => fetch(`/api/themes/${themeId}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note_id: capturedNoteId }),
        }))
        .then(() => { setRecentlyDroppedNoteId(capturedNoteId); setTimeout(() => setRecentlyDroppedNoteId(null), 900); onRefresh() })
    } else {
      fetch(`/api/themes/${themeId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_id: capturedNoteId }),
      }).then(() => { setRecentlyDroppedNoteId(capturedNoteId); setTimeout(() => setRecentlyDroppedNoteId(null), 900); onRefresh() })
    }
  }

  function handleDropUngrouped() {
    if (!drag || !drag.sourceThemeId || !isEditor) { clearDrag(); return }
    const capturedSourceThemeId = drag.sourceThemeId
    if (drag.type === 'group') {
      const capturedGroupNotes = drag.groupNotes
      clearDrag()
      Promise.all(capturedGroupNotes.map(note =>
        fetch(`/api/themes/${capturedSourceThemeId}/notes?noteId=${note.id}`, { method: 'DELETE' })
      )).then(() => onRefresh())
    } else {
      const capturedNoteId = drag.id
      const note = sharedNotes.find(n => n.id === capturedNoteId)
      const themeIds = (note?.theme_ids && note.theme_ids.length > 0) ? note.theme_ids : [capturedSourceThemeId]
      clearDrag()
      Promise.all(themeIds.map(tid =>
        fetch(`/api/themes/${tid}/notes?noteId=${capturedNoteId}`, { method: 'DELETE' })
      )).then(() => {
        setRecentlyDroppedNoteId(capturedNoteId)
        setTimeout(() => setRecentlyDroppedNoteId(null), 900)
        onRefresh()
      })
    }
  }

  function clearThemeDragState() {
    setDragThemeId(null)
    setDragOverThemeInsertIdx(null)
  }

  function handleThemeDrop() {
    if (!dragThemeId || dragOverThemeInsertIdx === null) { clearThemeDragState(); return }
    const fromIdx = orderedThemes.findIndex(t => t.id === dragThemeId)
    if (fromIdx === -1) { clearThemeDragState(); return }
    const adjustedTo = dragOverThemeInsertIdx > fromIdx ? dragOverThemeInsertIdx - 1 : dragOverThemeInsertIdx
    const newOrder = [...orderedThemes]
    newOrder.splice(fromIdx, 1)
    newOrder.splice(adjustedTo, 0, orderedThemes[fromIdx])
    const newIds = newOrder.map(t => t.id)
    setThemeOrder(newIds)
    clearThemeDragState()
    fetch('/api/themes/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, theme_ids: newIds }),
    }).then(() => onRefresh())
  }

  const hasFilter = filterInterview || filterTag || filterQuestion || filterUser

  return (
    <>
    {aiClustering && <TraceyModal message={`Clustering your notes into themes…${aiProvider ? ` · ${aiProvider}` : ''}`} />}
    <div className="flex flex-col" style={{ height: 'calc(100vh - 140px)' }}>
      {/* Progress bar + controls */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-600">Notes clustered</span>
                <span className={`text-xs font-semibold ${clusterPct >= 70 ? 'text-green-600' : 'text-gray-500'}`}>
                  {sharedClustered}/{sharedTotal} notes ({clusterPct}%)
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
        <div
          className={[
            'w-[304px] flex-shrink-0 border-r overflow-y-auto transition-colors',
            dragOverUngrouped && drag?.sourceThemeId
              ? 'bg-blue-50 border-blue-300'
              : 'bg-gray-50 border-gray-200',
          ].join(' ')}
          onDragOver={e => { if (drag?.sourceThemeId) { e.preventDefault(); setDragOverUngrouped(true) } }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverUngrouped(false) }}
          onDrop={handleDropUngrouped}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Ungrouped ({hasFilter ? `${ungrouped.length} of ${allUngrouped.length}` : allUngrouped.length})
              </h3>
              {hasFilter && (
                <button
                  onClick={() => { setFilterInterview(''); setFilterTag(''); setFilterQuestion('') }}
                  className="text-[10px] text-blue-500 hover:text-blue-700"
                >
                  Clear
                </button>
              )}
            </div>
            {(allInterviews.length > 0 || allTags.length > 0 || allUsers.length > 1) && (
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
                {activeQuestions.length > 0 && (
                  <select
                    value={filterQuestion}
                    onChange={e => setFilterQuestion(e.target.value)}
                    className={`w-full text-xs px-2 py-1.5 rounded-md border focus:outline-none focus:ring-1 focus:ring-indigo-400 ${
                      filterQuestion ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-500'
                    }`}
                  >
                    <option value="">All questions</option>
                    {activeQuestions.map(q => (
                      <option key={q.id} value={q.id}>{q.text}</option>
                    ))}
                  </select>
                )}
                {allUsers.length > 1 && (
                  <select
                    value={filterUser}
                    onChange={e => setFilterUser(e.target.value)}
                    className={`w-full text-xs px-2 py-1.5 rounded-md border focus:outline-none focus:ring-1 focus:ring-violet-400 ${
                      filterUser ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-gray-200 bg-white text-gray-500'
                    }`}
                  >
                    <option value="">All members</option>
                    {allUsers.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
            <div className="space-y-2">
              {ungroupedItems.map(item => {
                if (item.type === 'group') {
                  const groupNotes = ungroupedGroupMap.get(item.groupId) ?? []
                  const isExpanded = expandedUngroupedGroupIds.has(item.groupId)
                  const isDraggingThisGroup = drag?.type === 'group' && drag.id === item.groupId
                  return (
                    <div
                      key={item.groupId}
                      className="relative"
                      draggable={isEditor}
                      onDragStart={() => setDrag({ type: 'group', id: item.groupId, groupNotes, sourceThemeId: null })}
                      onDragEnd={clearDrag}
                    >
                      <div className={[
                        'bg-white border border-gray-200 rounded-lg overflow-hidden select-none transition-all',
                        isDraggingThisGroup ? 'opacity-30 saturate-0' : '',
                        isEditor ? 'cursor-grab active:cursor-grabbing' : '',
                      ].join(' ')}>
                        <div
                          className="px-3 pt-3 pb-2 flex items-center justify-between gap-2"
                          onClick={() => setExpandedUngroupedGroupIds(prev => {
                            const next = new Set(prev)
                            next.has(item.groupId) ? next.delete(item.groupId) : next.add(item.groupId)
                            return next
                          })}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 flex-shrink-0">
                              Duplicate capture
                            </span>
                            <span className="text-[11px] text-gray-400 flex-shrink-0">×{groupNotes.length}</span>
                          </div>
                          <svg className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform cursor-pointer ${isExpanded ? 'rotate-180' : ''}`}
                            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>
                        {!isExpanded && (
                          <div className="px-3 pb-3">
                            {groupNotes[0]?.interview_name && (
                              <span className="text-[11px] text-blue-600 bg-blue-50 rounded-full px-2 py-0.5 inline-block mb-1.5">
                                {groupNotes[0].interview_name}
                              </span>
                            )}
                            <p className="text-sm text-gray-800 leading-relaxed break-words">{groupNotes[0]?.content}</p>
                          </div>
                        )}
                        {isExpanded && (
                          <div className="border-t border-gray-100 divide-y divide-gray-100">
                            {groupNotes.map(note => (
                              <div key={note.id} className="p-3">
                                {note.display_number && (
                                  <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                                    Note {note.display_number}
                                  </span>
                                )}
                                <p className="text-xs text-gray-700 leading-relaxed break-words">{note.content}</p>
                                {(note.interview_name || note.evidence_type || note.guide_question_text) && (
                                  <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
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
                                    {note.guide_question_text && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 truncate max-w-[200px]" title={note.guide_question_text}>
                                        {note.guide_question_text}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }
                const note = item.note
                return (
                  <div
                    key={note.id}
                    draggable={isEditor}
                    onDragStart={() => setDrag({ type: 'note', id: note.id, sourceThemeId: null })}
                    onDragEnd={clearDrag}
                    className={[
                      'bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-700 leading-relaxed select-none transition-all duration-300',
                      isEditor ? 'cursor-grab active:cursor-grabbing' : '',
                      drag?.type === 'note' && drag.id === note.id ? 'opacity-30 saturate-0 border-dashed border-blue-300' : drag ? '' : 'hover:shadow-sm',
                    ].join(' ')}
                  >
                    {note.display_number && (
                      <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                        Note {note.display_number}
                      </span>
                    )}
                    <p className="leading-relaxed break-words">{note.content}</p>
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
                        {note.guide_question_text && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 truncate max-w-[140px]" title={note.guide_question_text}>
                            {note.guide_question_text}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
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
        <div ref={scrollContainerRef} className={`flex-1 bg-gray-100 ${expandedThemeId ? 'overflow-hidden flex flex-col' : 'overflow-x-auto overflow-y-auto'}`}>
          {themes.length === 0 && !isEditor ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <div className="text-3xl mb-3">🗂</div>
                <p className="text-sm text-gray-500">No themes yet.</p>
              </div>
            </div>
          ) : (
            <div className={`flex gap-4 p-4 ${expandedThemeId ? 'flex-1 overflow-hidden' : 'items-start min-h-full'}`}>
              {orderedThemes.filter(t => !expandedThemeId || t.id === expandedThemeId).map((theme, themeIdx) => {
                const themeItems = buildThemeItems(theme.id)
                const isOver = dragOverThemeId === theme.id && !dragThemeId

                return (
                  <Fragment key={theme.id}>
                    {/* Insert indicator before this column */}
                    {dragThemeId && dragOverThemeInsertIdx === themeIdx && (
                      <div className="w-0.5 self-stretch bg-blue-500 rounded-full flex-shrink-0" />
                    )}
                  <div
                    className={[
                      expandedThemeId === theme.id
                        ? 'bg-white border rounded-xl flex-1 min-w-0 flex flex-col overflow-hidden'
                        : 'bg-white border rounded-xl w-[304px] flex-shrink-0 flex flex-col min-h-[160px] transition-all',
                      dragThemeId === theme.id
                        ? 'opacity-40 border-dashed border-gray-300'
                        : isOver ? 'border-blue-400 shadow-[inset_0_0_0_1px_#60a5fa]' : 'border-gray-200',
                    ].join(' ')}
                    draggable={isEditor && !expandedThemeId}
                    onDragStart={e => {
                      setDragThemeId(theme.id)
                      const col = e.currentTarget as HTMLElement
                      const rect = col.getBoundingClientRect()
                      e.dataTransfer.setDragImage(col, e.clientX - rect.left, e.clientY - rect.top)
                    }}
                    onDragEnd={clearThemeDragState}
                    onDragOver={e => {
                      e.preventDefault()
                      if (dragThemeId) {
                        if (dragThemeId === theme.id) return
                        const fromIdx = orderedThemes.findIndex(t => t.id === dragThemeId)
                        setDragOverThemeInsertIdx(fromIdx < themeIdx ? themeIdx + 1 : themeIdx)
                      } else {
                        setDragOverThemeId(theme.id)
                        // Only reset to "end" when entering a new column — don't override
                        // the precise per-card insert position while the cursor is over a card
                        if (insertPoint?.themeId !== theme.id) {
                          setInsertPoint({ themeId: theme.id, index: themeItems.length })
                        }
                      }
                    }}
                    onDragLeave={e => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        if (dragThemeId) {
                          setDragOverThemeInsertIdx(null)
                        } else {
                          setDragOverThemeId(null)
                          setInsertPoint(null)
                        }
                      }
                    }}
                    onDrop={() => {
                      if (dragThemeId) {
                        handleThemeDrop()
                      } else {
                        handleDrop(theme.id)
                      }
                    }}
                  >
                    <div
                      className={`group px-4 pt-3 pb-1.5 flex flex-col gap-1 ${isEditor && !expandedThemeId ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    >
                      {/* Row 1: label • count + expand + delete */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                          {theme.display_number ? `Theme ${theme.display_number}` : 'Theme'}
                          {' · '}
                          {themeItems.length} {themeItems.length === 1 ? 'item' : 'items'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isEditor && (
                            <div className="relative">
                              <button
                                onClick={e => { e.stopPropagation(); setOpenMenuThemeId(openMenuThemeId === theme.id ? null : theme.id) }}
                                className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
                                title="Theme options"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                  <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
                                </svg>
                              </button>
                              {openMenuThemeId === theme.id && (
                                <>
                                  <div className="fixed inset-0 z-10" onClick={() => setOpenMenuThemeId(null)} />
                                  <div className="absolute right-0 top-7 z-20 w-52 bg-white border border-gray-200 rounded-xl shadow-lg py-1 overflow-hidden" onClick={e => e.stopPropagation()}>
                                    {/* Expand / Collapse */}
                                    {expandedThemeId !== theme.id ? (
                                      <button
                                        onClick={() => {
                                          savedScrollLeft.current = scrollContainerRef.current?.scrollLeft ?? 0
                                          setExpandedThemeId(theme.id)
                                          setOpenMenuThemeId(null)
                                        }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                                      >
                                        <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                                          <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
                                        </svg>
                                        Expand
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          setExpandedThemeId(null)
                                          setOpenMenuThemeId(null)
                                          requestAnimationFrame(() => {
                                            if (scrollContainerRef.current) scrollContainerRef.current.scrollLeft = savedScrollLeft.current
                                          })
                                        }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                                      >
                                        <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
                                          <line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/>
                                        </svg>
                                        Collapse
                                      </button>
                                    )}
                                    <div className="my-1 border-t border-gray-100" />
                                    {/* Sort options */}
                                    <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Sort by</p>
                                    {([
                                      { mode: 'note_id', label: 'Note ID', icon: <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></> },
                                      { mode: 'participant', label: 'Participant', icon: <><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></> },
                                      { mode: 'evidence_type', label: 'Evidence type', icon: <><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></> },
                                      { mode: 'date_added', label: 'Date added', icon: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></> },
                                    ] as { mode: SortMode; label: string; icon: React.ReactNode }[]).map(({ mode, label, icon }) => (
                                      <button
                                        key={mode}
                                        onClick={() => setThemeSort(theme.id, mode)}
                                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${themeSortMode[theme.id] === mode ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'}`}
                                      >
                                        <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          {icon}
                                        </svg>
                                        {label}
                                        {themeSortMode[theme.id] === mode && (
                                          <svg className="w-3 h-3 ml-auto text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                        )}
                                      </button>
                                    ))}
                                    <div className="my-1 border-t border-gray-100" />
                                    {/* Delete */}
                                    <button
                                      onClick={() => { setConfirmDeleteThemeId(theme.id); setOpenMenuThemeId(null) }}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"
                                    >
                                      <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                                      </svg>
                                      Delete theme
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Row 2: title */}
                      {isEditor && editingThemeId === theme.id ? (
                        <div>
                          <input
                            autoFocus
                            value={editingThemeTitle}
                            onChange={e => { setEditingThemeTitle(e.target.value); setThemeNameError('') }}
                            onBlur={() => renameTheme(theme.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); renameTheme(theme.id) }
                              if (e.key === 'Escape') { setEditingThemeId(null); setThemeNameError('') }
                            }}
                            className={`w-full font-semibold text-sm text-gray-800 bg-transparent border-b outline-none leading-tight ${themeNameError ? 'border-red-400' : 'border-blue-400'}`}
                          />
                          {themeNameError && <p className="text-[11px] text-red-500 mt-1">{themeNameError}</p>}
                        </div>
                      ) : (
                        <h4
                          className={`font-semibold text-sm text-gray-800 leading-tight truncate ${isEditor ? 'cursor-text hover:text-blue-600' : ''}`}
                          onClick={() => { if (isEditor) { setEditingThemeId(theme.id); setEditingThemeTitle(theme.title) } }}
                        >
                          {theme.title}
                        </h4>
                      )}
                      <div className="mt-2 h-px bg-gray-200" />
                    </div>
                    <div
                      className={expandedThemeId === theme.id
                        ? 'grid grid-cols-2 xl:grid-cols-3 gap-3 p-4 items-start overflow-y-auto flex-1'
                        : 'px-3 pt-2 pb-3 flex flex-col gap-2 flex-1'
                      }>
                      {themeItems.map((item, itemIdx) => {
                        const isGridMode = expandedThemeId === theme.id
                        const isDragging = drag !== null && !dragThemeId
                        const showBefore = isDragging &&
                          insertPoint?.themeId === theme.id && insertPoint.index === itemIdx
                        const showAfter = isDragging &&
                          insertPoint?.themeId === theme.id &&
                          insertPoint.index === itemIdx + 1 &&
                          itemIdx === themeItems.length - 1

                        if (item.type === 'group') {
                          const isExpanded = expandedThemeGroupIds.has(item.groupId)
                          const isDraggingThis = drag?.type === 'group' && drag.id === item.groupId
                          return (
                            <div key={item.groupId} className="relative">
                              {showBefore && (
                                <div className={`absolute z-10 pointer-events-none bg-blue-400 rounded-full ${isGridMode ? 'inset-y-0 -left-[5px] w-0.5' : 'inset-x-0 -top-[5px] h-0.5'}`} />
                              )}
                              {showAfter && (
                                <div className={`absolute z-10 pointer-events-none bg-blue-400 rounded-full ${isGridMode ? 'inset-y-0 -right-[5px] w-0.5' : 'inset-x-0 -bottom-[5px] h-0.5'}`} />
                              )}
                              <div
                                className="relative group/gcard"
                                draggable={isEditor}
                                onDragStart={e => {
                                  e.stopPropagation()
                                  setDrag({ type: 'group', id: item.groupId, groupNotes: item.groupNotes, sourceThemeId: theme.id })
                                }}
                                onDragEnd={clearDrag}
                                onDragOver={e => handleItemDragOver(e, theme.id, itemIdx)}
                              >
                                <div className={[
                                  'border rounded-lg overflow-hidden select-none transition-all duration-200',
                                  isEditor ? 'cursor-grab active:cursor-grabbing' : '',
                                  isDraggingThis
                                    ? 'bg-gray-50 border-gray-100 opacity-30 saturate-0'
                                    : drag
                                      ? 'bg-gray-50 border-gray-100 opacity-90'
                                      : 'bg-gray-50 border-gray-100 hover:bg-white hover:border-gray-200 hover:shadow-sm',
                                ].join(' ')}>
                                  <div
                                    className="px-3 pt-2.5 pb-2 flex items-center justify-between gap-2 cursor-pointer"
                                    onClick={() => setExpandedThemeGroupIds(prev => {
                                      const next = new Set(prev)
                                      next.has(item.groupId) ? next.delete(item.groupId) : next.add(item.groupId)
                                      return next
                                    })}
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 flex-shrink-0">
                                        Duplicate capture
                                      </span>
                                      <span className="text-[11px] text-gray-400 flex-shrink-0">×{item.groupNotes.length}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      {isEditor && (
                                        <button
                                          onClick={async e => {
                                            e.stopPropagation()
                                            await Promise.all(item.groupNotes.map(n =>
                                              fetch(`/api/themes/${theme.id}/notes?noteId=${n.id}`, { method: 'DELETE' })
                                            ))
                                            onRefresh()
                                          }}
                                          className={`text-gray-300 hover:text-gray-600 transition-colors ${drag ? 'opacity-0' : 'opacity-0 group-hover/gcard:opacity-100'}`}
                                          title="Remove group from theme"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="9 10 4 15 9 20"/>
                                            <path d="M20 4v7a4 4 0 0 1-4 4H4"/>
                                          </svg>
                                        </button>
                                      )}
                                      <svg className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="6 9 12 15 18 9" />
                                      </svg>
                                    </div>
                                  </div>
                                  {!isExpanded && (
                                    <div className="px-3 pb-2.5">
                                      {item.groupNotes[0]?.interview_name && (
                                        <span className="text-[11px] text-blue-600 bg-blue-50 rounded-full px-2 py-0.5 inline-block mb-1.5">
                                          {item.groupNotes[0].interview_name}
                                        </span>
                                      )}
                                      <p className="text-sm text-gray-800 leading-relaxed break-words">{item.groupNotes[0]?.content}</p>
                                    </div>
                                  )}
                                  {isExpanded && (
                                    <div className="border-t border-gray-100 divide-y divide-gray-100">
                                      {item.groupNotes.map(gNote => (
                                        <div key={gNote.id} className="p-2.5">
                                          {gNote.display_number && (
                                            <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                                              Note {gNote.display_number}
                                            </span>
                                          )}
                                          <p className="text-sm text-gray-700 leading-relaxed break-words">{gNote.content}</p>
                                          {(gNote.interview_name || gNote.evidence_type || gNote.guide_question_text) && (
                                            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                                              {gNote.interview_name && (
                                                <span className="text-[11px] text-blue-600 bg-blue-50 rounded-full px-2 py-0.5">
                                                  {gNote.interview_name}
                                                </span>
                                              )}
                                              {gNote.evidence_type && (
                                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                                  gNote.evidence_type === 'quote' ? 'bg-blue-100 text-blue-700' :
                                                  gNote.evidence_type === 'observation' ? 'bg-purple-100 text-purple-700' :
                                                  gNote.evidence_type === 'pain_point' ? 'bg-rose-100 text-rose-700' :
                                                  'bg-amber-100 text-amber-700'
                                                }`}>
                                                  {gNote.evidence_type === 'pain_point' ? 'Pain Point' :
                                                   gNote.evidence_type.charAt(0).toUpperCase() + gNote.evidence_type.slice(1)}
                                                </span>
                                              )}
                                              {gNote.guide_question_text && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 truncate max-w-[150px]" title={gNote.guide_question_text}>
                                                  {gNote.guide_question_text}
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        }

                        const note = item.note
                        const isDropped = recentlyDroppedNoteId === note.id

                        return (
                          <div key={note.id} className="relative">
                            {showBefore && (
                              <div className={`absolute z-10 pointer-events-none bg-blue-400 rounded-full ${isGridMode ? 'inset-y-0 -left-[5px] w-0.5' : 'inset-x-0 -top-[5px] h-0.5'}`} />
                            )}
                            {showAfter && (
                              <div className={`absolute z-10 pointer-events-none bg-blue-400 rounded-full ${isGridMode ? 'inset-y-0 -right-[5px] w-0.5' : 'inset-x-0 -bottom-[5px] h-0.5'}`} />
                            )}
                            <div
                              draggable={isEditor}
                              onDragStart={e => {
                                e.stopPropagation()
                                const ghost = e.currentTarget.cloneNode(true) as HTMLElement
                                ghost.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:' + e.currentTarget.offsetWidth + 'px;opacity:1;'
                                document.body.appendChild(ghost)
                                e.dataTransfer.setDragImage(ghost, e.nativeEvent.offsetX, e.nativeEvent.offsetY)
                                setTimeout(() => document.body.removeChild(ghost), 0)
                                setDrag({ type: 'note', id: note.id, sourceThemeId: theme.id })
                              }}
                              onDragEnd={clearDrag}
                              onDragOver={e => handleItemDragOver(e, theme.id, itemIdx)}
                              className={[
                                'border rounded-lg p-2.5 text-sm text-gray-700 group relative transition-all duration-200',
                                isEditor ? 'cursor-grab active:cursor-grabbing' : '',
                                isDropped
                                  ? 'bg-blue-50 border-blue-300 shadow-sm shadow-blue-100'
                                  : drag?.type === 'note' && drag.id === note.id
                                    ? 'bg-gray-50 border-gray-100 opacity-30 saturate-0 border-dashed border-blue-300'
                                    : drag
                                      ? 'bg-gray-50 border-gray-100 opacity-90'
                                      : 'bg-gray-50 border-gray-100 hover:bg-white hover:border-gray-200 hover:shadow-sm',
                              ].join(' ')}
                            >
                              {note.display_number && (
                                <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                                  Note {note.display_number}
                                </span>
                              )}
                              <p className="leading-relaxed pr-4 break-words">{note.content}</p>
                              {(note.interview_name || note.evidence_type || note.guide_question_text) && (
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
                                  {note.guide_question_text && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 truncate max-w-[120px]" title={note.guide_question_text}>
                                      {note.guide_question_text}
                                    </span>
                                  )}
                                </div>
                              )}
                              {isEditor && (
                                <button
                                  onClick={() => detachNote(theme.id, note.id)}
                                  className={`absolute top-1.5 right-1.5 text-gray-300 hover:text-gray-600 transition-colors ${drag ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}
                                  title="Remove from theme"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="9 10 4 15 9 20"/>
                                    <path d="M20 4v7a4 4 0 0 1-4 4H4"/>
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}

                      {themeItems.length === 0 && (
                        isOver
                          ? <div className="border-2 border-dashed border-blue-500 bg-blue-50 rounded-lg h-16" />
                          : <p className="text-xs text-gray-300 text-center py-4">Drop notes here</p>
                      )}
                    </div>
                  </div>
                  </Fragment>
                )
              })}

              {/* Insert indicator at end when dragging a column to last position */}
              {dragThemeId && dragOverThemeInsertIdx === orderedThemes.length && (
                <div className="w-0.5 self-stretch bg-blue-500 rounded-full flex-shrink-0" />
              )}

              {/* Add theme column — always last, editors only, hidden when a theme is expanded */}
              {isEditor && !expandedThemeId && (
                <div className="w-[304px] flex-shrink-0 pr-5">
                  {addingTheme ? (
                    <form
                      onSubmit={createTheme}
                      className="bg-white border-2 border-blue-400 rounded-xl p-3 flex flex-col gap-2 min-h-[120px]"
                    >
                      <input
                        autoFocus
                        type="text"
                        value={themeTitle}
                        onChange={e => { setThemeTitle(e.target.value); setThemeNameError('') }}
                        onKeyDown={e => { if (e.key === 'Escape') { setAddingTheme(false); setThemeTitle(''); setThemeNameError('') } }}
                        placeholder="Theme name..."
                        className={`px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 bg-white ${themeNameError ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-blue-400'}`}
                      />
                      {themeNameError && <p className="text-xs text-red-500 -mt-1">{themeNameError}</p>}
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={loading || !themeTitle.trim()}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAddingTheme(false); setThemeTitle('') }}
                          className="px-3 py-1.5 text-gray-500 text-sm hover:text-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      onClick={() => setAddingTheme(true)}
                      onDragOver={e => { if (drag) { e.preventDefault(); setDragOverAddTheme(true) } }}
                      onDragLeave={() => setDragOverAddTheme(false)}
                      onDrop={handleDropOnAddTheme}
                      className={`w-full min-h-[120px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all ${
                        dragOverAddTheme
                          ? 'border-blue-400 bg-blue-50 text-blue-500'
                          : drag
                          ? 'border-blue-300 bg-blue-50/50 text-blue-400'
                          : 'border-gray-200 text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50'
                      }`}
                    >
                      <span className="text-xl leading-none">+</span>
                      <span className="text-xs font-medium">{dragOverAddTheme ? 'Drop to create theme' : 'Add theme'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>

      {confirmDeleteThemeId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setConfirmDeleteThemeId(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-gray-900 mb-1">Delete theme?</h2>
            <p className="text-sm text-gray-500 mb-5">Notes in this theme will be ungrouped.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDeleteThemeId(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteTheme}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
              >
                Delete theme
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
