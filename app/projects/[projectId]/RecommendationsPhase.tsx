'use client'

import { useState } from 'react'
import type { Recommendation, Insight, Theme, Note } from '@/lib/types'
import EntityDrawer from '@/components/EntityDrawer'

type InsightWithIds = Insight & { theme_ids?: string[] }
type RecommendationWithIds = Recommendation & { insight_ids?: string[] }

interface Props {
  projectId: string
  recommendations: RecommendationWithIds[]
  insights: InsightWithIds[]
  themes: Theme[]
  notes: Note[]
  isEditor: boolean
  onRefresh: () => void
}

export default function RecommendationsPhase({
  projectId,
  recommendations,
  insights,
  themes,
  notes,
  isEditor,
  onRefresh,
}: Props) {
  const [adding, setAdding] = useState(false)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<RecommendationWithIds | null>(null)

  // AI generation state
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [selectedInsightIds, setSelectedInsightIds] = useState<string[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiDraft, setAiDraft] = useState<string | null>(null)
  const [aiAdded, setAiAdded] = useState(false)

  function toggleInsight(id: string) {
    setSelectedInsightIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  async function generateDraft() {
    if (selectedInsightIds.length === 0) return
    setAiLoading(true)
    setAiDraft(null)
    setAiAdded(false)
    const res = await fetch('/api/ai/draft-recommendation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, insight_ids: selectedInsightIds }),
    })
    if (res.ok) {
      const data = await res.json()
      setAiDraft(data.draft || null)
    }
    setAiLoading(false)
  }

  async function addDraftRec() {
    if (!aiDraft) return
    const res = await fetch('/api/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, content: aiDraft }),
    })
    if (res.ok) {
      setAiAdded(true)
      onRefresh()
    }
  }

  function closeAiPanel() {
    setShowAiPanel(false)
    setSelectedInsightIds([])
    setAiDraft(null)
    setAiAdded(false)
  }

  async function addRec(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setLoading(true)
    const res = await fetch('/api/recommendations', {
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

  async function deleteRec(id: string) {
    await fetch(`/api/recommendations/${id}`, { method: 'DELETE' })
    if (selected?.id === id) setSelected(null)
    onRefresh()
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Recommendations</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Turn your insights into actionable recommendations. Each must be linked to at least one insight.
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
              + Add recommendation
            </button>
          </div>
        )}
      </div>

      {/* AI generation panel */}
      {showAiPanel && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 mb-5">
          <h3 className="text-sm font-semibold text-purple-800 mb-1">Generate recommendation with AI</h3>
          <p className="text-xs text-purple-600 mb-4">
            Pick insights → AI drafts a concrete, actionable recommendation.
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {insights.map(ins => (
              <button
                key={ins.id}
                type="button"
                onClick={() => toggleInsight(ins.id)}
                className={[
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors text-left max-w-xs',
                  selectedInsightIds.includes(ins.id)
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-purple-700 border-purple-200 hover:border-purple-400',
                ].join(' ')}
              >
                {ins.content.length > 80 ? ins.content.slice(0, 80) + '…' : ins.content}
              </button>
            ))}
            {insights.length === 0 && (
              <p className="text-xs text-purple-500">No insights yet — go back to the Insights phase first.</p>
            )}
          </div>
          <div className="flex gap-2 mb-4">
            <button
              onClick={generateDraft}
              disabled={aiLoading || selectedInsightIds.length === 0}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-40"
            >
              {aiLoading ? 'Generating...' : `Generate from ${selectedInsightIds.length} insight${selectedInsightIds.length !== 1 ? 's' : ''}`}
            </button>
            <button onClick={closeAiPanel} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
              Close
            </button>
          </div>
          {aiDraft && (
            <div className="border-t border-purple-200 pt-4">
              <p className="text-xs font-semibold text-purple-700 mb-2">AI draft — review and add:</p>
              <div className="bg-white border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-gray-700 leading-relaxed mb-3">{aiDraft}</p>
                {aiAdded ? (
                  <span className="text-xs text-green-600 font-medium">✓ Added to project</span>
                ) : (
                  <button
                    onClick={addDraftRec}
                    className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium"
                  >
                    + Add recommendation
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {adding && (
        <form onSubmit={addRec} className="bg-white border border-gray-200 rounded-xl p-5 mb-5 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recommendation</label>
            <textarea
              autoFocus
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="e.g. Redesign the file navigation to use a flat, recency-based model with smart search"
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
              {loading ? 'Adding...' : 'Add recommendation'}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setContent('') }}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {recommendations.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
          <div className="text-3xl mb-3">🎯</div>
          <p className="text-gray-500 text-sm">
            No recommendations yet. Turn your insights into concrete actions.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {recommendations.map((rec, i) => {
            const linkedInsights = insights.filter(ins => rec.insight_ids?.includes(ins.id))
            return (
              <div
                key={rec.id}
                className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:shadow-md transition-shadow group"
                onClick={() => setSelected(rec)}
              >
                <div className="flex items-start gap-3 mb-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-100 text-orange-700 text-sm font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <p className="flex-1 text-sm text-gray-800 leading-relaxed">{rec.content}</p>
                  {isEditor && (
                    <button
                      onClick={e => { e.stopPropagation(); deleteRec(rec.id) }}
                      className="text-gray-200 hover:text-red-500 text-xl leading-none opacity-0 group-hover:opacity-100 flex-shrink-0"
                    >
                      ×
                    </button>
                  )}
                </div>
                {linkedInsights.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 ml-10">
                    {linkedInsights.map(ins => (
                      <span
                        key={ins.id}
                        className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full max-w-[220px] truncate"
                      >
                        {ins.content.length > 50 ? ins.content.slice(0, 50) + '...' : ins.content}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-amber-500 ml-10">⚠ No insights linked — click to link</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {selected && (
        <EntityDrawer
          type="recommendation"
          entity={selected}
          projectId={projectId}
          themes={themes}
          insights={insights}
          notes={notes}
          isEditor={isEditor}
          onClose={() => setSelected(null)}
          onRefresh={() => { setSelected(null); onRefresh() }}
        />
      )}
    </div>
  )
}
