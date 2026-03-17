'use client'

import { useState, Fragment } from 'react'
import type { Interview, GuideQuestion } from '@/lib/types'
import InterviewDrawer from './InterviewDrawer'
import DeleteInterviewModal from './DeleteInterviewModal'

interface Props {
  projectId: string
  interviews: Interview[]
  isEditor: boolean
  hasGuide: boolean
  guideQuestions: GuideQuestion[]
  onRefresh: () => void
}

// ── Reusable question block (used in both edit and draft/creation contexts) ──
interface QuestionBlockProps {
  number: number
  text: string
  onChange?: (val: string) => void        // draft mode: editable input
  onDelete?: () => void
  draggable?: boolean
  dragHandle?: boolean
  isEditing?: boolean
  editText?: string
  onEditChange?: (val: string) => void
  onEditBlur?: () => void
  onEditKeyDown?: (e: React.KeyboardEvent) => void
  onStartEdit?: () => void
  isDragging?: boolean
  onDragStart?: () => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: () => void
  onDragEnd?: () => void
}

function QuestionBlock({
  number, text, onChange, onDelete,
  draggable: isDraggable, dragHandle,
  isEditing, editText, onEditChange, onEditBlur, onEditKeyDown, onStartEdit,
  isDragging,
  onDragStart, onDragOver, onDrop, onDragEnd,
}: QuestionBlockProps) {
  return (
    <div className={['group flex items-center gap-1', isDragging ? 'hidden' : ''].join(' ')}>
      <div
        draggable={isDraggable && !isEditing}
        onDragStart={onDragStart ? () => setTimeout(onDragStart, 0) : undefined}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        className={[
          'flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all',
          isDraggable ? 'cursor-grab active:cursor-grabbing' : '',
          'bg-gray-50 hover:bg-gray-100',
        ].join(' ')}
      >
        {/* Drag handle */}
        {dragHandle && (
          <span className="text-gray-300 group-hover:text-gray-400 flex-shrink-0 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="5" r="1.5"/>
              <circle cx="15" cy="5" r="1.5"/>
              <circle cx="9" cy="12" r="1.5"/>
              <circle cx="15" cy="12" r="1.5"/>
              <circle cx="9" cy="19" r="1.5"/>
              <circle cx="15" cy="19" r="1.5"/>
            </svg>
          </span>
        )}

        {/* Number */}
        <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0 font-mono">{number}.</span>

        {/* Draft mode: transparent inline input */}
        {onChange !== undefined ? (
          <input
            type="text"
            value={text}
            onChange={e => onChange(e.target.value)}
            placeholder={`Question ${number}`}
            className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
          />
        ) : isEditing ? (
          /* Edit mode */
          <input
            autoFocus
            value={editText}
            onChange={e => onEditChange?.(e.target.value)}
            onBlur={onEditBlur}
            onKeyDown={onEditKeyDown}
            className="flex-1 px-2 py-0.5 text-sm border border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        ) : (
          /* Display mode — click to edit inline */
          <p
            className={`flex-1 text-sm text-gray-700 leading-snug ${onStartEdit ? 'cursor-text' : ''}`}
            onClick={onStartEdit}
          >{text}</p>
        )}
      </div>

      {/* Delete button — outside the row, hover only */}
      {onDelete && !isEditing && (
        <button
          onClick={onDelete}
          className="text-gray-300 hover:text-red-400 text-lg leading-none transition-colors p-0.5 cursor-pointer flex-shrink-0 opacity-0 group-hover:opacity-100"
          title="Delete question"
        >
          ×
        </button>
      )}
    </div>
  )
}

