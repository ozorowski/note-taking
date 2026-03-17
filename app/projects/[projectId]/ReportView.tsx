'use client'

import { useState } from 'react'
import type { FullProject, Insight, Recommendation, ArchetypesData, EmergingNeed, UserArchetype } from '@/lib/types'
import TraceView from '@/components/TraceView'

type InsightWithIds = Insight & { theme_ids?: string[] }
type RecommendationWithIds = Recommendation & { insight_ids?: string[] }
type Tab = 'summary' | 'archetypes'

interface Props {
  project: FullProject
  isEditor: boolean
  onRefresh: () => void
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(d: Date) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function ConfidenceBadge({ level }: { level: 'High' | 'Medium' | 'Low' }) {
  const styles = {
    High: 'bg-emerald-100 text-emerald-700',
    Medium: 'bg-amber-100 text-amber-700',
    Low: 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${styles[level]}`}>
      {level} confidence
    </span>
  )
}

// ── Archetypes Tab ─────────────────────────────────────────────────────────────

function ArchetypesTab({
  project,
  insights,
  isEditor,
  onRefresh,
}: {
  project: FullProject
  insights: InsightWithIds[]
  isEditor: boolean
  onRefresh: () => void
}) {
  const [draft, setDraft] = useState<ArchetypesData | null>(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [genError, setGenError] = useState('')
  const [expandedNeeds, setExpandedNeeds] = useState<Set<number>>(new Set())
  const [expandedArchetypes, setExpandedArchetypes] = useState<Set<number>>(new Set([0]))
  const [showConfidenceInfo, setShowConfidenceInfo] = useState(false)

  const saved = project.archetypes_data as ArchetypesData | null
  const generatedAt = project.archetypes_generated_at

  const isStale = (() => {
    if (!generatedAt) return false
    const genTime = new Date(generatedAt).getTime()
    return insights.some(i => new Date(i.updated_at).getTime() > genTime)
  })()

  async function generate() {
    setGenerating(true)
    setGenError('')
    setDraft(null)
    const res = await fetch('/api/ai/draft-archetypes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: project.id }),
    })
    if (res.ok) {
      const data = await res.json()
      setDraft(data)
      setExpandedNeeds(new Set())
      setExpandedArchetypes(new Set([0]))
    } else {
      const data = await res.json()
      setGenError(data.error || 'Generation failed — try again.')
    }
    setGenerating(false)
  }

  async function save() {
    if (!draft) return
    setSaving(true)
    await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archetypes_data: draft }),
    })
    setDraft(null)
    onRefresh()
    setSaving(false)
  }

  function toggleNeed(i: number) {
    setExpandedNeeds(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s })
  }
  function toggleArchetype(i: number) {
    setExpandedArchetypes(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s })
  }

  const display = draft ?? saved

  return (
    <div>
      {/* Explanatory banner */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl px-5 py-3 mb-6 flex items-start gap-3">
        <span className="text-purple-400 text-lg mt-0.5">✦</span>
        <div>
          <p className="text-sm font-medium text-purple-800">AI-assisted synthesis — review before sharing externally</p>
          <p className="text-xs text-purple-600 mt-0.5">
            Generated from validated project insights only. Does not modify themes, insights, or recommendations.
          </p>
        </div>
      </div>

      {/* Stale warning */}
      {saved && isStale && !draft && (
        <div className="mb-5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-700">
            Insights have changed since this was generated — consider regenerating.
          </p>
        </div>
      )}

      {/* Error */}
      {genError && (
        <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{genError}</p>
        </div>
      )}

      {/* Draft actions */}
      {draft && (
        <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-white border border-purple-200 rounded-xl">
          <p className="text-sm text-purple-700 font-medium flex-1">
            Tracey&apos;s draft — review and save when ready.
          </p>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save to report'}
          </button>
          <button
            onClick={() => setDraft(null)}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            Discard
          </button>
        </div>
      )}

      {/* Empty / generate state */}
      {!display && !generating && (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
          <div className="text-3xl mb-3">◈</div>
          <p className="text-gray-500 text-sm mb-1 font-medium">No archetypes generated yet</p>
          <p className="text-gray-400 text-xs mb-5 max-w-sm mx-auto">
            Tracey will derive emerging user needs from your insights, then cluster them into behavioural archetypes.
          </p>
          {isEditor ? (
            <button
              onClick={generate}
              className="px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
            >
              ✨ Generate with Tracey
            </button>
          ) : (
            <p className="text-xs text-gray-400">No archetypes generated yet.</p>
          )}
        </div>
      )}

      {/* Loading skeleton */}
      {generating && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
              <div className="h-3 bg-gray-100 rounded w-1/2 mb-3" />
              <div className="h-2 bg-gray-100 rounded w-3/4 mb-2" />
              <div className="h-2 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
          <p className="text-center text-sm text-purple-600 font-medium pt-2">Tracey is synthesising…</p>
        </div>
      )}

      {/* Content */}
      {display && !generating && (
        <div className="space-y-8">

          {/* Confidence legend */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowConfidenceInfo(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">What does confidence mean?</span>
              <span className="text-gray-400 text-sm">{showConfidenceInfo ? '▲' : '▼'}</span>
            </button>
            {showConfidenceInfo && (
              <div className="px-5 py-4 bg-white space-y-4 text-sm">
                <p className="text-gray-500 leading-relaxed">
                  Confidence reflects how strongly the evidence supports each need or archetype — based on how many participants mentioned it, how many contexts it appeared in, and how many notes back it up.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">High</span>
                    <p className="text-xs text-emerald-800 mt-1 leading-relaxed">Pattern repeated across multiple participants and contexts. Strong, consistent signal in the data.</p>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">Medium</span>
                    <p className="text-xs text-amber-800 mt-1 leading-relaxed">Pattern is visible but appeared in a limited number of participants or contexts. Worth watching.</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Low</span>
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">Emerging signal with thin support — only one or two data points. Treat as a hypothesis.</p>
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                  <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide mb-1.5">How to increase confidence</p>
                  <ul className="space-y-1 text-xs text-blue-800">
                    <li className="flex items-start gap-1.5"><span className="flex-shrink-0 mt-0.5">→</span>Conduct more interviews — especially with participants who differ from those already interviewed</li>
                    <li className="flex items-start gap-1.5"><span className="flex-shrink-0 mt-0.5">→</span>Ensure notes are linked to named participants so evidence spread can be measured</li>
                    <li className="flex items-start gap-1.5"><span className="flex-shrink-0 mt-0.5">→</span>Add more supporting notes to insights — each note linked to an insight strengthens its evidence base</li>
                    <li className="flex items-start gap-1.5"><span className="flex-shrink-0 mt-0.5">→</span>Regenerate after adding new data — confidence scores update with each generation</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Section 1 — Emerging Needs */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Emerging user needs ({display.needs.length})
              </h3>
              {isEditor && (
                <button
                  onClick={generate}
                  disabled={generating}
                  className="text-xs px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg font-medium hover:bg-purple-100 disabled:opacity-40"
                >
                  ✨ Regenerate
                </button>
              )}
            </div>
            <div className="space-y-2">
              {display.needs.map((need: EmergingNeed, i: number) => {
                const isOpen = expandedNeeds.has(i)
                const linkedInsights = insights.filter(ins => need.linked_insight_ids.includes(ins.id))
                return (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleNeed(i)}
                      className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                    >
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 leading-snug">{need.need_statement}</p>
                        {!isOpen && need.context && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{need.context}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <ConfidenceBadge level={need.confidence} />
                        <span className="text-gray-300 text-sm">{isOpen ? '▲' : '▼'}</span>
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 pt-0 border-t border-gray-100 space-y-3">
                        {need.context && (
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 pt-3">Context</p>
                            <p className="text-sm text-gray-700">{need.context}</p>
                          </div>
                        )}
                        {need.rationale && (
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Rationale</p>
                            <p className="text-sm text-gray-600 italic leading-relaxed">{need.rationale}</p>
                          </div>
                        )}
                        {need.evidence_summary && (
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Evidence</p>
                            <p className="text-xs text-gray-500">{need.evidence_summary}</p>
                          </div>
                        )}
                        {linkedInsights.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Linked insights</p>
                            <div className="space-y-1.5">
                              {linkedInsights.map(ins => (
                                <p key={ins.id} className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 leading-snug">
                                  {ins.content}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Section 2 — Archetypes */}
          {display.archetypes.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                User archetypes ({display.archetypes.length})
              </h3>
              <div className="space-y-3">
                {display.archetypes.map((archetype: UserArchetype, i: number) => {
                  const isOpen = expandedArchetypes.has(i)
                  const attachedNeeds = archetype.attached_need_indices
                    .map((idx: number) => display.needs[idx])
                    .filter(Boolean)
                  const avatarColors = [
                    'bg-indigo-100 text-indigo-500',
                    'bg-violet-100 text-violet-500',
                    'bg-blue-100 text-blue-500',
                    'bg-teal-100 text-teal-500',
                    'bg-rose-100 text-rose-500',
                  ]
                  const avatarColor = avatarColors[i % avatarColors.length]
                  return (
                    <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleArchetype(i)}
                        className="w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${avatarColor}`}>
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd"/>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{archetype.name}</p>
                          {!isOpen && archetype.core_goal && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{archetype.core_goal}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <ConfidenceBadge level={archetype.confidence} />
                          <span className="text-gray-300 text-sm">{isOpen ? '▲' : '▼'}</span>
                        </div>
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-5 pt-0 border-t border-gray-100 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
                            {archetype.core_goal && (
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Core goal</p>
                                <p className="text-sm text-gray-700">{archetype.core_goal}</p>
                              </div>
                            )}
                            {archetype.typical_context && (
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Typical context</p>
                                <p className="text-sm text-gray-700">{archetype.typical_context}</p>
                              </div>
                            )}
                          </div>
                          {archetype.key_behaviours.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Key behaviours</p>
                              <ul className="space-y-1.5">
                                {archetype.key_behaviours.map((b: string, bi: number) => (
                                  <li key={bi} className="flex items-start gap-2 text-sm text-gray-700">
                                    <span className="text-indigo-300 mt-0.5 flex-shrink-0">→</span>
                                    {b}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {attachedNeeds.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Needs this archetype has</p>
                              <div className="flex flex-wrap gap-1.5">
                                {attachedNeeds.map((need: EmergingNeed, ni: number) => (
                                  <span key={ni} className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 text-xs rounded-full leading-snug">
                                    {need.need_statement}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {archetype.evidence_summary && (
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Evidence</p>
                              <p className="text-xs text-gray-500">{archetype.evidence_summary}</p>
                            </div>
                          )}
                          {archetype.unknowns && (
                            <div className="bg-gray-50 rounded-lg px-4 py-3">
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">What we don&apos;t know yet</p>
                              <p className="text-xs text-gray-500 italic leading-relaxed">{archetype.unknowns}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Footer provenance note */}
          {generatedAt && !draft && (
            <p className="text-xs text-gray-400 text-center pt-2">
              Generated {formatDateTime(new Date(generatedAt))} · User archetypes and emerging needs were generated from project evidence using AI and reviewed by the team.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main ReportView ────────────────────────────────────────────────────────────

export default function ReportView({ project, isEditor, onRefresh }: Props) {
  const [tab, setTab] = useState<Tab>('summary')
  const [aiDraft, setAiDraft] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [expandedRecs, setExpandedRecs] = useState<Set<string>>(new Set())

  const insights = project.insights as InsightWithIds[]
  const recommendations = project.recommendations as RecommendationWithIds[]
  const { themes, notes, interviews } = project

  const isStale = (() => {
    if (!project.executive_summary_generated_at) return false
    const genTime = new Date(project.executive_summary_generated_at).getTime()
    return [
      ...insights.map(i => new Date(i.updated_at).getTime()),
      ...recommendations.map(r => new Date(r.updated_at).getTime()),
    ].some(t => t > genTime)
  })()

  const interviewTimes = interviews.map(i => new Date(i.created_at).getTime())
  const dateFrom = interviewTimes.length > 0 ? new Date(Math.min(...interviewTimes)) : null
  const dateTo = interviewTimes.length > 0 ? new Date(Math.max(...interviewTimes)) : null

  function toggleRec(id: string) {
    setExpandedRecs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function generateSummary() {
    setAiLoading(true)
    setAiDraft(null)
    setAiError('')
    const res = await fetch('/api/ai/executive-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: project.id }),
    })
    const data = await res.json()
    if (res.ok) {
      setAiDraft(data.summary || null)
    } else {
      setAiError(data.error || 'AI unavailable — try again later')
    }
    setAiLoading(false)
  }

  async function saveSummary() {
    if (!aiDraft) return
    setSaving(true)
    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ executive_summary: aiDraft }),
    })
    if (res.ok) {
      setAiDraft(null)
      onRefresh()
    }
    setSaving(false)
  }

  function buildMarkdown(): string {
    const lines: string[] = []
    lines.push(`# ${project.title} — Research Summary`)
    lines.push('')

    lines.push('## Study Overview')
    if (project.description) lines.push(`**Research objective:** ${project.description}`)
    if (dateFrom && dateTo) lines.push(`**Study period:** ${formatDate(dateFrom)} – ${formatDate(dateTo)}`)
    lines.push('**Status:** Synthesis Complete')
    lines.push('')

    lines.push('## Research Scope')
    lines.push(`- ${project.counts.interview_count} interview${project.counts.interview_count !== 1 ? 's' : ''}`)
    lines.push(`- ${project.counts.note_count} notes captured`)
    lines.push(`- ${project.counts.theme_count} themes identified`)
    lines.push(`- ${project.counts.insight_count} insights generated`)
    lines.push(`- ${project.counts.recommendation_count} recommendations produced`)
    lines.push('')

    lines.push('## Key Themes')
    const themesWithNotes = themes
      .filter(t => (t.note_count ?? 0) > 0)
      .sort((a, b) => (b.note_count ?? 0) - (a.note_count ?? 0))
    for (const theme of themesWithNotes) {
      lines.push(`### ${theme.title} (${theme.note_count} notes)`)
      const themeNotes = notes.filter(n => n.theme_ids?.includes(theme.id)).slice(0, 2)
      for (const note of themeNotes) {
        lines.push(`> ${note.content}${note.interview_name ? ` — ${note.interview_name}` : ''}`)
      }
      lines.push('')
    }

    lines.push('## Insights')
    insights.forEach((ins, i) => {
      lines.push(`${i + 1}. ${ins.content}`)
      const linkedThemes = themes.filter(t => ins.theme_ids?.includes(t.id))
      if (linkedThemes.length > 0) lines.push(`   Themes: ${linkedThemes.map(t => t.title).join(', ')}`)
      lines.push('')
    })

    lines.push('## Recommendations')
    recommendations.forEach((rec, i) => {
      const linkedInsights = insights.filter(ins => rec.insight_ids?.includes(ins.id))
      lines.push(`${i + 1}. ${rec.content}`)
      if (linkedInsights.length > 0) {
        lines.push(`   Linked insights: ${linkedInsights.map(ins => ins.content.slice(0, 60) + (ins.content.length > 60 ? '...' : '')).join('; ')}`)
      }
      lines.push('')
    })

    if (project.executive_summary) {
      lines.push('## Executive Summary')
      lines.push(project.executive_summary)
      lines.push('')
    }

    if (project.archetypes_data) {
      const { needs, archetypes } = project.archetypes_data
      lines.push('## User Archetypes & Emerging Needs')
      lines.push('*Generated from project evidence using AI and reviewed by the team.*')
      lines.push('')
      lines.push('### Emerging User Needs')
      needs.forEach((n, i) => {
        lines.push(`${i + 1}. ${n.need_statement} [${n.confidence} confidence]`)
        if (n.context) lines.push(`   Context: ${n.context}`)
      })
      lines.push('')
      lines.push('### User Archetypes')
      archetypes.forEach((a, i) => {
        lines.push(`#### ${i + 1}. ${a.name} [${a.confidence} confidence]`)
        if (a.core_goal) lines.push(`Goal: ${a.core_goal}`)
        if (a.key_behaviours.length > 0) lines.push(`Behaviours: ${a.key_behaviours.join('; ')}`)
        if (a.unknowns) lines.push(`Unknown: ${a.unknowns}`)
        lines.push('')
      })
    }

    return lines.join('\n')
  }

  function copyMarkdown() {
    navigator.clipboard.writeText(buildMarkdown()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">

      {/* Header + export */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{project.title}</h2>
          <p className="text-sm text-gray-400 mt-1">Research Summary Report</p>
        </div>
        <button
          onClick={copyMarkdown}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 flex-shrink-0"
        >
          {copied ? '✓ Copied!' : '↓ Copy as Markdown'}
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 mb-7">
        {([
          { id: 'summary', label: 'Research summary' },
          { id: 'archetypes', label: 'User archetypes & emerging needs' },
        ] as { id: Tab; label: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-600',
            ].join(' ')}
          >
            {t.label}
            {t.id === 'archetypes' && project.archetypes_data && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-semibold rounded-full">
                {project.archetypes_data.archetypes.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Research Summary tab ─────────────────────────────────────────────── */}
      {tab === 'summary' && (
        <>
          <section className="bg-white border border-gray-200 rounded-xl p-6 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Study Overview</h3>
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                Synthesis Complete
              </span>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Research objective</p>
                {project.description
                  ? <p className="text-sm text-gray-800">{project.description}</p>
                  : <p className="text-sm text-gray-400 italic">No objective set</p>}
              </div>
              {dateFrom && dateTo && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Study period</p>
                  <p className="text-sm text-gray-800">{formatDate(dateFrom)} – {formatDate(dateTo)}</p>
                </div>
              )}
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-6 mb-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Research Scope</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
              {[
                { value: project.counts.interview_count, label: 'Interviews' },
                { value: project.counts.note_count, label: 'Notes' },
                { value: project.counts.theme_count, label: 'Themes' },
                { value: project.counts.insight_count, label: 'Insights' },
                { value: project.counts.recommendation_count, label: 'Recommendations' },
              ].map(({ value, label }) => (
                <div key={label}>
                  <div className="text-3xl font-bold text-gray-900">{value}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Key Themes</h3>
            <div className="space-y-3">
              {themes
                .filter(t => (t.note_count ?? 0) > 0)
                .sort((a, b) => (b.note_count ?? 0) - (a.note_count ?? 0))
                .map(theme => {
                  const themeNotes = notes.filter(n => n.theme_ids?.includes(theme.id)).slice(0, 2)
                  return (
                    <div key={theme.id} className="bg-white border border-gray-200 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <h4 className="text-sm font-semibold text-gray-900">{theme.title}</h4>
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                          {theme.note_count} note{theme.note_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {themeNotes.length > 0 && (
                        <div className="space-y-2">
                          {themeNotes.map(note => (
                            <blockquote key={note.id} className="border-l-2 border-purple-200 pl-3">
                              <p className="text-sm text-gray-700 italic leading-relaxed">{note.content}</p>
                              {note.interview_name && (
                                <p className="text-xs text-blue-500 mt-0.5">— {note.interview_name}</p>
                              )}
                            </blockquote>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              {themes.filter(t => (t.note_count ?? 0) > 0).length === 0 && (
                <p className="text-sm text-gray-400">No themes with notes yet.</p>
              )}
            </div>
          </section>

          <section className="mb-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Insights</h3>
            <div className="space-y-3">
              {insights.map((insight, i) => {
                const linkedThemes = themes.filter(t => insight.theme_ids?.includes(t.id))
                return (
                  <div key={insight.id} className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm text-gray-800 leading-relaxed">{insight.content}</p>
                        {linkedThemes.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {linkedThemes.map(t => (
                              <span key={t.id} className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                                {t.title}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              {insights.length === 0 && <p className="text-sm text-gray-400">No insights yet.</p>}
            </div>
          </section>

          <section className="mb-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Recommendations</h3>
            <div className="space-y-4">
              {recommendations.map((rec, i) => {
                const linkedInsights = insights.filter(ins => rec.insight_ids?.includes(ins.id))
                const isExpanded = expandedRecs.has(rec.id)
                return (
                  <div key={rec.id} className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-700 text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <p className="flex-1 text-sm text-gray-800 leading-relaxed">{rec.content}</p>
                    </div>
                    {linkedInsights.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 ml-9 mb-3">
                        {linkedInsights.map(ins => (
                          <span key={ins.id} className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full max-w-[220px] truncate">
                            {ins.content.length > 50 ? ins.content.slice(0, 50) + '...' : ins.content}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => toggleRec(rec.id)}
                      className="ml-9 text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                    >
                      {isExpanded ? '▲ Hide evidence trace' : '▼ Show evidence trace'}
                    </button>
                    {isExpanded && (
                      <div className="ml-9 mt-3">
                        {linkedInsights.length > 0
                          ? <TraceView linkedInsights={linkedInsights} themes={themes} notes={notes} />
                          : <p className="text-xs text-gray-400">No insights linked to this recommendation.</p>}
                      </div>
                    )}
                  </div>
                )
              })}
              {recommendations.length === 0 && <p className="text-sm text-gray-400">No recommendations yet.</p>}
            </div>
          </section>

          <section className="mb-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Executive Summary</h3>
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              {project.executive_summary && !aiDraft && (
                <>
                  {isStale && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-700">
                        This summary may be outdated — recent changes to insights or recommendations were detected.
                      </p>
                    </div>
                  )}
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap mb-4">
                    {project.executive_summary}
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-400">
                      Last generated {formatDateTime(new Date(project.executive_summary_generated_at!))}
                    </p>
                    {isEditor && (
                      <button
                        onClick={generateSummary}
                        disabled={aiLoading}
                        className="px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-medium hover:bg-purple-100 disabled:opacity-40"
                      >
                        {aiLoading ? 'Tracey is thinking...' : '✨ Regenerate with Tracey'}
                      </button>
                    )}
                  </div>
                </>
              )}
              {!project.executive_summary && !aiDraft && (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500 mb-4">
                    Ask Tracey to write an executive summary synthesising all your insights and recommendations into a stakeholder-ready document.
                  </p>
                  {isEditor ? (
                    <button
                      onClick={generateSummary}
                      disabled={aiLoading}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-40"
                    >
                      {aiLoading ? 'Tracey is thinking...' : '✨ Ask Tracey to write executive summary'}
                    </button>
                  ) : (
                    <p className="text-xs text-gray-400">No executive summary yet.</p>
                  )}
                </div>
              )}
              {aiError && (
                <p className="text-xs text-red-500 mt-1.5">{aiError}</p>
              )}
              {aiDraft && (
                <div>
                  <p className="text-xs font-semibold text-purple-700 mb-3">Tracey&apos;s draft — review and edit before saving:</p>
                  <textarea
                    value={aiDraft}
                    onChange={e => setAiDraft(e.target.value)}
                    rows={10}
                    className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm text-gray-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none mb-3"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveSummary}
                      disabled={saving}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save summary'}
                    </button>
                    <button
                      onClick={() => setAiDraft(null)}
                      className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* ── Archetypes tab ───────────────────────────────────────────────────── */}
      {tab === 'archetypes' && (
        <ArchetypesTab
          project={project}
          insights={insights}
          isEditor={isEditor}
          onRefresh={onRefresh}
        />
      )}

    </div>
  )
}
