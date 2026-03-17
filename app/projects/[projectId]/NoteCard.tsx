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
  showGuideQuestion?: boolean
  showId?: boolean
  /** When true, shows hover action icons (edit/delete/share). Used by CapturePhase only. */
  showActions?: boolean
  /** Nudges card content right on hover to make room for a selection checkbox.
   *  Requires a `group/note` ancestor. */
  selectNudge?: boolean
  isSelected?: boolean
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
  showGuideQuestion,
  showId,
  showActions,
  selectNudge,
  isSelected,
}: NoteCardProps) {
  const badge = note.evidence_type ? EVIDENCE_BADGE[note.evidence_type] : null
  const isPrivate = note.visibility === 'private'
  const isOwn = note.created_by === currentUserId

  const hasActions = showActions && isEditor && (onEdit || onDelete || (onShare && isPrivate && isOwn))

  return (
    <div
      className={[
        'relative bg-white border rounded-xl p-4 flex flex-col gap-2.5 group transition-all',
        isSelected ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-200',
        !showActions && onEdit ? 'cursor-pointer hover:border-blue-400 hover:ring-1 hover:ring-blue-400' : '',
        selectNudge ? (isSelected ? 'pl-[52px]' : 'group-hover/note:pl-[52px]') : '',
      ].join(' ')}
      onClick={!showActions && onEdit ? onEdit : undefined}
    >
      {/* ── Actions — only in CapturePhase (showActions=true) ─── */}
      {hasActions && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {onShare && isPrivate && isOwn && (
            <button
              onClick={e => { e.stopPropagation(); onShare() }}
              className="text-[11px] text-gray-300 hover:text-emerald-600 whitespace-nowrap transition-colors"
              title="Share with team"
            >
              Share →
            </button>
          )}
          {onEdit && (
            <button
              onClick={e => { e.stopPropagation(); onEdit() }}
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
              onClick={e => { e.stopPropagation(); window.confirm('Delete this note?') && onDelete() }}
              className="text-gray-300 hover:text-red-500 text-xl leading-none transition-colors"
              title="Delete note"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* ── Top row: ID left, author + timestamp right (or left when no ID) ── */}
      {(showId && note.display_number || (showAuthor && note.creator_name) || showTimestamp) && (
        <div className="flex items-center justify-between gap-2">
          {showId && note.display_number ? (
            <>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                Note {note.display_number}
              </span>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-300 shrink-0">
                {showAuthor && note.creator_name && (
                  <span>{note.creator_name}</span>
                )}
                {showTimestamp && (
                  <span>
                    {showAuthor && note.creator_name && '· '}
                    {new Date(note.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                    {' · '}
                    {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-300">
              {showAuthor && note.creator_name && (
                <span>{note.creator_name}</span>
              )}
              {showTimestamp && (
                <span>
                  {showAuthor && note.creator_name && '· '}
                  {new Date(note.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                  {' · '}
                  {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────── */}
      <p className="text-sm text-gray-800 leading-relaxed break-words">{note.content}</p>

      {/* ── Source attribution (url_import) ────────────── */}
      {note.source_type === 'url_import' && (
        <p className="text-[11px] text-gray-400 -mt-1 truncate">
          {note.source_author && <span className="font-medium">{note.source_author} · </span>}
          Imported
        </p>
      )}

      {/* ── Bottom row ─────────────────────────────────────── */}
      {(note.interview_name || badge || (showGuideQuestion && note.guide_question_text) || (isPrivate && isOwn)) && (
        <div className="flex items-center gap-2 flex-wrap">
          {note.interview_name && (
            <span className="text-[11px] text-blue-600 bg-blue-50 rounded-full px-2 py-0.5 truncate max-w-[160px]" title={note.interview_name}>
              {note.interview_name}
            </span>
          )}
          {badge && (
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${badge.className}`}>
              {badge.label}
            </span>
          )}
          {showGuideQuestion && note.guide_question_text && (
            <span
              className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 truncate max-w-[180px]"
              title={note.guide_question_text}
            >
              {note.guide_question_text}
            </span>
          )}
          {isPrivate && isOwn && (
            <span className="text-[11px] text-gray-400">🔒 private</span>
          )}
        </div>
      )}
    </div>
  )
}
