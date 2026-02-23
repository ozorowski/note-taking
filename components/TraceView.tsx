import type { Insight, Theme, Note } from '@/lib/types'

interface Props {
  linkedInsights: (Insight & { theme_ids?: string[] })[]
  themes: Theme[]
  notes: Note[]
}

export default function TraceView({ linkedInsights, themes, notes }: Props) {
  if (linkedInsights.length === 0) {
    return <p className="text-sm text-gray-400">No insights linked yet.</p>
  }

  return (
    <div className="space-y-3 text-sm">
      {linkedInsights.map(insight => {
        const insightThemes = themes.filter(t => insight.theme_ids?.includes(t.id))

        return (
          <div key={insight.id} className="border border-green-200 rounded-lg overflow-hidden">
            <div className="bg-green-50 px-3 py-2.5">
              <span className="text-[10px] font-semibold text-green-600 uppercase tracking-wide">Insight</span>
              <p className="text-xs text-gray-800 mt-0.5 leading-relaxed">{insight.content}</p>
            </div>

            {insightThemes.map(theme => {
              const themeNotes = notes.filter(n => n.theme_ids?.includes(theme.id))

              return (
                <div key={theme.id} className="border-t border-green-100">
                  <div className="bg-purple-50 px-3 py-2">
                    <span className="text-[10px] font-semibold text-purple-600 uppercase tracking-wide">Theme</span>
                    <span className="text-xs text-purple-800 ml-2">{theme.title}</span>
                  </div>
                  {themeNotes.slice(0, 3).map(note => (
                    <div key={note.id} className="border-t border-purple-50 pl-6 px-3 py-2">
                      <p className="text-xs text-gray-600 leading-relaxed">{note.content}</p>
                      {note.interview_name && (
                        <p className="text-[10px] text-blue-500 mt-0.5">{note.interview_name}</p>
                      )}
                    </div>
                  ))}
                  {themeNotes.length > 3 && (
                    <p className="text-[11px] text-gray-400 pl-6 px-3 py-1.5">
                      +{themeNotes.length - 3} more notes
                    </p>
                  )}
                </div>
              )
            })}

            {insightThemes.length === 0 && (
              <div className="border-t border-green-100 px-3 py-2">
                <p className="text-xs text-gray-400">No themes linked to this insight</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
