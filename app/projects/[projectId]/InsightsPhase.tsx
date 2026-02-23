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

  // When drawer calls onRefresh, update the selected entity from the refreshed list
  function handleDrawerRefresh() {
    setSelected(null)
    onRefresh()
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
          <button
            onClick={() => setAdding(true)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Add insight
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={addInsight} className="bg-white border border-gray-200 rounded-xl p-5 mb-5 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Insight</label>
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
              onClick={() => { setAdding(false); setContent('') }}
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
                      <span
                        key={t.id}
                        className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full"
                      >
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
