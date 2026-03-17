import { NextResponse } from 'next/server'
import { getSetting } from '@/lib/settings'
import { getAuthedUser, unauthorized } from '@/lib/api-helpers'

export async function GET() {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const [geminiKey, groqKey, openaiKey] = await Promise.all([
    getSetting('GEMINI_API_KEY'),
    getSetting('GROQ_API_KEY'),
    getSetting('OPENAI_API_KEY'),
  ])

  const provider = geminiKey ? 'Gemini' : groqKey ? 'Groq' : openaiKey ? 'OpenAI' : null
  return NextResponse.json({ provider })
}
