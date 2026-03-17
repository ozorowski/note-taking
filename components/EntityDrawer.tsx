'use client'

import { useState, useEffect } from 'react'
import type { Insight, Recommendation, Theme, Note } from '@/lib/types'
import TraceView from './TraceView'

const IQS_DIMENSIONS = [
  { label: 'Focused on one clear cause', desc: 'Does this insight describe one main reason behind the behaviour?', range: '0–25' },
  { label: 'Describes a real behaviour', desc: 'Is it based on what people actually do, rather than a broad theme?', range: '0–20' },
  { label: 'Clear cause and effect', desc: 'Is it obvious how the cause leads to the outcome?', range: '0–20' },
  { label: 'Explains the impact', desc: 'Does it clearly describe what happens as a result?', range: '0–15' },
  { label: 'Stays neutral', desc: 'Does it avoid jumping to a solution or recommendation?', range: '0–10' },
  { label: 'Supported by evidence', desc: 'Is it grounded in multiple notes or participants?', range: '0–10' },
]

type EntityType = 'insight' | 'recommendation' | 'theme'

type InsightWithIds = Insight & { theme_ids?: string[] }
type RecommendationWithIds = Recommendation & { insight_ids?: string[] }

interface Props {
  type: EntityType
  entity: InsightWithIds | RecommendationWithIds | Theme
  projectId: string
  themes: Theme[]
  insights: InsightWithIds[]
  notes: Note[]
  isEditor: boolean
  initialEditing?: boolean
  onClose: () => void
  onRefresh: () => void
  onDelete?: () => void
}

