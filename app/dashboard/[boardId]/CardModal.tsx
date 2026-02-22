'use client'

import { useState, useEffect } from 'react'
import type { User } from '@/lib/types'

interface CardDetail {
  id: string
  title: string
  description: string | null
  tags: string[]
  ai_summary: string | null
  comments: Array<{ id: string; content: string; author_name: string; created_at: string }>
}

interface Props {
  cardId: string
  currentUser: User
  isEditor: boolean
  onClose: () => void
}

export default function CardModal({ cardId, isEditor, onClose }: Props) {
  const [card, setCard] = useState<CardDetail | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [comment, setComment] = useState('')
  const [aiLoading, setAiLoading] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/cards/${cardId}`)
      .then(r => r.json())
      .then(data => {
        setCard(data)
        setTitle(data.title)
        setDescription(data.description || '')
        setTagsInput(data.tags.join(', '))
      })
  }, [cardId])

  async function save() {
    setSaving(true)
    await fetch(`/api/cards/${cardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    })
    // Save tags
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
    await fetch(`/api/cards/${cardId}/tags`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    })
    setSaving(false)
    onClose()
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault()
    if (!comment.trim()) return
    const res = await fetch(`/api/cards/${cardId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: comment }),
    })
    if (res.ok) {
      const newComment = await res.json()
      setCard(prev => prev ? { ...prev, comments: [...prev.comments, newComment] } : prev)
      setComment('')
    }
  }

  async function runAI(action: 'summarize' | 'suggest-tags') {
    setAiLoading(action)
    const res = await fetch(`/api/ai/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId }),
    })
    const data = await res.json()
    if (action === 'summarize' && data.summary) {
      setCard(prev => prev ? { ...prev, ai_summary: data.summary } : prev)
    }
    if (action === 'suggest-tags' && data.tags) {
      setTagsInput(data.tags.join(', '))
    }
    setAiLoading(null)
  }

  if (!card) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">Loading...</div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-start gap-2">
            <div className="flex-1">
              {isEditor ? (
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full text-xl font-bold border-b border-gray-200 pb-1 focus:outline-none focus:border-blue-400"
                />
              ) : (
                <h2 className="text-xl font-bold">{title}</h2>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
            {isEditor ? (
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Add a description..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{description || 'No description'}</p>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Tags (comma-separated)</label>
            {isEditor ? (
              <input
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                placeholder="e.g. usability, pain-point, mobile"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            ) : (
              <div className="flex flex-wrap gap-1">
                {card.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* AI Summary */}
          {card.ai_summary && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-yellow-700 mb-1">AI Summary</p>
              <p className="text-sm text-gray-700">{card.ai_summary}</p>
            </div>
          )}

          {/* AI Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => runAI('summarize')}
              disabled={aiLoading !== null}
              className="px-3 py-1 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded text-sm disabled:opacity-50"
            >
              {aiLoading === 'summarize' ? 'Summarising...' : '✦ Summarise this card'}
            </button>
            <button
              onClick={() => runAI('suggest-tags')}
              disabled={aiLoading !== null}
              className="px-3 py-1 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded text-sm disabled:opacity-50"
            >
              {aiLoading === 'suggest-tags' ? 'Suggesting...' : '✦ Suggest tags'}
            </button>
          </div>

          {/* Save button */}
          {isEditor && (
            <button
              onClick={save}
              disabled={saving}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}

          {/* Comments */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Comments</h3>
            <div className="space-y-3 mb-3">
              {card.comments.length === 0 && (
                <p className="text-sm text-gray-400">No comments yet.</p>
              )}
              {card.comments.map(c => (
                <div key={c.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-700">{c.author_name}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{c.content}</p>
                </div>
              ))}
            </div>
            <form onSubmit={postComment} className="flex gap-2">
              <input
                type="text"
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                Post
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
