'use client'

interface Props {
  message?: string
}

export default function TraceyModal({ message = 'Thinking…' }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-[2px]">
      <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-5 w-72">
        {/* Animated orb */}
        <div className="relative flex items-center justify-center w-16 h-16">
          <div className="absolute w-16 h-16 rounded-full bg-purple-200 animate-ping opacity-60" />
          <div className="absolute w-12 h-12 rounded-full bg-purple-100 animate-pulse" />
          <span className="relative text-2xl select-none">✨</span>
        </div>

        {/* Label */}
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-gray-800">Tracey</p>
          <p className="text-xs text-gray-500">{message}</p>
        </div>

        {/* Bouncing dots */}
        <div className="flex gap-1.5 items-center">
          {[0, 150, 300].map(delay => (
            <span
              key={delay}
              className="block w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
