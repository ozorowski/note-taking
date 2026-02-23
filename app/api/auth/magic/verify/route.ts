import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { createToken, setAuthCookie } from '@/lib/auth'
import type { User } from '@/lib/types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const returnUrl = searchParams.get('returnUrl') || '/projects'

  if (!token) {
    return NextResponse.redirect(new URL('/auth/login?error=invalid', request.url))
  }

  // Find valid token
  const tokenResult = await query(
    `SELECT mlt.*, u.id as user_id FROM magic_link_tokens mlt
     JOIN users u ON u.email = mlt.email AND u.is_guest = false
     WHERE mlt.token = $1 AND mlt.used_at IS NULL AND mlt.expires_at > NOW()`,
    [token]
  )

  if (tokenResult.rows.length === 0) {
    return NextResponse.redirect(new URL('/auth/login?error=expired', request.url))
  }

  const row = tokenResult.rows[0]

  // Mark token as used
  await query('UPDATE magic_link_tokens SET used_at = NOW() WHERE id = $1', [row.id])

  // Fetch full user
  const userResult = await query<User>('SELECT * FROM users WHERE id = $1', [row.user_id])
  const user = userResult.rows[0]
  if (!user) {
    return NextResponse.redirect(new URL('/auth/login?error=invalid', request.url))
  }

  const jwt = createToken(user)
  await setAuthCookie(jwt)

  return NextResponse.redirect(new URL(returnUrl, request.url))
}
