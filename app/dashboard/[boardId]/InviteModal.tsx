'use client'

import { useState } from 'react'

interface Member {
  id: string
  name: string
  email: string
  role: string
}

interface Props {
  boardId: string
  members: Member[]
  onClose: () => void
}

export default function InviteModal({ boardId, members, onClose }: Props) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    const res = await fetch(`/api/boards/${boardId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Failed to invite user')
    } else {
      setSuccess(`${data.name} added as ${role}`)
      setEmail('')
    }
  }

  async function removeMember(userId: string) {
    await fetch(`/api/boards/${boardId}/members?userId=${userId}`, { method: 'DELETE' })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Board Members</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {/* Existing members */}
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3 py-2 border-b border-gray-100">
              <div className="flex-1">
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-xs text-gray-400">{m.email}</p>
              </div>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded capitalize">{m.role}</span>
              {m.role !== 'owner' && (
                <button
                  onClick={() => removeMember(m.id)}
                  className="text-gray-300 hover:text-red-500 text-lg leading-none"
                >×</button>
              )}
            </div>
          ))}
        </div>

        {/* Invite form */}
        <form onSubmit={handleInvite} className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Invite by email</h3>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="colleague@example.com"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
          <div className="flex gap-2">
            <select
              value={role}
              onChange={e => setRole(e.target.value as 'editor' | 'viewer')}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer (read-only)</option>
            </select>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Inviting...' : 'Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
