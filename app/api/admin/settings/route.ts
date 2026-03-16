import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { query } from '@/lib/db'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

const MANAGED_KEYS = [
  { key: 'GROQ_API_KEY',    label: 'Groq API Key',    hint: 'Primary AI provider (llama-3.3-70b)' },
  { key: 'GEMINI_API_KEY',  label: 'Gemini API Key',  hint: 'Fallback AI provider (gemini-2.0-flash)' },
  { key: 'OPENAI_API_KEY',  label: 'OpenAI API Key',  hint: 'Tertiary AI provider (gpt-4o-mini)' },
  { key: 'RESEND_API_KEY',  label: 'Resend API Key',  hint: 'Email (magic links). Requires restart.' },
]
const ALLOWED_KEYS = new Set(MANAGED_KEYS.map(m => m.key))

async function isAdmin(): Promise<boolean> {
  const user = await verifyAuth()
  return !!(user && ADMIN_EMAIL && user.email === ADMIN_EMAIL)
}

function maskValue(value?: string): string | null {
  if (!value) return null
  if (value.length <= 8) return '••••••••'
  return value.slice(0, 6) + '••••••••' + value.slice(-4)
}

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const dbRes = await query<{ key: string; value: string; updated_at: string }>(
    'SELECT key, value, updated_at::text FROM settings WHERE key = ANY($1)',
    [MANAGED_KEYS.map(m => m.key)]
  )
  const dbMap = Object.fromEntries(dbRes.rows.map(r => [r.key, r]))

  const settings = MANAGED_KEYS.map(({ key, label, hint }) => ({
    key,
    label,
    hint,
    source: dbMap[key] ? 'db' : process.env[key] ? 'env' : 'unset',
    masked: maskValue(dbMap[key]?.value ?? process.env[key]),
    updated_at: dbMap[key]?.updated_at ?? null,
  }))

  return NextResponse.json({ settings })
}

export async function PATCH(request: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { key, value } = await request.json()
  if (!ALLOWED_KEYS.has(key)) return NextResponse.json({ error: 'Unknown key' }, { status: 400 })

  if (!value?.trim()) {
    // Clear the DB override — will fall back to env var
    await query('DELETE FROM settings WHERE key = $1', [key])
  } else {
    await query(
      `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value.trim()]
    )
  }

  return NextResponse.json({ ok: true })
}
