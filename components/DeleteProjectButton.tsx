'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteProjectButton({ projectId }: { projectId: string }) {
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
    router.refresh()
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-1" onClick={e => e.preventDefault()}>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="px-2 py-0.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? '…' : 'Delete'}
        </button>
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirm(false) }}
          className="px-2 py-0.5 text-gray-500 hover:text-gray-700 text-xs"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirm(true) }}
      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 text-lg leading-none transition-opacity"
      title="Delete project"
    >
      ×
    </button>
  )
}