export default function EntityDrawer({
  type,
  entity,
  themes,
  insights,
  notes,
  isEditor,
  initialEditing = false,
  onClose,
  onRefresh,
  onDelete,
}: Props) {
  const [editing, setEditing] = useState(initialEditing)
  useEffect(() => { setEditing(initialEditing) }, [initialEditing])
  const [content, setContent] = useState(type === 'theme' ? (entity as Theme).title : (entity as InsightWithIds | RecommendationWithIds).content)
  const [description, setDescription] = useState(type === 'theme' ? ((entity as Theme).description || '') : '')
  const [secondary, setSecondary] = useState(
    type === 'recommendation' ? ((entity as RecommendationWithIds).rationale || '') : ''
  )
  const [saving, setSaving] = useState(false)
  const [rootCause, setRootCause] = useState(type === 'insight' ? ((entity as InsightWithIds).root_cause || '') : '')
  const [showInsightList, setShowInsightList] = useState(false)

  const isInsight = type === 'insight'
  const isRec = type === 'recommendation'
  const isTheme = type === 'theme'

  const insight = entity as InsightWithIds
  const rec = entity as RecommendationWithIds
  const theme = entity as Theme

  const linkedThemeIds = isInsight ? (insight.theme_ids || []) : []
  const linkedInsightIds = isRec ? (rec.insight_ids || []) : []

  const linkedThemes = themes.filter(t => linkedThemeIds.includes(t.id))
  const linkedInsights = insights.filter(i => linkedInsightIds.includes(i.id))
  const availableThemes = themes.filter(t => !linkedThemeIds.includes(t.id))
  const availableInsights = insights.filter(i => !linkedInsightIds.includes(i.id))

  // Entity label for header
  const entityLabel = isInsight
    ? `Insight${insight.display_number ? ` ${insight.display_number}` : ''}`
    : isRec
    ? `Recommendation${rec.display_number ? ` ${rec.display_number}` : ''}`
    : `Theme${theme.display_number ? ` ${theme.display_number}` : ''}`

  async function save() {
    setSaving(true)
    if (isTheme) {
      await fetch(`/api/themes/${entity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim() || null }),
      })
    } else {
      const body: Record<string, unknown> = { content: content.trim() }
      if (isInsight) {
        const rc = rootCause.trim()
        body.root_cause = rc ? rc.charAt(0).toUpperCase() + rc.slice(1) : null
      } else {
        body.rationale = secondary.trim() || null
      }
      const endpoint = isInsight ? `/api/insights/${entity.id}` : `/api/recommendations/${entity.id}`
      await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }
    setSaving(false)
    setEditing(false)
    onRefresh()
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

  function handleDelete() {
    if (window.confirm(`Delete this ${type}? This cannot be undone.`)) {
      onDelete?.()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-[480px] max-w-full bg-white shadow-xl flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-gray-800">{entityLabel}</h2>
            <p className="text-[11px] text-gray-400 mt-1">
              {(entity as Insight).creator_name && <>Created by <span className="font-medium">{(entity as Insight).creator_name}</span> · </>}
              {new Date(entity.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}
              {' · '}
              {new Date(entity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none mt-0.5">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ── THEME type ───────────────────────────────── */}
          {isTheme && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Title</label>
                <p className="text-sm text-gray-800 font-medium">{theme.title}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Rename by clicking the title on the board</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Description</label>
                {editing ? (
                  <textarea
                    autoFocus
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={4}
                    placeholder="Describe what this theme is about…"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                  />
                ) : (
                  description
                    ? <p className="text-sm text-gray-700 leading-relaxed">{description}</p>
                    : <p className="text-sm text-gray-300 italic">No description yet</p>
                )}
              </div>
            </>
          )}

          {/* ── INSIGHT / RECOMMENDATION content ─────────── */}
          {!isTheme && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {isInsight ? 'Insight' : 'Recommendation'}
                </label>
                {isEditor && !editing && (
                  <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:text-blue-800">
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
                <p className="text-sm text-gray-800 leading-relaxed">{isTheme ? theme.title : (entity as InsightWithIds | RecommendationWithIds).content}</p>
              )}
            </div>
          )}

          {/* Root cause (insights only) */}
          {isInsight && (
            <div>
              {editing ? (
                <>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Root cause <span className="font-normal text-gray-300">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={rootCause}
                    onChange={e => setRootCause(e.target.value)}
                    placeholder="e.g. value isn't visible upfront"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </>
              ) : insight.root_cause ? (
                <div className="border-l-2 border-amber-400 pl-3 py-1">
                  <p className="text-xs font-semibold text-gray-400 mb-0.5">Root cause</p>
                  <p className="text-sm text-gray-700">{insight.root_cause}</p>
                </div>
              ) : null}
            </div>
          )}

          {/* IQS badge with tooltip (insights only, view mode) */}
          {isInsight && !editing && insight.iqs_score != null && (() => {
            const score = insight.iqs_score!
            const color = score >= 75 ? 'bg-green-100 text-green-700' : score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
            const label = `${score < 75 ? '⚠ ' : ''}Strength ${score}`
            return (
              <div className="relative group inline-flex items-center gap-1.5">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{label}</span>
                <span className="text-gray-400 text-[13px] cursor-help leading-none select-none">ⓘ</span>
                <div className="absolute top-full left-0 mt-2 w-80 bg-gray-900 text-white text-xs rounded-lg p-3 hidden group-hover:block z-20 shadow-xl pointer-events-none">
                  <p className="font-semibold mb-1">Insight strength</p>
                  <p className="text-gray-400 mb-2.5 leading-relaxed">A quick check of how clear and well-supported this insight is.</p>
                  <div className="space-y-2">
                    {IQS_DIMENSIONS.map(({ label: dim, desc, range }) => (
                      <div key={dim}>
                        <div className="flex justify-between text-gray-300">
                          <span>{dim}</span>
                          <span className="text-gray-500 ml-4 flex-shrink-0">{range}</span>
                        </div>
                        <p className="text-gray-500 text-[10px] leading-snug mt-0.5">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Rationale (recommendations only) */}
          {isRec && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Rationale <span className="font-normal text-gray-300">(optional)</span>
              </label>
              {editing ? (
                <textarea
                  value={secondary}
                  onChange={e => setSecondary(e.target.value)}
                  rows={2}
                  placeholder="Why is this the right recommendation?"
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
          )}

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
          {isRec && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Linked insights
              </label>
              <div className="flex flex-col gap-2 mb-2">
                {linkedInsights.map(ins => (
                  <span
                    key={ins.id}
                    className="flex items-start gap-1 px-2.5 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs"
                  >
                    <span className="flex-1 leading-relaxed">{ins.content}</span>
                    {isEditor && (
                      <button
                        onClick={() => unlinkInsight(ins.id)}
                        className="text-green-400 hover:text-red-500 ml-1 flex-shrink-0 leading-none mt-0.5"
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
                showInsightList ? (
                  <div className="space-y-1.5">
                    {availableInsights.map(i => (
                      <button
                        key={i.id}
                        onClick={() => { linkInsight(i.id); setShowInsightList(false) }}
                        className="w-full text-left text-xs text-gray-600 border border-gray-200 rounded-lg px-2.5 py-2 hover:border-green-400 hover:bg-green-50 hover:text-green-700 transition-colors leading-relaxed"
                      >
                        {i.content}
                      </button>
                    ))}
                    <button
                      onClick={() => setShowInsightList(false)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowInsightList(true)}
                    className="text-xs text-gray-500 hover:text-green-700 border border-dashed border-gray-200 rounded-lg px-3 py-1.5 w-full text-left hover:border-green-300 transition-colors"
                  >
                    + Link an insight
                  </button>
                )
              )}
            </div>
          )}

          {/* Save / Cancel / Delete */}
          {(editing || (isEditor && onDelete)) && (
            <div className="flex items-center gap-2 pt-2">
              {editing && (
                <>
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
                      setContent(isTheme ? theme.title : (entity as InsightWithIds | RecommendationWithIds).content)
                      setDescription(isTheme ? (theme.description || '') : '')
                      setSecondary(isRec ? (rec.rationale || '') : '')
                      setRootCause(isInsight ? (insight.root_cause || '') : '')
                    }}
                    className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </>
              )}
              {isEditor && onDelete && (
                <button
                  onClick={handleDelete}
                  className="ml-auto px-4 py-2 text-sm text-red-400 hover:text-red-600 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          )}

          {/* Trace view (recommendations only) */}
          {isRec && linkedInsights.length > 0 && (
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
