'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface ImportedItem {
  content: string
  author: string | null
  evidence_type: 'quote' | 'observation' | 'pain_point' | 'need' | null
}

interface ImportPreview {
  items: ImportedItem[]
  source_title: string
  item_count: number
  source_kind: 'reddit' | 'web'
}

type BlankStep = 'details' | 'guide_choice' | 'guide_build'

export default function NewProjectPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [mode, setMode] = useState<'blank' | 'demo' | 'url'>('blank')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  // Blank mode multi-step state
  const [blankStep, setBlankStep] = useState<BlankStep>('details')
  const [draftQuestions, setDraftQuestions] = useState<Array<{ text: string; stage_label: string }>>([
    { text: '', stage_label: '' },
  ])

  // URL import state
  const [urlInput, setUrlInput] = useState('')
  const [urlStep, setUrlStep] = useState<'input' | 'preview'>('input')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [fetchingUrl, setFetchingUrl] = useState(false)

  async function handleFetchUrl() {
    if (!urlInput.trim()) return
    setFetchingUrl(true)
    setError('')
    try {
      const res = await fetch('/api/ai/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to fetch URL')
        return
      }
      setPreview(data)
      setUrlStep('preview')
      if (!title.trim()) {
        setTitle(data.source_title || '')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setFetchingUrl(false)
    }
  }

  async function createProject(withGuide: boolean, questions: Array<{ text: string; stage_label: string }>) {
    setError('')
    setLoading(true)
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || null,
      }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Failed to create project')
      setLoading(false)
      return
    }
    const project = await res.json()

    if (withGuide) {
      const validQuestions = questions
        .filter(q => q.text.trim())
        .map((q, i) => ({ text: q.text.trim(), stage_label: q.stage_label.trim() || null, order_index: i }))
      await fetch(`/api/projects/${project.id}/guide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: validQuestions }),
      })
    }

    router.push(`/projects/${project.id}`)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'url') {
      if (!preview) return
      if (!title.trim()) { setError('Title is required'); return }
      setError('')
      setLoading(true)
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          url_import: true,
          notes: preview.items,
          source_url: urlInput.trim(),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to create project')
        setLoading(false)
        return
      }
      const project = await res.json()
      router.push(`/projects/${project.id}`)
      return
    }

    if (mode === 'demo') {
      setError('')
      setLoading(true)
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demo: true }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to create project')
        setLoading(false)
        return
      }
      const project = await res.json()
      router.push(`/projects/${project.id}`)
    }
  }

  function addDraftQuestion() {
    setDraftQuestions(prev => [...prev, { text: '', stage_label: '' }])
  }

  function removeDraftQuestion(i: number) {
    setDraftQuestions(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateDraftQuestion(i: number, field: 'text' | 'stage_label', value: string) {
    setDraftQuestions(prev => prev.map((q, idx) => idx === i ? { ...q, [field]: value } : q))
  }

  const classifiedCount = preview?.items.filter(i => i.evidence_type !== null).length ?? 0

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <Link href="/projects" className="text-sm text-gray-500 hover:text-gray-800">← Back to projects</Link>
        </div>
      </nav>

      <main className="max-w-lg mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-2">New project</h1>
        <p className="text-gray-500 text-sm mb-8">Choose how you want to start your research project.</p>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

        {/* Mode selector */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <button
            type="button"
            onClick={() => { setMode('blank'); setBlankStep('details'); setError('') }}
            className={`p-4 rounded-xl border-2 text-left transition-colors ${mode === 'blank' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
          >
            <div className="text-xl mb-2">📋</div>
            <div className="font-semibold text-sm">Start with interviews</div>
            <div className="text-xs text-gray-500 mt-1">Capture and analyse your own research.</div>
          </button>
          <button
            type="button"
            onClick={() => { setMode('url'); setError('') }}
            className={`p-4 rounded-xl border-2 text-left transition-colors ${mode === 'url' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
          >
            <div className="text-xl mb-2">🔗</div>
            <div className="font-semibold text-sm">Analyse public feedback</div>
            <div className="text-xs text-gray-500 mt-1">Import Reddit threads, forums, or public pages.</div>
          </button>
          <button
            type="button"
            onClick={() => { setMode('demo'); setError('') }}
            className={`p-4 rounded-xl border-2 text-left transition-colors ${mode === 'demo' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
          >
            <div className="text-xl mb-2">🧪</div>
            <div className="font-semibold text-sm">Explore a sample project</div>
            <div className="text-xs text-gray-500 mt-1">See how notes become themes and insights.</div>
          </button>
        </div>

        {/* URL import flow */}
        {mode === 'url' && urlStep === 'input' && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Public URL</label>
              <input
                type="text"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleFetchUrl() } }}
                placeholder="https://reddit.com/r/… or any public page"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1.5">Only paste URLs you have rights to analyse.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0.5">Research objectives <span className="text-gray-400 font-normal">(optional)</span></label>
              <p className="text-xs text-gray-400 mb-1.5">Add your goals to guide how AI generates and prioritises insights and recommendations.</p>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Understand pain points from community discussion"
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <button
              type="button"
              disabled={fetchingUrl || !urlInput.trim()}
              onClick={handleFetchUrl}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {fetchingUrl ? 'Fetching content…' : 'Fetch content'}
            </button>
          </div>
        )}

        {mode === 'url' && urlStep === 'preview' && preview && (
          <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            {/* Preview banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <div className="font-medium">{preview.source_title}</div>
              <div className="text-xs text-blue-600 mt-0.5">
                {preview.item_count} {preview.source_kind === 'reddit' ? 'comments' : 'passages'} found
                {classifiedCount > 0 && ` · ${classifiedCount} AI-classified`}
              </div>
            </div>

            <button
              type="button"
              onClick={() => { setUrlStep('input'); setPreview(null); setError('') }}
              className="text-xs text-gray-500 hover:text-gray-700 -mt-1"
            >
              ← Change URL
            </button>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Reddit feedback on onboarding"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0.5">Research objectives <span className="text-gray-400 font-normal">(optional)</span></label>
              <p className="text-xs text-gray-400 mb-1.5">Add your goals to guide how AI generates and prioritises insights and recommendations.</p>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Understand pain points from community discussion"
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Importing…' : 'Import & create project'}
            </button>
          </form>
        )}

        {/* Demo form — no inputs needed, title/description are predefined */}
        {mode === 'demo' && (
          <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">Deliveroo Checkout &amp; Navigation Usability Study</p>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mt-2 mb-0.5">Research objective</p>
                <p className="text-xs text-gray-700 leading-relaxed">
                  Evaluate the end-to-end ordering experience on the Deliveroo app, from restaurant discovery to order completion, with a focus on task success and user confidence.
                </p>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  10 participants, 140 notes. Structured discussion guide with 8 questions across 4 stages.
                  Starts at the Themes phase — ready for AI clustering, insight generation, and recommendations.
                </p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                This is a sample project for exploring Trace. It won&apos;t affect your real research.
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Load sample project'}
            </button>
          </form>
        )}

        {/* Blank (interview) project — multi-step form */}
        {mode === 'blank' && (

          /* ── Step 1: Title + objectives ───────────────────────────────── */
          blankStep === 'details' ? (
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (title.trim()) setBlankStep('guide_choice') } }}
                  placeholder="e.g. Mobile checkout research Q1"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0.5">Research objectives <span className="text-gray-400 font-normal">(optional)</span></label>
                <p className="text-xs text-gray-400 mb-1.5">Add your goals to guide how AI generates and prioritises insights and recommendations.</p>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. Understand how users discover and order food on mobile"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <button
                type="button"
                disabled={!title.trim()}
                onClick={() => setBlankStep('guide_choice')}
                className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                Continue →
              </button>
            </div>

          /* ── Step 2: Guide choice ──────────────────────────────────────── */
          ) : blankStep === 'guide_choice' ? (
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
              <button
                type="button"
                onClick={() => setBlankStep('details')}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                ← Back
              </button>
              <div>
                <h2 className="text-sm font-semibold text-gray-800 mb-1">Will you be using a discussion guide?</h2>
                <p className="text-xs text-gray-500">A discussion guide lets you assign notes to specific questions during capture, making your research more structured and traceable.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setBlankStep('guide_build')}
                  className="p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50 text-left transition-colors"
                >
                  <div className="text-lg mb-1">📝</div>
                  <div className="font-semibold text-sm text-gray-800">Yes, set one up</div>
                  <div className="text-xs text-gray-500 mt-0.5">Add questions now or later</div>
                </button>
                <button
                  type="button"
                  onClick={() => createProject(false, [])}
                  disabled={loading}
                  className="p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50 text-left transition-colors disabled:opacity-50"
                >
                  <div className="text-lg mb-1">🗒️</div>
                  <div className="font-semibold text-sm text-gray-800">No, explore freely</div>
                  <div className="text-xs text-gray-500 mt-0.5">Unstructured note capture</div>
                </button>
              </div>
            </div>

          /* ── Step 3: Guide builder ─────────────────────────────────────── */
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
              <button
                type="button"
                onClick={() => setBlankStep('guide_choice')}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                ← Back
              </button>
              <div>
                <h2 className="text-sm font-semibold text-gray-800 mb-1">Set up your discussion guide</h2>
                <p className="text-xs text-gray-500">Add the questions you plan to ask. You can also add or edit questions later inside the project. An &ldquo;Other observation&rdquo; option is always included automatically.</p>
              </div>
              <div className="space-y-1">
                {draftQuestions.map((q, i) => (
                  <div key={i} className="group flex items-center gap-1">
                    <input
                      type="text"
                      value={q.text}
                      onChange={e => updateDraftQuestion(i, 'text', e.target.value)}
                      placeholder={`Question ${i + 1}`}
                      autoFocus={i === draftQuestions.length - 1 && i > 0}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    {draftQuestions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDraftQuestion(i)}
                        className="text-gray-300 hover:text-red-400 text-lg leading-none transition-colors p-0.5 cursor-pointer flex-shrink-0 opacity-0 group-hover:opacity-100"
                        title="Remove question"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addDraftQuestion}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                + Add question
              </button>
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <button
                  type="button"
                  disabled={loading || !draftQuestions.some(q => q.text.trim())}
                  onClick={() => createProject(true, draftQuestions)}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create project'}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => createProject(false, [])}
                  className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
                >
                  Skip guide for now
                </button>
              </div>
            </div>
          )
        )}
      </main>
    </div>
  )
}
