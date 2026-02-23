'use client'

import { useState } from 'react'
import type { FullProject, Insight, Recommendation } from '@/lib/types'
import TraceView from '@/components/TraceView'

type InsightWithIds = Insight & { theme_ids?: string[] }
type RecommendationWithIds = Recommendation & { insight_ids?: string[] }

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

export default function ReportView({ project, isEditor, onRefresh }: Props) {
  const [aiDraft, setAiDraft] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [expandedRecs, setExpandedRecs] = useState<Set<string>>(new Set())

  const insights = project.insights as InsightWithIds[]
  const recommendations = project.recommendations as RecommendationWithIds[]
  const { themes, notes, interviews } = project

  // Staleness: any insight/rec updated after the summary was generated
  const isStale = (() => {
    if (!project.executive_summary_generated_at) return false
    const genTime = new Date(project.executive_summary_generated_at).getTime()
    return [
      ...insights.map(i => new Date(i.updated_at).getTime()),
      ...recommendations.map(r => new Date(r.updated_at).getTime()),
    ].some(t => t > genTime)
  })()

  // Interview date range
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
    const res = await fetch('/api/ai/executive-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: project.id }),
    })
    if (res.ok) {
      const data = await res.json()
      setAiDraft(data.summary || null)
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
      if (ins.evidence_summary) lines.push(`   *Evidence: ${ins.evidence_summary}*`)
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
      <div className="flex items-start justify-between mb-8 gap-4">
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

      {/* 1. Study Overview */}
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

      {/* 2. Research Scope */}
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

      {/* 3. Key Themes */}
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

      {/* 4. Insights */}
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
                    {insight.evidence_summary && (
                      <p className="text-xs text-gray-500 italic mt-2">{insight.evidence_summary}</p>
                    )}
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

      {/* 5. Recommendations + Evidence Trace */}
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

      {/* 6. Executive Summary */}
      <section className="mb-5">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Executive Summary</h3>
        <div className="bg-white border border-gray-200 rounded-xl p-6">

          {/* Saved summary */}
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

          {/* No summary yet */}
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

          {/* Draft from AI */}
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

    </div>
  )
}
