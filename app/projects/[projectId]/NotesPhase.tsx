'use client'

import { useState } from 'react'
import type { Note, Interview, GuideQuestion } from '@/lib/types'
import NoteCard from './NoteCard'
import NoteEditModal from './NoteEditModal'

interface Props {
  projectId: string
  captureGroupingEnabled: boolean
  currentUserId: string
  notes: Note[]
  interviews: Interview[]
  isEditor: boolean
  guideQuestions?: GuideQuestion[]
  anonymisationEnabled?: boolean
  onRefresh: () => void
}

export default function NotesPhase({ projectId, captureGroupingEnabled, currentUserId, notes, interviews, isEditor, guideQuestions, anonymisationEnabled = false, onRefresh }: Props) {
  const [filterInterview, setFilterInterview] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterQuestion, setFilterQuestion] = useState('')
  const [editingNote, setEditingNote] = useState<Note | null>(null)

  // Multi-select state
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set())
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set())
  const [groupError, setGroupError] = useState('')
  const [grouping, setGrouping] = useState(false)

  const allTags = [...new Set(notes.flatMap(n => n.tags ?? []))]
  const allInterviews = [...new Set(notes.map(n => n.interview_name).filter(Boolean))] as string[]
  const hasImported = notes.some(n => n.source_type === 'url_import')
  const activeQuestions = (guideQuestions ?? []).filter(q => notes.some(n => n.guide_question_id === q.id))

  const filtered = notes
    .filter(n => {
      if (n.visibility === 'private') return false
      if (filterInterview && n.interview_name !== filterInterview) return false
      if (filterTag && !n.tags?.includes(filterTag)) return false
      if (filterSource === 'imported' && n.source_type !== 'url_import') return false
      if (filterQuestion && n.guide_question_id !== filterQuestion) return false
      return true
    })
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const hasFilter = filterInterview || filterTag || filterSource || filterQuestion

  // Build render list: groups collapsed to single item, ungrouped notes individual
  // Preserve original creation-time order using first note in each group
  const seenGroupIds = new Set<string>()
  const groupMap = new Map<string, Note[]>()
  const renderItems: Array<{ type: 'note'; note: Note } | { type: 'group'; groupId: string }> = []

  for (const note of filtered) {
    if (captureGroupingEnabled && note.capture_group_id) {
      const gid = note.capture_group_id
      if (!groupMap.has(gid)) groupMap.set(gid, [])
      groupMap.get(gid)!.push(note)
      if (!seenGroupIds.has(gid)) {
        seenGroupIds.add(gid)
        renderItems.push({ type: 'group', groupId: gid })
      }
    } else {
      renderItems.push({ type: 'note', note })
    }
  }

  function toggleSelect(noteId: string) {
    setSelectedNoteIds(prev => {
      const next = new Set(prev)
      if (next.has(noteId)) next.delete(noteId)
      else next.add(noteId)
      return next
    })
    setGroupError('')
  }

  function toggleSelectGroup(groupId: string) {
    setSelectedGroupId(prev => prev === groupId ? null : groupId)
    setGroupError('')
  }

  async function handleGroup() {
    const ids = [...selectedNoteIds]
    const selected = filtered.filter(n => ids.includes(n.id))
    const interviewIds = new Set(selected.map(n => n.interview_id))
    if (interviewIds.size > 1) {
      setGroupError('Duplicate grouping works only within a single interview.')
      return
    }
    setGrouping(true)
    setGroupError('')
    const res = await fetch('/api/capture-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, note_ids: ids }),
    })
    if (res.ok) {
      setSelectedNoteIds(new Set())
      setSelectedGroupId(null)
      onRefresh()
    } else {
      const d = await res.json()
      setGroupError(d.error || 'Grouping failed — try again')
    }
    setGrouping(false)
  }

  async function handleAddToGroup() {
    if (!selectedGroupId) return
    const ids = [...selectedNoteIds]
    const selected = filtered.filter(n => ids.includes(n.id))
    const groupNotes = groupMap.get(selectedGroupId) ?? []
    const groupInterviewId = groupNotes[0]?.interview_id
    if (selected.some(n => n.interview_id !== groupInterviewId)) {
      setGroupError('All notes must be from the same interview as the group.')
      return
    }
    setGrouping(true)
    setGroupError('')
    const results = await Promise.all(
      ids.map(noteId =>
        fetch(`/api/notes/${noteId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ capture_group_id: selectedGroupId }),
        })
      )
    )
    if (results.every(r => r.ok)) {
      setSelectedNoteIds(new Set())
      setSelectedGroupId(null)
      onRefresh()
    } else {
      setGroupError('Failed to add notes to group — try again')
    }
    setGrouping(false)
  }

  async function removeNoteFromGroup(noteId: string) {
    await fetch(`/api/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capture_group_id: null }),
    })
    onRefresh()
  }

  async function ungroupAll(groupId: string) {
    await fetch(`/api/capture-groups/${groupId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId }),
    })
    onRefresh()
  }

  async function deleteNote(id: string) {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-0.5">
            <h2 className="text-lg font-semibold">Notes</h2>
            {anonymisationEnabled && (
              <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                <span>🔒</span>
                <span>Analysis mode: Participants anonymised</span>
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5 mb-3">
            {hasImported
              ? 'Imported notes are ready to cluster. Review, edit or delete before moving to Themes.'
              : 'Capture observations and quotes. Need at least 10 notes, all linked to an interview.'}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {allInterviews.length > 0 && (
              <div className="relative">
                {groupError && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 z-10 pointer-events-none">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-blue-500" />
                  </span>
                )}
                <select
                  value={filterInterview}
                  onChange={e => { setFilterInterview(e.target.value); setGroupError(''); setSelectedNoteIds(new Set()); setSelectedGroupId(null) }}
                  className={`text-sm px-2.5 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                    filterInterview ? 'border-blue-400 bg-blue-50 text-blue-700' : groupError ? 'border-blue-400 bg-white text-gray-500' : 'border-gray-200 bg-white text-gray-500'
                  }`}
                >
                  <option value="">All interviews</option>
                  {allInterviews.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            )}
            {activeQuestions.length > 0 && (
              <select
                value={filterQuestion}
                onChange={e => setFilterQuestion(e.target.value)}
                className={`text-sm px-2.5 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-indigo-400 ${
                  filterQuestion ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-500'
                }`}
              >
                <option value="">All questions</option>
                {activeQuestions.map(q => (
                  <option key={q.id} value={q.id}>{q.text}</option>
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
              onClick={() => { setFilterInterview(''); setFilterTag(''); setFilterSource(''); setFilterQuestion('') }}
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
            {renderItems.map(item => {
              if (item.type === 'group') {
                const groupNotes = groupMap.get(item.groupId)!
                return (
                  <CaptureGroupCard
                    key={item.groupId}
                    groupId={item.groupId}
                    notes={groupNotes}
                    isExpanded={expandedGroupIds.has(item.groupId)}
                    isEditor={isEditor}
                    showCheckbox={captureGroupingEnabled && isEditor}
                    isSelected={selectedGroupId === item.groupId}
                    onSelect={() => toggleSelectGroup(item.groupId)}
                    onToggle={() => setExpandedGroupIds(prev => {
                      const next = new Set(prev)
                      if (next.has(item.groupId)) next.delete(item.groupId)
                      else next.add(item.groupId)
                      return next
                    })}
                    onRemoveNote={removeNoteFromGroup}
                    onUngroupAll={ungroupAll}
                  />
                )
              }

              const note = item.note
              const isSelected = selectedNoteIds.has(note.id)
              return (
                <div
                  key={note.id}
                  className="group/note relative"
                >
                  {captureGroupingEnabled && isEditor && (
                    <div
                      className={[
                        'absolute left-4 top-4 z-10 w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all duration-150',
                        isSelected
                          ? 'bg-blue-500 border-blue-500 opacity-100'
                          : 'bg-white border-gray-300 opacity-0 group-hover/note:opacity-100 group-hover/note:border-blue-400',
                      ].join(' ')}
                      onClick={e => { e.stopPropagation(); toggleSelect(note.id) }}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  )}
                  <div>
                    <NoteCard
                      note={note}
                      currentUserId={currentUserId}
                      isEditor={isEditor}
                      isSelected={isSelected}
                      onEdit={isEditor ? () => setEditingNote(note) : undefined}
                      showAuthor
                      showTimestamp
                      showGuideQuestion={!!guideQuestions?.length}
                      showId
                      selectNudge={captureGroupingEnabled && isEditor}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {editingNote && (
        <NoteEditModal
          note={editingNote}
          interviews={interviews}
          currentUserId={currentUserId}
          guideQuestions={guideQuestions?.length ? guideQuestions : undefined}
          onClose={() => setEditingNote(null)}
          onRefresh={onRefresh}
          onDelete={isEditor ? () => { deleteNote(editingNote.id); setEditingNote(null) } : undefined}
        />
      )}

      {/* Fixed bottom drawer */}
      {captureGroupingEnabled && isEditor && (
        <div
          className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out ${
            selectedNoteIds.size >= 2 || (selectedGroupId !== null && selectedNoteIds.size >= 1)
              ? 'translate-y-0'
              : 'translate-y-full'
          }`}
        >
          <div className="bg-white border-t border-gray-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
            <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">
                  {selectedGroupId ? 'Add to group' : 'Group duplicate capture'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedGroupId
                    ? 'Selected notes will be merged into the existing duplicate capture group.'
                    : 'Use when multiple notes refer to the same statement within one interview.'}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-gray-400">
                  {selectedNoteIds.size} note{selectedNoteIds.size !== 1 ? 's' : ''}
                  {selectedGroupId ? ' + 1 group' : ''}
                </span>
                <button
                  onClick={() => { setSelectedNoteIds(new Set()); setSelectedGroupId(null); setGroupError('') }}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Unselect all
                </button>
                <button
                  onClick={selectedGroupId ? handleAddToGroup : handleGroup}
                  disabled={grouping}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {grouping
                    ? (selectedGroupId ? 'Adding...' : 'Grouping...')
                    : (selectedGroupId ? 'Add to group →' : 'Group →')}
                </button>
                <button
                  onClick={() => { setSelectedNoteIds(new Set()); setSelectedGroupId(null); setGroupError('') }}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                  title="Cancel selection"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {groupError && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setGroupError('')}
        >
          <div
            className="animate-shake bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-gray-900 mb-1">Can't group these notes</h2>
            <p className="text-sm text-gray-500 mt-1">{groupError}</p>
            <p className="text-xs text-gray-400 mt-2">Use the participant filter to quickly see all notes from the same interview.</p>
            <div className="flex justify-end mt-5">
              <button
                onClick={() => setGroupError('')}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── CaptureGroupCard ─────────────────────────────────────────────────────────

