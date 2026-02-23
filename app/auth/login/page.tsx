'use client'

import { FormEvent, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type Mode = 'guest' | 'email'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('guest')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const errorParam = searchParams.get('error')

  async function handleGuestSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError('')
    setLoading(true)

    const res = await fetch('/api/auth/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Something went wrong')
      setLoading(false)
      return
    }

    router.push('/projects')
    router.refresh()
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setError('')
    setLoading(true)

    const res = await fetch('/api/auth/magic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Something went wrong')
      setLoading(false)
      return
    }

    setEmailSent(true)
    setLoading(false)
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        <h1 className="text-3xl font-bold mb-3 text-center">Trace</h1>
        <p className="text-sm font-medium text-gray-700 text-center mb-1">Structured research synthesis.</p>
        <p className="text-sm text-gray-500 text-center mb-6">
          Work with your team from interviews to recommendations,<br />with full evidence traceability.
        </p>

        {/* Mode tabs */}
        <div className="flex rounded-lg border border-gray-200 p-1 mb-6 bg-gray-50">
          <button
            type="button"
            onClick={() => { setMode('email'); setError('') }}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === 'email' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Sign in with email
          </button>
          <button
            type="button"
            onClick={() => { setMode('guest'); setError('') }}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === 'guest' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Guest
          </button>
        </div>

        {(error || errorParam) && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
            {error || (errorParam === 'expired' ? 'That sign-in link has expired. Please request a new one.' : 'Invalid sign-in link.')}
          </div>
        )}

        {mode === 'email' ? (
          emailSent ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-3">📬</div>
              <p className="font-semibold text-gray-900 mb-1">Check your inbox</p>
              <p className="text-sm text-gray-500">We sent a sign-in link to<br /><span className="font-medium text-gray-700">{email}</span></p>
              <p className="text-xs text-gray-400 mt-3">The link expires in 15 minutes.</p>
              <button
                type="button"
                onClick={() => { setEmailSent(false); setEmail('') }}
                className="mt-4 text-xs text-blue-600 hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending link...' : 'Send sign-in link →'}
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handleGuestSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Your name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Sarah"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Getting started...' : 'Get started →'}
            </button>
            <p className="text-center text-xs text-gray-400">
              No password needed. Session saved in your browser only.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