export default function InterviewsPhase({ projectId, interviews, isEditor, hasGuide, guideQuestions, onRefresh }: Props) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [rawNotes, setRawNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [drawerInterview, setDrawerInterview] = useState<Interview | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Interview | null>(null)

  // Guide state
  const [guideExpanded, setGuideExpanded] = useState(true)
  const [settingUpGuide, setSettingUpGuide] = useState(false)
  const [draftQuestions, setDraftQuestions] = useState([{ text: '' }])
  const [creatingGuide, setCreatingGuide] = useState(false)
  const [addingQuestion, setAddingQuestion] = useState(false)
  const [newQuestionText, setNewQuestionText] = useState('')
  const [savingQuestion, setSavingQuestion] = useState(false)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
  const [editingQuestionText, setEditingQuestionText] = useState('')

  // Drag state — live guide
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragInsertPoint, setDragInsertPoint] = useState<{ questionId: string; before: boolean } | null>(null)

  // Drag state — creation wizard
  const [wizardDragIdx, setWizardDragIdx] = useState<number | null>(null)
  const [wizardInsertIdx, setWizardInsertIdx] = useState<number | null>(null)

  const nonCatchAll = guideQuestions.filter(q => !q.is_catch_all)

  function clearDragState() {
    setDraggedId(null)
    setDragInsertPoint(null)
  }

  function handleWizardDragOver(e: React.DragEvent, targetIdx: number) {
    e.preventDefault()
    if (wizardDragIdx === null || wizardDragIdx === targetIdx) return
    setWizardInsertIdx(wizardDragIdx < targetIdx ? targetIdx + 1 : targetIdx)
  }

  function handleWizardDrop() {
    if (wizardDragIdx === null || wizardInsertIdx === null) {
      setWizardDragIdx(null); setWizardInsertIdx(null); return
    }
    const adjustedTo = wizardInsertIdx > wizardDragIdx ? wizardInsertIdx - 1 : wizardInsertIdx
    const next = [...draftQuestions]
    const [item] = next.splice(wizardDragIdx, 1)
    next.splice(adjustedTo, 0, item)
    setDraftQuestions(next)
    setWizardDragIdx(null)
    setWizardInsertIdx(null)
  }

  function handleQuestionDragOver(e: React.DragEvent, questionId: string) {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const before = e.clientY < rect.top + rect.height / 2
    setDragInsertPoint({ questionId, before })
  }

  async function handleDrop() {
    if (!draggedId || !dragInsertPoint) { clearDragState(); return }
    const { questionId: targetId, before } = dragInsertPoint
    if (draggedId === targetId) { clearDragState(); return }

    const reordered = [...nonCatchAll]
    const fromIdx = reordered.findIndex(q => q.id === draggedId)
    if (fromIdx === -1) { clearDragState(); return }
    const [item] = reordered.splice(fromIdx, 1)
    const toIdx = reordered.findIndex(q => q.id === targetId)
    if (toIdx === -1) { clearDragState(); return }
    reordered.splice(before ? toIdx : toIdx + 1, 0, item)

    clearDragState()
    await Promise.all(
      reordered.map((q, i) =>
        fetch(`/api/projects/${projectId}/guide/questions/${q.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_index: i }),
        })
      )
    )
    onRefresh()
  }

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

  async function createGuide() {
    setCreatingGuide(true)
    const validQuestions = draftQuestions.filter(q => q.text.trim())
    await fetch(`/api/projects/${projectId}/guide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: validQuestions.map((q, i) => ({ text: q.text.trim(), order_index: i })) }),
    })
    setCreatingGuide(false)
    setSettingUpGuide(false)
    onRefresh()
  }

  async function addQuestion() {
    if (!newQuestionText.trim()) return
    setSavingQuestion(true)
    await fetch(`/api/projects/${projectId}/guide/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: newQuestionText.trim() }),
    })
    setSavingQuestion(false)
    setAddingQuestion(false)
    setNewQuestionText('')
    onRefresh()
  }

  async function saveQuestionEdit(q: GuideQuestion) {
    const trimmed = editingQuestionText.trim()
    setEditingQuestionId(null)
    if (!trimmed) return
    await fetch(`/api/projects/${projectId}/guide/questions/${q.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed }),
    })
    onRefresh()
  }

  async function deleteQuestion(q: GuideQuestion) {
    if (!confirm(`Delete question "${q.text}"? Notes linked to it will lose their badge.`)) return
    await fetch(`/api/projects/${projectId}/guide/questions/${q.id}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <>
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">

      {/* ── Discussion Guide section ─────────────────────────────── */}
      {(hasGuide || isEditor) && (
        <div>
          <div
            className="flex items-center justify-between cursor-pointer select-none mb-4"
            onClick={() => setGuideExpanded(e => !e)}
          >
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                Discussion Guide
                {hasGuide && (
                  <span className="text-xs font-normal text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">
                    {nonCatchAll.length} question{nonCatchAll.length !== 1 ? 's' : ''}
                  </span>
                )}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {hasGuide
                  ? isEditor
                    ? 'Manage the structured questions used during interviews.'
                    : 'Structured questions used during interviews.'
                  : 'Optionally add a structured question guide for your interviews.'}
              </p>
            </div>
            <span className="text-gray-400 text-sm">{guideExpanded ? '▾' : '▸'}</span>
          </div>

          {guideExpanded && (
            <>
              {/* No guide — empty state (editors only) */}
              {isEditor && !hasGuide && !settingUpGuide && (
                <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
                  <p className="text-gray-400 text-sm mb-3">No guide set up yet.</p>
                  <button
                    onClick={() => setSettingUpGuide(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    + Set up a discussion guide
                  </button>
                </div>
              )}

              {/* Draft question builder (creation, editors only) */}
              {isEditor && !hasGuide && settingUpGuide && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">Add the questions you plan to ask in your interviews. An &ldquo;Other observation&rdquo; catch-all will be added automatically.</p>
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="p-3 space-y-1">
                      {draftQuestions.map((q, i) => (
                        <Fragment key={i}>
                          {wizardInsertIdx === i && <div className="h-0.5 bg-blue-500 rounded-full" />}
                          <QuestionBlock
                            number={i + 1}
                            text={q.text}
                            onChange={val => {
                              const next = [...draftQuestions]
                              next[i] = { text: val }
                              setDraftQuestions(next)
                            }}
                            onDelete={draftQuestions.length > 1 ? () => setDraftQuestions(draftQuestions.filter((_, j) => j !== i)) : undefined}
                            draggable={true}
                            dragHandle={true}
                            isDragging={wizardDragIdx === i}
                            onDragStart={() => setWizardDragIdx(i)}
                            onDragOver={e => handleWizardDragOver(e, i)}
                            onDrop={handleWizardDrop}
                            onDragEnd={() => { setWizardDragIdx(null); setWizardInsertIdx(null) }}
                          />
                          {wizardInsertIdx === draftQuestions.length && i === draftQuestions.length - 1 && (
                            <div className="h-0.5 bg-blue-500 rounded-full" />
                          )}
                        </Fragment>
                      ))}
                    </div>
                    <div className="px-3 pb-3">
                      <button
                        onClick={() => setDraftQuestions([...draftQuestions, { text: '' }])}
                        className="text-sm text-indigo-600 hover:text-indigo-800"
                      >
                        + Add question
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={createGuide}
                      disabled={creatingGuide || !draftQuestions.some(q => q.text.trim())}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
                    >
                      {creatingGuide ? 'Creating...' : 'Create guide'}
                    </button>
                    <button
                      onClick={() => setSettingUpGuide(false)}
                      className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Existing guide */}
              {hasGuide && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="p-3 space-y-1">
                    {nonCatchAll.map((q, idx) => {
                      const showBefore = isEditor && dragInsertPoint?.questionId === q.id && dragInsertPoint.before && draggedId !== q.id
                      const showAfter = isEditor && dragInsertPoint?.questionId === q.id && !dragInsertPoint.before && draggedId !== q.id
                      return (
                        <Fragment key={q.id}>
                          {showBefore && <div className="h-0.5 bg-blue-500 rounded-full" />}
                          <QuestionBlock
                            number={idx + 1}
                            text={q.text}
                            draggable={isEditor}
                            dragHandle={isEditor}
                            isEditing={isEditor && editingQuestionId === q.id}
                            editText={editingQuestionText}
                            onEditChange={isEditor ? setEditingQuestionText : undefined}
                            onEditBlur={isEditor ? () => saveQuestionEdit(q) : undefined}
                            onEditKeyDown={isEditor ? e => {
                              if (e.key === 'Enter') { e.preventDefault(); saveQuestionEdit(q) }
                              if (e.key === 'Escape') setEditingQuestionId(null)
                            } : undefined}
                            onStartEdit={isEditor ? () => { setEditingQuestionId(q.id); setEditingQuestionText(q.text) } : undefined}
                            onDelete={isEditor ? () => deleteQuestion(q) : undefined}
                            isDragging={draggedId === q.id}
                            onDragStart={isEditor ? () => setDraggedId(q.id) : undefined}
                            onDragOver={isEditor ? e => handleQuestionDragOver(e, q.id) : undefined}
                            onDrop={isEditor ? handleDrop : undefined}
                            onDragEnd={isEditor ? clearDragState : undefined}
                          />
                          {showAfter && <div className="h-0.5 bg-blue-500 rounded-full" />}
                        </Fragment>
                      )
                    })}
                  </div>

                  {/* Add question (editors only) */}
                  {isEditor && (
                    <div className="px-3 pb-3">
                      {addingQuestion ? (
                        <div className="space-y-2">
                          <input
                            autoFocus
                            type="text"
                            value={newQuestionText}
                            onChange={e => setNewQuestionText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') addQuestion(); if (e.key === 'Escape') setAddingQuestion(false) }}
                            placeholder="Question text..."
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={addQuestion}
                              disabled={savingQuestion || !newQuestionText.trim()}
                              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
                            >
                              {savingQuestion ? 'Adding...' : 'Add'}
                            </button>
                            <button
                              onClick={() => { setAddingQuestion(false); setNewQuestionText('') }}
                              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAddingQuestion(true)}
                          className="text-sm text-indigo-600 hover:text-indigo-800"
                        >
                          + Add question
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Interviews section ───────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
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
          <form onSubmit={addInterview} className="bg-white border border-gray-200 rounded-xl p-5 mb-4 space-y-3">
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
                Description <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={rawNotes}
                onChange={e => setRawNotes(e.target.value)}
                placeholder="e.g. role, context, or any notes about this participant..."
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
                className={`bg-white border border-gray-200 rounded-xl p-5 transition-all ${isEditor ? 'cursor-pointer hover:border-blue-400 hover:ring-1 hover:ring-blue-400' : ''}`}
                onClick={isEditor ? () => setDrawerInterview(interview) : undefined}
              >
                {interview.display_number && (
                  <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                    Participant {interview.display_number}
                  </span>
                )}
                <h3 className="font-medium text-gray-900">{interview.participant_name}</h3>
                {interview.raw_notes && (
                  <p className="text-sm text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{interview.raw_notes}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(interview.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>

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
    </>
  )
}
