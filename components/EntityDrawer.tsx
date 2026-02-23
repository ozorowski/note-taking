'use client'

import { useState } from 'react'
import type { Insight, Recommendation, Theme, Note } from '@/lib/types'
import TraceView from './TraceView'

type EntityType = 'insight' | 'recommendation'

type InsightWithIds = Insight & { theme_ids?: string[] }
type RecommendationWithIds = Recommendation & { insight_ids?: string[] }

interface Props {
  type: EntityType
  entity: InsightWithIds | RecommendationWithIds
  projectId: string
  themes: Theme[]
  insights: InsightWithIds[]
  notes: Note[]
  isEditor: boolean
  onClose: () => void
  onRefresh: () => void
}

export default function EntityDrawer({
  type,
  entity,
  projectId,
  themes,
  insights,
  notes,
  isEditor,
  onClose,
  onRefresh,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(entity.content)
  const [secondary, setSecondary] = useState(
    type === 'insight'
      ? (entity as InsightWithIds).evidence_summary || ''
      : (entity as RecommendationWithIds).rationale || ''
  )
  const [aiDraft, setAiDraft] = useState(entity.ai_draft || '')
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const isInsight = type === 'insight'
  const insight = entity as InsightWithIds
  const rec = entity as RecommendationWithIds

  const linkedThemeIds = isInsight ? (insight.theme_ids || []) : []
  const linkedInsightIds = !isInsight ? (rec.insight_ids || []) : []

  const linkedThemes = themes.filter(t => linkedThemeIds.includes(t.id))
  const linkedInsights = insights.filter(i => linkedInsightIds.includes(i.id))
  const availableThemes = themes.filter(t => !linkedThemeIds.includes(t.id))
  const availableInsights = insights.filter(i => !linkedInsightIds.includes(i.id))

  async function save() {
    setSaving(true)
    const body: Record<string, unknown> = { content: content.trim() }
    if (isInsight) body.evidence_summary = secondary.trim() || null
    else body.rationale = secondary.trim() || null
    if (aiDraft) body.ai_draft = aiDraft.trim()

    const endpoint = isInsight ? `/api/insights/${entity.id}` : `/api/recommendations/${entity.id}`
    await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    setEditing(false)
    onRefresh()
  }

  async function generateAiDraft() {
    setAiLoading(true)
    const endpoint = isInsight ? '/api/ai/draft-insight' : '/api/ai/draft-recommendation'
    const body = isInsight
      ? { project_id: projectId, theme_ids: linkedThemeIds }
      : { project_id: projectId, insight_ids: linkedInsightIds }
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const data = await res.json()
      setAiDraft(data.draft || data.content || '')
      setEditing(true)
    }
    setAiLoading(false)
  }

  async function linkTheme(themeId: string) {
    await fetch(`/api/insights/${entity.id}/themes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme_id: themeId }),
    })
    onRefresh()
  }

  async function unlinkTheme(themeId: string) {
    await fetch(`/api/insights/${entity.id}/themes?themeId=${themeId}`, { method: 'DELETE' })
    onRefresh()
  }

  async function linkInsight(insightId: string) {
    await fetch(`/api/recommendations/${entity.id}/insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insight_id: insightId }),
    })
    onRefresh()
  }

  async function unlinkInsight(insightId: string) {
    await fetch(`/api/recommendations/${entity.id}/insights?insightId=${insightId}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-[480px] max-w-full bg-white shadow-xl flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="font-semibold text-gray-800 capitalize">{type}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Content */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {isInsight ? 'Insight' : 'Recommendation'}
              </label>
              {isEditor && !editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Edit
                </button>
              )}
            </div>
            {editing ? (
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
            ) : (
              <p className="text-sm text-gray-800 leading-relaxed">{entity.content}</p>
            )}
          </div>

          {/* Evidence summary / Rationale */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              {isInsight ? 'Evidence summary' : 'Rationale'}{' '}
              <span className="font-normal text-gray-300">(optional)</span>
            </label>
            {editing ? (
              <textarea
                value={secondary}
                onChange={e => setSecondary(e.target.value)}
                rows={2}
                placeholder={
                  isInsight
                    ? 'What patterns support this insight?'
                    : 'Why is this the right recommendation?'
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
            ) : (
              secondary ? (
                <p className="text-sm text-gray-600 leading-relaxed">{secondary}</p>
              ) : (
                <p className="text-sm text-gray-300 italic">Not yet written</p>
              )
            )}
          </div>

          {/* Linked themes (insights only) */}
          {isInsight && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Linked themes
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {linkedThemes.map(t => (
                  <span
                    key={t.id}
                    className="flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs"
                  >
                    {t.title}
                    {isEditor && (
                      <button
                        onClick={() => unlinkTheme(t.id)}
                        className="text-purple-400 hover:text-red-500 ml-0.5 leading-none"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
                {linkedThemes.length === 0 && (
                  <span className="text-xs text-amber-500">⚠ No themes linked</span>
                )}
              </div>
              {isEditor && availableThemes.length > 0 && (
                <select
                  value=""
                  onChange={e => e.target.value && linkTheme(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="">+ Link a theme</option>
                  {availableThemes.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Linked insights (recommendations only) */}
          {!isInsight && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Linked insights
              </label>
              <div className="flex flex-col gap-2 mb-2">
                {linkedInsights.map(ins => (
                  <span
                    key={ins.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs"
                  >
                    <span className="flex-1 leading-relaxed">
                      {ins.content.length > 80 ? ins.content.slice(0, 80) + '...' : ins.content}
                    </span>
                    {isEditor && (
                      <button
                        onClick={() => unlinkInsight(ins.id)}
                        className="text-green-400 hover:text-red-500 ml-1 flex-shrink-0 leading-none"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
                {linkedInsights.length === 0 && (
                  <span className="text-xs text-amber-500">⚠ No insights linked</span>
                )}
              </div>
              {isEditor && availableInsights.length > 0 && (
                <select
                  value=""
                  onChange={e => e.target.value && linkInsight(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400 max-w-full"
                >
                  <option value="">+ Link an insight</option>
                  {availableInsights.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.content.length > 60 ? i.content.slice(0, 60) + '...' : i.content}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* AI Draft */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                AI Draft
              </label>
              {isEditor && (
                <button
                  onClick={generateAiDraft}
                  disabled={aiLoading}
                  className="text-xs px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50 flex items-center gap-1"
                >
                  {aiLoading ? 'Generating...' : '✨ Generate draft'}
                </button>
              )}
            </div>
            {editing ? (
              <textarea
                value={aiDraft}
                onChange={e => setAiDraft(e.target.value)}
                rows={3}
                placeholder="AI-generated draft will appear here..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
            ) : (
              aiDraft ? (
                <p className="text-sm text-gray-600 leading-relaxed bg-purple-50 rounded-lg p-3 border border-purple-100">
                  {aiDraft}
                </p>
              ) : (
                <p className="text-sm text-gray-300 italic">No draft yet</p>
              )
            )}
          </div>

          {/* Save / Cancel */}
          {editing && (
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
              <button
                onClick={() => {
                  setEditing(false)
                  setContent(entity.content)
                  setSecondary(
                    type === 'insight'
                      ? (entity as InsightWithIds).evidence_summary || ''
                      : (entity as RecommendationWithIds).rationale || ''
                  )
                  setAiDraft(entity.ai_draft || '')
                }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Trace view (recommendations only) */}
          {!isInsight && linkedInsights.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Evidence chain
              </label>
              <TraceView
                linkedInsights={linkedInsights}
                themes={themes}
                notes={notes}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
