'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteProjectButton({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <>
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setShowModal(true) }}
        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 text-lg leading-none transition-opacity"
        title="Delete project"
      >
        ×
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={e => { e.preventDefault(); e.stopPropagation(); if (!loading) setShowModal(false) }}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4"
            onClick={e => { e.preventDefault(); e.stopPropagation() }}
          >
            <h2 className="text-base font-semibold text-gray-900 mb-1">Delete project?</h2>
            <p className="text-sm text-gray-500 mb-1">
              <span className="font-medium text-gray-700">{projectTitle}</span> will be permanently deleted,
              including all interviews, notes, themes, insights, and recommendations.
            </p>
            <p className="text-sm font-medium text-red-600 mb-5">This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); setShowModal(false) }}
                disabled={loading}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Deleting…' : 'Delete project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
