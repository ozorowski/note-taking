'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewProjectPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [mode, setMode] = useState<'blank' | 'demo'>('blank')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() && mode === 'blank') { setError('Title is required'); return }
    setError('')
    setLoading(true)

    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: mode === 'demo' ? (title.trim() || 'Demo Project') : title.trim(),
        description: description.trim() || null,
        demo: mode === 'demo',
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
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <Link href="/projects" className="text-sm text-gray-500 hover:text-gray-800">← Back to projects</Link>
        </div>
      </nav>

      <main className="max-w-lg mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-2">New project</h1>
        <p className="text-gray-500 text-sm mb-8">Start from scratch or load a demo to explore the workflow.</p>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

        {/* Mode selector */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => setMode('blank')}
            className={`p-4 rounded-xl border-2 text-left transition-colors ${mode === 'blank' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
          >
            <div className="text-xl mb-2">📋</div>
            <div className="font-semibold text-sm">Blank project</div>
            <div className="text-xs text-gray-500 mt-1">Start from scratch with your own research</div>
          </button>
          <button
            type="button"
            onClick={() => setMode('demo')}
            className={`p-4 rounded-xl border-2 text-left transition-colors ${mode === 'demo' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
          >
            <div className="text-xl mb-2">🧪</div>
            <div className="font-semibold text-sm">Demo project</div>
            <div className="text-xs text-gray-500 mt-1">30 notes, 5 themes — explore clustering and insights</div>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project title {mode === 'demo' && <span className="text-gray-400 font-normal">(optional for demo)</span>}
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={mode === 'demo' ? 'Demo Project' : 'e.g. Mobile checkout research Q1'}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What's this project about?"
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {mode === 'demo' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
              Starts at the Themes phase with 3 interviews, 30 notes, and 5 partially-clustered themes ready to explore.
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : mode === 'demo' ? 'Create demo project' : 'Create project'}
          </button>
        </form>
      </main>
    </div>
  )
}