interface CaptureGroupCardProps {
  groupId: string
  notes: Note[]
  isExpanded: boolean
  isEditor: boolean
  showCheckbox?: boolean
  isSelected?: boolean
  onSelect?: () => void
  onToggle: () => void
  onRemoveNote: (noteId: string) => void
  onUngroupAll: (groupId: string) => void
}

function CaptureGroupCard({ groupId, notes, isExpanded, isEditor, showCheckbox, isSelected, onSelect, onToggle, onRemoveNote, onUngroupAll }: CaptureGroupCardProps) {
  return (
    <div className={`group/capture-card relative border rounded-xl overflow-hidden transition-all ${isSelected ? 'bg-white border-blue-500 ring-2 ring-blue-500' : 'bg-white border-gray-200 hover:border-blue-400 hover:ring-1 hover:ring-blue-400'}`}>
        {/* Checkbox overlay */}
        {showCheckbox && (
          <div
            className={[
              'absolute left-4 top-4 z-10 w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all duration-150',
              isSelected
                ? 'bg-blue-500 border-blue-500 opacity-100'
                : 'bg-white border-gray-300 opacity-0 group-hover/capture-card:opacity-100 group-hover/capture-card:border-blue-400',
            ].join(' ')}
            onClick={e => { e.stopPropagation(); onSelect?.() }}
          >
            {isSelected && (
              <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        )}
        {/* Header */}
        <div
          className="p-4 flex items-center justify-between gap-2 cursor-pointer"
          onClick={onToggle}
        >
          <div className={`flex items-center gap-2 min-w-0 transition-all duration-150 ${isSelected ? 'pl-6' : showCheckbox ? 'group-hover/capture-card:pl-6' : ''}`}>
            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 flex-shrink-0 uppercase tracking-wide">
              Duplicate capture
            </span>
            {notes[0]?.interview_name && (
              <span className="text-[11px] text-blue-600 bg-blue-50 rounded-full px-2 py-0.5 truncate max-w-[120px]">
                {notes[0].interview_name}
              </span>
            )}
            <span className="text-[11px] text-gray-400 flex-shrink-0">×{notes.length}</span>
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {/* Collapsed: full note preview with tags */}
        {!isExpanded && notes[0] && (
          <div className="px-4 pb-4 pt-3 border-t border-gray-100">
            {notes[0].display_number && (
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                Note {notes[0].display_number}
              </p>
            )}
            <p className="text-sm text-gray-700 leading-relaxed break-words">{notes[0].content}</p>
            {(notes[0].evidence_type || notes[0].guide_question_text) && (
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                {notes[0].evidence_type && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    notes[0].evidence_type === 'quote' ? 'bg-blue-100 text-blue-700' :
                    notes[0].evidence_type === 'observation' ? 'bg-purple-100 text-purple-700' :
                    notes[0].evidence_type === 'pain_point' ? 'bg-rose-100 text-rose-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {notes[0].evidence_type === 'pain_point' ? 'Pain Point' :
                      notes[0].evidence_type.charAt(0).toUpperCase() + notes[0].evidence_type.slice(1)}
                  </span>
                )}
                {notes[0].guide_question_text && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 truncate max-w-[200px]" title={notes[0].guide_question_text}>
                    {notes[0].guide_question_text}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Expanded: all notes stacked */}
        {isExpanded && (
          <div className="border-t border-gray-100 divide-y divide-gray-100">
            {notes.map(note => (
              <div key={note.id} className="p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-gray-400">
                    {note.creator_name && `${note.creator_name} · `}
                    {new Date(note.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                  </span>
                  {isEditor && (
                    <button
                      onClick={() => onRemoveNote(note.id)}
                      className="text-[11px] text-gray-300 hover:text-red-500 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {note.display_number && (
                  <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                    Note {note.display_number}
                  </span>
                )}
                <p className="text-sm text-gray-800 leading-relaxed break-words">{note.content}</p>
                {(note.evidence_type || note.guide_question_text) && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
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
            {isEditor && (
              <div className="px-4 py-3 bg-gray-50">
                <button
                  onClick={() => onUngroupAll(groupId)}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Ungroup all
                </button>
              </div>
            )}
          </div>
        )}
      </div>
  )
}
