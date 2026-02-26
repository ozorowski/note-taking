'use client'

import type { Note } from '@/lib/types'

export const EVIDENCE_BADGE: Record<string, { label: string; className: string }> = {
  quote: { label: 'Quote', className: 'bg-blue-100 text-blue-700' },
  observation: { label: 'Observation', className: 'bg-purple-100 text-purple-700' },
  pain_point: { label: 'Pain Point', className: 'bg-rose-100 text-rose-700' },
  need: { label: 'Other', className: 'bg-amber-100 text-amber-700' },
}

interface NoteCardProps {
  note: Note
  currentUserId: string
  isEditor: boolean
  onEdit?: () => void
  onDelete?: () => void
  onShare?: () => void
  showTimestamp?: boolean
  showAuthor?: boolean
}

export default function NoteCard({
  note,
  currentUserId,
  isEditor,
  onEdit,
  onDelete,
  onShare,
  showTimestamp,
  showAuthor,
}: NoteCardProps) {
  const badge = note.evidence_type ? EVIDENCE_BADGE[note.evidence_type] : null
  const isPrivate = note.visibility === 'private'
  const isOwn = note.created_by === currentUserId

  const hasActions = isEditor && (onEdit || onDelete || (onShare && isPrivate && isOwn))

  return (
    <div className="relative bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2.5 group">
      {/* ── Actions — absolute top-right, hover only ──────── */}
      {hasActions && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {onShare && isPrivate && isOwn && (
            <button
              onClick={onShare}
              className="text-[11px] text-gray-300 hover:text-emerald-600 whitespace-nowrap transition-colors"
              title="Share with team"
            >
              Share →
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="text-gray-300 hover:text-blue-500 transition-colors"
              title="Edit note"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => window.confirm('Delete this note?') && onDelete()}
              className="text-gray-300 hover:text-red-500 text-xl leading-none transition-colors"
              title="Delete note"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* ── Interview label (top) ─────────────────────────── */}
      {note.interview_name && (
        <span className="text-xs text-blue-600 bg-blue-50 rounded-full px-2.5 py-0.5 self-start">
          {note.interview_name}
        </span>
      )}

      {/* ── Content ─────────────────────────────────────── */}
      <p className="text-sm text-gray-800 leading-relaxed">{note.content}</p>

      {/* ── Source attribution (url_import) ────────────── */}
      {note.source_type === 'url_import' && (
        <p className="text-[11px] text-gray-400 -mt-1 truncate">
          {note.source_author && <span className="font-medium">{note.source_author} · </span>}
          Imported
        </p>
      )}

      {/* ── Bottom row: evidence badge + private + author + timestamp ─ */}
      {(badge || (isPrivate && isOwn) || (showAuthor && note.creator_name) || showTimestamp) && (
        <div className="flex items-center gap-2 flex-wrap">
          {badge && (
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${badge.className}`}>
              {badge.label}
            </span>
          )}
          {isPrivate && isOwn && (
            <span className="text-[11px] text-gray-400">🔒 private</span>
          )}
          {showAuthor && note.creator_name && (
            <span className="text-[11px] text-gray-400">{note.creator_name}</span>
          )}
          {showTimestamp && (
            <span className="text-[11px] text-gray-300">
              {new Date(note.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}
              {' · '}
              {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
