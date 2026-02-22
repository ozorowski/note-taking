import { verifyAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { query } from '@/lib/db'
import type { Board } from '@/lib/types'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'

export default async function DashboardPage() {
  const user = await verifyAuth()

  if (!user) {
    redirect('/auth/login')
  }

  // Fetch boards for this user
  const result = await query<Board & { role: string }>(
    `SELECT b.*, bm.role
     FROM boards b
     LEFT JOIN board_memberships bm ON b.id = bm.board_id AND bm.user_id = $1
     WHERE b.owner_id = $1 OR bm.user_id = $1
     ORDER BY b.created_at DESC`,
    [user.id]
  )

  const boards = result.rows

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">NoteTaking</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">{user.name}</span>
            <LogoutButton />
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">Your Boards</h2>
          <Link
            href="/dashboard/new"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + New Board
          </Link>
        </div>

        {boards.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow text-center">
            <p className="text-gray-600 mb-4">No boards yet. Create one to get started!</p>
            <Link
              href="/dashboard/new"
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Create Your First Board
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {boards.map((board) => (
              <Link
                key={board.id}
                href={`/dashboard/${board.id}`}
                className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
              >
                <h3 className="text-xl font-semibold mb-2">{board.title}</h3>
                <p className="text-gray-600 text-sm mb-2">{board.description}</p>
                <span className="inline-block px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded capitalize">
                  {board.role || 'owner'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
