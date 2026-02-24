'use client'

import { useState } from 'react'
import type { Insight, Theme, Note } from '@/lib/types'
import EntityDrawer from '@/components/EntityDrawer'

type InsightWithIds = Insight & { theme_ids?: string[] }

interface Props {
  projectId: string
  insights: InsightWithIds[]
  themes: Theme[]
  notes: Note[]
  isEditor: boolean
  onRefresh: () => void
}

export default function InsightsPhase({ projectId, insights, themes, notes, isEditor, onRefresh }: Props) {
  const [adding, setAdding] = useState(false)
  const [formMode, setFormMode] = useState<'structured' | 'freetext'>('structured')
  const [content, setContent] = useState('')
  const [structured, setStructured] = useState({ context: '', behaviour: '', cause: '', impact: '' })
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<InsightWithIds | null>(null)

  const [newInsightThemeIds, setNewInsightThemeIds] = useState<string[]>([])

  // AI generation state
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiDrafts, setAiDrafts] = useState<string[]>([])
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set())

  async function addInsight(e: React.FormEvent) {
    e.preventDefault()
    const finalContent = formMode === 'structured'
      ? `When ${structured.context.trim()}, ${structured.behaviour.trim()}, because ${structured.cause.trim()}, which leads to ${structured.impact.trim()}.`
      : content.trim()
    if (!finalContent.trim()) return
    setLoading(true)
    const res = await fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, content: finalContent }),
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
    const res = await fetch('/api/ai/draft-insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, theme_ids: selectedThemeIds }),
    })
    if (res.ok) {
      const data = await res.json()
      setAiDrafts(data.drafts || (data.draft ? [data.draft] : []))
    }
    setAiLoading(false)
  }

  async function addDraftInsight(draft: string, index: number) {
    const res = await fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, content: draft }),
    })
    if (res.ok) {
      const insight = await res.json()
      await Promise.all(
        selectedThemeIds.map(themeId =>
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
  }

  function closeAiPanel() {
    setShowAiPanel(false)
    setSelectedThemeIds([])
    setAiDrafts([])
    setAddedIndices(new Set())
  }

  return (
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
            Pick themes → Tracey drafts 3 insights using the structured format:
          </p>
          <p className="text-xs text-purple-500 italic mb-4">
            When [context], [participants] [behaviour], because [underlying cause], which leads to [impact].
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
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
            <button
              onClick={closeAiPanel}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>
          {aiDrafts.length > 0 && (
            <div className="space-y-3 border-t border-purple-200 pt-4">
              <p className="text-xs font-semibold text-purple-700">
                Tracey drafted {aiDrafts.length} insight{aiDrafts.length !== 1 ? 's' : ''} — review and add:
              </p>
              {aiDrafts.map((draft, i) => (
                <div key={i} className="bg-white border border-purple-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700 leading-relaxed mb-3">{draft}</p>
                  {addedIndices.has(i) ? (
                    <span className="text-xs text-green-600 font-medium">✓ Added to project</span>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => addDraftInsight(draft, i)}
                        className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium"
                      >
                        + Add insight
                      </button>
                      {selectedThemeIds.length > 0 && (
                        <span className="text-xs text-purple-500">
                          Themes will be linked automatically
                        </span>
                      )}
                    </div>
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
              {(structured.context || structured.behaviour || structured.cause || structured.impact) && (
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
                  <span className="font-medium text-gray-400">Preview: </span>
                  When {structured.context || '…'}, {structured.behaviour || '…'}, because {structured.cause || '…'}, which leads to {structured.impact || '…'}.
                </p>
              )}
            </div>
          ) : (
            <div>
              <textarea
                autoFocus
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="When [context], researchers [behaviour], because [underlying cause], which leads to [impact]."
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
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
              onClick={() => { setAdding(false); setContent(''); setStructured({ context: '', behaviour: '', cause: '', impact: '' }); setNewInsightThemeIds([]) }}
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
                className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:shadow-md transition-shadow group"
                onClick={() => setSelected(insight)}
              >
                <div className="flex items-start gap-2 mb-3">
                  <p className="flex-1 text-sm text-gray-800 leading-relaxed">{insight.content}</p>
                  {isEditor && (
                    <button
                      onClick={e => { e.stopPropagation(); deleteInsight(insight.id) }}
                      className="text-gray-200 hover:text-red-500 text-xl leading-none opacity-0 group-hover:opacity-100 flex-shrink-0"
                    >
                      ×
                    </button>
                  )}
                </div>
                {linkedThemes.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {linkedThemes.map(t => (
                      <span key={t.id} className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                        {t.title}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-amber-500">⚠ No themes linked — click to link</span>
                )}
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
          onClose={() => setSelected(null)}
          onRefresh={handleDrawerRefresh}
        />
      )}
    </div>
  )
}
