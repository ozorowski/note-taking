import { verifyAuth } from '@/lib/auth'
import { query } from '@/lib/db'
import { redirect } from 'next/navigation'

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const user = await verifyAuth()

  if (!user) {
    redirect(`/auth/login?returnUrl=/invite/${token}`)
  }

  // Look up the invite
  const inviteResult = await query(
    `SELECT pi.*, p.title AS project_title
     FROM project_invites pi
     JOIN projects p ON p.id = pi.project_id
     WHERE pi.token = $1
       AND (pi.expires_at IS NULL OR pi.expires_at > NOW())`,
    [token]
  )

  if (inviteResult.rows.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm text-center">
          <div className="text-3xl mb-3">⚠️</div>
          <h1 className="text-lg font-semibold mb-2">Invite link expired</h1>
          <p className="text-sm text-gray-500 mb-4">This invite link is no longer valid. Ask the project owner for a new one.</p>
          <a href="/projects" className="text-sm text-blue-600 hover:underline">Go to your projects</a>
        </div>
      </div>
    )
  }

  const invite = inviteResult.rows[0]

  // Add user to project (no-op if already a member)
  await query(
    `INSERT INTO project_memberships (project_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (project_id, user_id) DO NOTHING`,
    [invite.project_id, user.id, invite.role]
  )

  // Increment usage counter
  await query('UPDATE project_invites SET used_count = used_count + 1 WHERE id = $1', [invite.id])

  redirect(`/projects/${invite.project_id}`)
}
