import { query } from './db'

/**
 * Returns the value for `key`: DB-stored setting takes priority over env var.
 * Falls back gracefully if the settings table doesn't exist yet.
 */
export async function getSetting(key: string): Promise<string | undefined> {
  try {
    const res = await query<{ value: string }>(
      'SELECT value FROM settings WHERE key = $1',
      [key]
    )
    if (res.rows[0]?.value) return res.rows[0].value
  } catch {
    // Table may not exist yet (before migration) — fall through to env
  }
  return process.env[key] || undefined
}
