import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@trace.app'

export async function POST(request: NextRequest) {
  const { email } = await request.json()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }

  if (!resend) {
    return NextResponse.json({ error: 'Email is not configured on this server' }, { status: 503 })
  }

  const normalised = email.toLowerCase().trim()

  // Upsert user — real account (not guest)
  const defaultName = normalised.split('@')[0]
  const userResult = await query(
    `INSERT INTO users (name, email, is_guest)
     VALUES ($1, $2, false)
     ON CONFLICT (email) WHERE is_guest = false
     DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [defaultName, normalised]
  )
  const userId = userResult.rows[0]?.id
  if (!userId) {
    return NextResponse.json({ error: 'Could not create or find account' }, { status: 500 })
  }

  // Create magic link token (15 min expiry)
  const tokenResult = await query(
    `INSERT INTO magic_link_tokens (email, expires_at)
     VALUES ($1, NOW() + interval '15 minutes')
     RETURNING token`,
    [normalised]
  )
  const token = tokenResult.rows[0].token

  const link = `${BASE_URL}/api/auth/magic/verify?token=${token}`

  await resend.emails.send({
    from: FROM_EMAIL,
    to: normalised,
    subject: 'Sign in to Trace',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="font-size:20px;font-weight:700;margin:0 0 8px">Sign in to Trace</h2>
        <p style="color:#555;margin:0 0 24px">Click the button below to sign in. This link expires in 15 minutes.</p>
        <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Sign in to Trace</a>
        <p style="color:#999;font-size:12px;margin:24px 0 0">If you didn't request this, you can ignore it.</p>
      </div>
    `,
  })

  return NextResponse.json({ sent: true })
}
