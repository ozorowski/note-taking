'use client'

import { useState, useEffect } from 'react'
import type { Insight, Theme, Note } from '@/lib/types'
import EntityDrawer from '@/components/EntityDrawer'
import TraceyModal from '@/components/TraceyModal'

type InsightWithIds = Insight & { theme_ids?: string[] }

interface InsightDraft {
  content: string
  root_cause: string | null
  iqs_score: number | null
  linked_theme_ids: string[]
  link_rationale: Record<string, string>
  supporting_note_ids: string[]
  needs_new_theme: boolean
  suggested_new_theme_name: string | null
}

interface Props {
  projectId: string
  insights: InsightWithIds[]
  themes: Theme[]
  notes: Note[]
  isEditor: boolean
  onRefresh: () => void
}

function IQSBadge({ score }: { score: number }) {
  if (score >= 75) return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">Strength {score}</span>
  )
  if (score >= 50) return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">⚠ Strength {score}</span>
  )
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">⚠ Strength {score}</span>
  )
}

export default function InsightsPhase({ projectId, insights, themes, notes, isEditor, onRefresh }: Props) {
  const [adding, setAdding] = useState(false)
  const [formMode, setFormMode] = useState<'structured' | 'freetext'>('structured')
  const [content, setContent] = useState('')
  const [structured, setStructured] = useState({ context: '', behaviour: '', cause: '', impact: '' })
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<InsightWithIds | null>(null)

  const [newInsightThemeIds, setNewInsightThemeIds] = useState<string[]>([])
  const [manualRootCause, setManualRootCause] = useState('')

  // AI generation state
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiDrafts, setAiDrafts] = useState<InsightDraft[]>([])
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set())
  const [draftError, setDraftError] = useState<string | null>(null)
  const [aiProvider, setAiProvider] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/ai/provider').then(r => r.json()).then(d => setAiProvider(d.provider)).catch(() => {})
  }, [])

  async function addInsight(e: React.FormEvent) {
    e.preventDefault()
    const finalContent = formMode === 'structured'
      ? `When ${structured.context.trim()}, ${structured.behaviour.trim()}, because ${structured.cause.trim()}, which leads to ${structured.impact.trim()}.`
      : content.trim()
    if (!finalContent.trim()) return
    const rawRc = formMode === 'structured' ? structured.cause.trim() : manualRootCause.trim()
    const rootCause = rawRc ? rawRc.charAt(0).toUpperCase() + rawRc.slice(1) : null
    setLoading(true)
    const res = await fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, content: finalContent, root_cause: rootCause }),
    })
    if (res.ok) {
      const insight = await res.json()
      await Promise.all(
        newInsightThemeIds.map(themeId =>
          fetch(`/api/insights/${insight.id}/themes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme_id: themeId }),
          })
        )
      )
      setContent('')
      setStructured({ context: '', behaviour: '', cause: '', impact: '' })
      setManualRootCause('')
      setNewInsightThemeIds([])
      setAdding(false)
      onRefresh()
    }
    setLoading(false)
  }

  async function deleteInsight(id: string) {
    await fetch(`/api/insights/${id}`, { method: 'DELETE' })
    if (selected?.id === id) setSelected(null)
    onRefresh()
  }

  function handleDrawerRefresh() {
    setSelected(null)
    onRefresh()
  }

  function toggleTheme(themeId: string) {
    setSelectedThemeIds(prev =>
      prev.includes(themeId) ? prev.filter(id => id !== themeId) : [...prev, themeId]
    )
  }

  async function generateDrafts() {
    if (selectedThemeIds.length === 0) return
    setAiLoading(true)
    setAiDrafts([])
    setAddedIndices(new Set())
    setDraftError(null)
    const res = await fetch('/api/ai/draft-insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, theme_ids: selectedThemeIds }),
    })
    const data = await res.json()
    if (res.ok) {
      setAiDrafts(data.drafts || [])
    } else {
      setDraftError(data.error || 'AI unavailable — try again later')
    }
    setAiLoading(false)
  }

  async function addDraftInsight(draft: InsightDraft, index: number) {
    setDraftError(null)
    const res = await fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        content: draft.content,
        root_cause: draft.root_cause,
        iqs_score: draft.iqs_score,
        supporting_note_ids: draft.supporting_note_ids.length > 0 ? draft.supporting_note_ids : null,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setDraftError(data.error || 'Failed to add insight — please try again')
      return
    }
    const insight = await res.json()
    const themeIdsToLink = draft.linked_theme_ids.length > 0 ? draft.linked_theme_ids : selectedThemeIds
    await Promise.all(
      themeIdsToLink.map(themeId =>
        fetch(`/api/insights/${insight.id}/themes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme_id: themeId }),
        })
      )
    )
    setAddedIndices(prev => new Set([...prev, index]))
    onRefresh()
  }

  function closeAiPanel() {
    setShowAiPanel(false)
    setSelectedThemeIds([])
    setAiDrafts([])
    setAddedIndices(new Set())
  }

  return (
    <>
    {aiLoading && <TraceyModal message={`Drafting insights from your data…${aiProvider ? ` · ${aiProvider}` : ''}`} />}
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Insights</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Synthesise patterns into key findings. Each insight must be linked to at least one theme.
        </p>
        {isEditor && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => { setAdding(v => !v); setShowAiPanel(false) }}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              + Add insight
            </button>
            <button
              onClick={() => { setShowAiPanel(v => !v); setAdding(false) }}
              className="px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium hover:bg-purple-100"
            >
              ✨ Ask Tracey to draft insights
            </button>
          </div>
        )}
      </div>

      {/* AI generation panel */}
      {showAiPanel && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 mb-5">
          <h3 className="text-sm font-semibold text-purple-800 mb-1">Ask Tracey to draft insights</h3>
          <p className="text-xs text-purple-600 mb-0.5">
            Pick themes → Tracey generates one insight per causal mechanism:
          </p>
          <p className="text-xs text-purple-500 italic mb-4">
            When [context], [participants] [behaviour], because [single root cause], which leads to [impact].
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {themes.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  selectedThemeIds.length === themes.length
                    ? setSelectedThemeIds([])
                    : setSelectedThemeIds(themes.map(t => t.id))
                }
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-purple-200 bg-white text-purple-500 hover:border-purple-400 transition-colors"
              >
                {selectedThemeIds.length === themes.length ? 'Deselect all' : 'Select all'}
              </button>
            )}
            {themes.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTheme(t.id)}
                className={[
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  selectedThemeIds.includes(t.id)
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-purple-700 border-purple-200 hover:border-purple-400',
                ].join(' ')}
              >
                {t.title}
              </button>
            ))}
            {themes.length === 0 && (
              <p className="text-xs text-purple-500">No themes yet — go back to the Themes phase first.</p>
            )}
          </div>
          <div className="flex gap-2 mb-4">
            <button
              onClick={generateDrafts}
              disabled={aiLoading || selectedThemeIds.length === 0}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-40"
            >
              {aiLoading ? 'Tracey is thinking...' : `Ask Tracey to generate from ${selectedThemeIds.length} theme${selectedThemeIds.length !== 1 ? 's' : ''}`}
            </button>
            <button onClick={closeAiPanel} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
              Close
            </button>
          </div>
          {draftError && (
            <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
              {draftError}
            </div>
          )}
          {aiDrafts.length > 0 && (
            <div className="space-y-3 border-t border-purple-200 pt-4">
              <p className="text-xs font-semibold text-purple-700">
                Tracey drafted {aiDrafts.length} insight{aiDrafts.length !== 1 ? 's' : ''} — review and add:
              </p>
              {aiDrafts.map((draft, i) => (
                <div key={i} className="bg-white border border-purple-200 rounded-lg p-4 space-y-2.5">
                  <p className="text-sm text-gray-700 leading-relaxed">{draft.content}</p>

                  {/* Needs new theme warning */}
                  {draft.needs_new_theme && (
                    <div className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-1.5">
                      ⚠ Doesn&apos;t fit selected themes well
                      {draft.suggested_new_theme_name && (
                        <> — suggests new theme: <strong>{draft.suggested_new_theme_name}</strong></>
                      )}
                    </div>
                  )}

                  {/* Root cause pill */}
                  {draft.root_cause && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 whitespace-nowrap flex-shrink-0">
                        Root cause
                      </span>
                      <span className="text-xs text-gray-600">{draft.root_cause}</span>
                    </div>
                  )}

                  {/* IQS badge */}
                  {draft.iqs_score != null && <IQSBadge score={draft.iqs_score} />}

                  {/* Linked themes with rationale */}
                  {draft.linked_theme_ids.length > 0 && (
                    <div className="space-y-1.5 pt-0.5">
                      {draft.linked_theme_ids.map(themeId => {
                        const theme = themes.find(t => t.id === themeId)
                        if (!theme) return null
                        return (
                          <div key={themeId}>
                            <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                              {theme.title}
                            </span>
                            {draft.link_rationale[themeId] && (
                              <p className="text-[11px] text-gray-400 italic mt-0.5 ml-1">{draft.link_rationale[themeId]}</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Supporting notes count */}
                  {draft.supporting_note_ids.length > 0 && (
                    <p className="text-[10px] text-gray-400">
                      Based on {draft.supporting_note_ids.length} note{draft.supporting_note_ids.length !== 1 ? 's' : ''}
                    </p>
                  )}

                  {addedIndices.has(i) ? (
                    <span className="text-xs text-green-600 font-medium">✓ Added to project</span>
                  ) : (
                    <button
                      onClick={() => addDraftInsight(draft, i)}
                      className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium"
                    >
                      + Add insight
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manual add form */}
      {adding && (
        <form onSubmit={addInsight} className="bg-white border border-gray-200 rounded-xl p-5 mb-5 space-y-4">

          {/* Mode toggle */}
          <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 w-fit">
            <button
              type="button"
              onClick={() => setFormMode('structured')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${formMode === 'structured' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Structured
            </button>
            <button
              type="button"
              onClick={() => setFormMode('freetext')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${formMode === 'freetext' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Freetext
            </button>
          </div>

          {formMode === 'structured' ? (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 italic">
                When [context], [who] [behaviour], because [underlying cause], which leads to [impact].
              </p>
              <div className="grid gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-gray-400 w-20 flex-shrink-0 text-right">When</span>
                  <input
                    autoFocus
                    type="text"
                    value={structured.context}
                    onChange={e => setStructured(s => ({ ...s, context: e.target.value }))}
                    placeholder="participants are onboarding to a new tool"
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-gray-400 w-20 flex-shrink-0 text-right">…</span>
                  <input
                    type="text"
                    value={structured.behaviour}
                    onChange={e => setStructured(s => ({ ...s, behaviour: e.target.value }))}
                    placeholder="users skip the setup steps and jump straight in"
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-gray-400 w-20 flex-shrink-0 text-right">Because</span>
                  <input
                    type="text"
                    value={structured.cause}
                    onChange={e => setStructured(s => ({ ...s, cause: e.target.value }))}
                    placeholder="the setup flow feels long and the value isn't obvious upfront"
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-gray-400 w-20 flex-shrink-0 text-right">Leads to</span>
                  <input
                    type="text"
                    value={structured.impact}
                    onChange={e => setStructured(s => ({ ...s, impact: e.target.value }))}
                    placeholder="missed configuration and confusion later in the workflow"
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {structured.cause && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  Root cause will be saved from the "Because" field: <span className="font-medium">{structured.cause.charAt(0).toUpperCase() + structured.cause.slice(1)}</span>
                </p>
              )}
              {(structured.context || structured.behaviour || structured.cause || structured.impact) && (
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
                  <span className="font-medium text-gray-400">Preview: </span>
                  When {structured.context || '…'}, {structured.behaviour || '…'}, because {structured.cause || '…'}, which leads to {structured.impact || '…'}.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="When [context], researchers [behaviour], because [underlying cause], which leads to [impact]."
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">
                  Root cause <span className="font-normal text-gray-300">(optional — the "because" clause in 5–15 words)</span>
                </label>
                <input
                  type="text"
                  value={manualRootCause}
                  onChange={e => setManualRootCause(e.target.value)}
                  placeholder="e.g. value isn't visible upfront"
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {themes.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Link to themes</label>
              <div className="flex flex-wrap gap-2">
                {themes.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setNewInsightThemeIds(prev =>
                      prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id]
                    )}
                    className={[
                      'px-3 py-1 rounded-lg text-xs font-medium border transition-colors',
                      newInsightThemeIds.includes(t.id)
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-purple-700 border-purple-200 hover:border-purple-400',
                    ].join(' ')}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || (formMode === 'structured'
                ? !structured.context.trim() || !structured.behaviour.trim() || !structured.cause.trim() || !structured.impact.trim()
                : !content.trim())}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add insight'}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setContent(''); setStructured({ context: '', behaviour: '', cause: '', impact: '' }); setManualRootCause(''); setNewInsightThemeIds([]) }}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {insights.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
          <div className="text-3xl mb-3">💡</div>
          <p className="text-gray-500 text-sm">
            No insights yet. What patterns emerged across your research?
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.map(insight => {
            const linkedThemes = themes.filter(t => insight.theme_ids?.includes(t.id))
            return (
              <div
                key={insight.id}
                className={`bg-white border border-gray-200 rounded-xl p-5 transition-all ${isEditor ? 'cursor-pointer hover:border-blue-400 hover:ring-1 hover:ring-blue-400' : ''}`}
                onClick={isEditor ? () => setSelected(insight) : undefined}
              >
                {insight.display_number && (
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-2">
                    Insight {insight.display_number}
                  </span>
                )}
                <p className="text-sm text-gray-800 leading-relaxed mb-3">{insight.content}</p>
                <div className="flex items-center flex-wrap gap-1.5">
                  {linkedThemes.length > 0 ? (
                    linkedThemes.map(t => (
                      <span key={t.id} className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                        {t.title}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-amber-500">⚠ No themes linked — click to link</span>
                  )}
                  {insight.iqs_score != null && <IQSBadge score={insight.iqs_score} />}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selected && (
        <EntityDrawer
          type="insight"
          entity={selected}
          projectId={projectId}
          themes={themes}
          insights={insights}
          notes={notes}
          isEditor={isEditor}
          initialEditing={true}
          onClose={() => setSelected(null)}
          onRefresh={handleDrawerRefresh}
          onDelete={() => deleteInsight(selected.id)}
        />
      )}
    </div>
    </>
  )
}
