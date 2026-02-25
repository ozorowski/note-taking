'use client'

import Link from 'next/link'
import LogoutButton from './LogoutButton'

interface Props {
  userName: string
  isAdmin?: boolean
  activePage?: 'projects' | 'admin'
}

export default function AppNav({ userName, isAdmin, activePage }: Props) {
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-xl font-bold tracking-tight">Trace</span>
          {isAdmin && (
            <div className="flex items-center gap-1">
              <Link
                href="/projects"
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  activePage === 'projects'
                    ? 'font-medium text-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                Projects
              </Link>
              <Link
                href="/admin"
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  activePage === 'admin'
                    ? 'font-medium text-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                Admin
              </Link>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{userName}</span>
          <LogoutButton />
        </div>
      </div>
    </nav>
  )
}
