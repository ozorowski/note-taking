import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import type { AuthToken, User } from './types'
import { query } from './db'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key'

export function createToken(user: User): string {
  const token = jwt.sign(
    { user_id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '30d' }
  )
  return token
}

export function verifyToken(token: string): AuthToken | null {
  try {
    const verified = jwt.verify(token, JWT_SECRET) as AuthToken
    return verified
  } catch {
    return null
  }
}

export async function verifyAuth(): Promise<User | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value

  if (!token) {
    return null
  }

  const payload = await verifyToken(token)
  if (!payload) {
    return null
  }

  const result = await query<User>(
    'SELECT * FROM users WHERE id = $1',
    [payload.user_id]
  )

  return result.rows[0] || null
}

export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: '/',
  })
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('auth_token')
}
