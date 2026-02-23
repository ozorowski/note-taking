import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { createToken, setAuthCookie } from '@/lib/auth'
import { createDemoProject } from '@/lib/demo-seed'
import type { User } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Create a new user with just a name — no email or password needed
    const result = await query<User>(
      `INSERT INTO users (name) VALUES ($1) RETURNING *`,
      [name.trim()]
    )

    const user = result.rows[0]
    const token = createToken(user)
    await setAuthCookie(token)

    // Auto-seed a fresh demo project for every session
    try {
      await createDemoProject(user.id)
    } catch (seedErr) {
      console.error('Demo seeding failed (non-fatal):', seedErr)
    }

    return NextResponse.json(
      { user: { id: user.id, name: user.name } },
      { status: 201 }
    )
  } catch (error) {
    console.error('Guest login error:', error)
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 })
  }
}
