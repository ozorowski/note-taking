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
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<InsightWithIds | null>(null)

  // AI generation state
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiDraft, setAiDraft] = useState('')

  async function addInsight(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setLoading(true)
    const res = await fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, content: content.trim() }),
    })
    setLoading(false)
    if (res.ok) {
      setContent('')
      setAdding(false)
      onRefresh()
    }
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

  async function generateDraft() {
    if (selectedThemeIds.length === 0) return
    setAiLoading(true)
    setAiDraft('')
    const res = await fetch('/api/ai/draft-insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, theme_ids: selectedThemeIds }),
    })
    if (res.ok) {
      const data = await res.json()
      setAiDraft(data.draft || data.content || '')
      // Pre-fill the manual add form with the draft
      setContent(data.draft || data.content || '')
      setAdding(true)
    }
    setAiLoading(false)
    setShowAiPanel(false)
    setSelectedThemeIds([])
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Insights</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Synthesise patterns into key findings. Each insight must be linked to at least one theme.
          </p>
        </div>
        {isEditor && (
          <div className="flex gap-2">
            <button
              onClick={() => { setShowAiPanel(v => !v); setAdding(false) }}
              className="px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium hover:bg-purple-100"
            >
              ✨ Generate with AI
            </button>
            <button
              onClick={() => { setAdding(v => !v); setShowAiPanel(false) }}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              + Add insight
            </button>
          </div>
        )}
      </div>

      {/* AI generation panel */}
      {showAiPanel && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 mb-5">
          <h3 className="text-sm font-semibold text-purple-800 mb-1">Generate insight with AI</h3>
          <p className="text-xs text-purple-600 mb-4">
            Pick the themes you want to draw from — AI will draft an insight based on the notes in those themes.
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
          <div className="flex gap-2">
            <button
              onClick={generateDraft}
              disabled={aiLoading || selectedThemeIds.length === 0}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-40"
            >
              {aiLoading ? 'Generating...' : `Generate from ${selectedThemeIds.length} theme${selectedThemeIds.length !== 1 ? 's' : ''}`}
            </button>
            <button
              onClick={() => { setShowAiPanel(false); setSelectedThemeIds([]) }}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Manual add form */}
      {adding && (
        <form onSubmit={addInsight} className="bg-white border border-gray-200 rounded-xl p-5 mb-5 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Insight
              {aiDraft && content === aiDraft && (
                <span className="ml-2 text-xs text-purple-500 font-normal">✨ AI draft — edit before saving</span>
              )}
            </label>
            <textarea
              autoFocus
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="e.g. Users struggle to find saved files because the navigation hierarchy doesn't match their mental model"
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add insight'}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setContent(''); setAiDraft('') }}
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
