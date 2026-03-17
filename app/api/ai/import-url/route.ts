import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser, unauthorized, badRequest } from '@/lib/api-helpers'

import { getSetting } from '@/lib/settings'
interface ImportedItem {
  content: string
  author: string | null
  evidence_type: 'quote' | 'observation' | 'pain_point' | 'need' | null
}

// Reused callAI pattern (single prompt, JSON response) from cluster-notes/route.ts
async function callAI(prompt: string): Promise<{ text: string; error?: string }> {
  const [geminiKey, groqKey, openaiKey] = await Promise.all([getSetting('GEMINI_API_KEY'), getSetting('GROQ_API_KEY'), getSetting('OPENAI_API_KEY')])

  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 2000 },
          }),
        }
      )
      const data = await res.json()
      if (res.ok) {
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (text) return { text }
      }
    } catch { /* fall through */ }
  }

  if (groqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'You are a UX researcher assistant. Respond with valid JSON only.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 2000,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        const text = data.choices?.[0]?.message?.content || ''
        if (text) return { text }
      }
    } catch { /* fall through */ }
  }

  if (openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2000,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        const text = data.choices?.[0]?.message?.content || ''
        if (text) return { text }
      }
    } catch { /* fall through */ }
  }

  return { text: '', error: 'No AI key configured' }
}

function parseEvidenceTypes(raw: string, count: number): Array<'quote' | 'observation' | 'pain_point' | 'need' | null> {
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) {
      return parsed.map((v: unknown) => {
        if (v === 'quote' || v === 'observation' || v === 'pain_point' || v === 'need') return v
        return null
      })
    }
  } catch { /* fall through */ }
  return Array(count).fill(null)
}

async function fetchReddit(url: string): Promise<{ items: ImportedItem[]; source_title: string }> {
  const jsonUrl = url.replace(/\/?(\?.*)?$/, '.json$1')
  const res = await fetch(jsonUrl, {
    headers: { 'User-Agent': 'Trace/1.0 research-synthesis-tool' },
  })
  if (!res.ok) throw new Error('Reddit fetch failed')

  const data = await res.json()

  // Post title from first listing
  const source_title = data[0]?.data?.children?.[0]?.data?.title || 'Reddit thread'

  // Comments from second listing
  const children = data[1]?.data?.children ?? []
  const items: ImportedItem[] = []
  for (const child of children) {
    const d = child.data
    if (!d?.body) continue
    const body = d.body.trim()
    if (!body || body === '[deleted]' || body === '[removed]') continue
    if (d.author === 'AutoModerator') continue
    if (body.length < 10) continue
    items.push({ content: body, author: d.author ?? null, evidence_type: null })
    if (items.length >= 500) break
  }
  return { items, source_title }
}

async function fetchWeb(url: string): Promise<{ items: ImportedItem[]; source_title: string }> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { 'User-Agent': 'Trace/1.0', 'Accept': 'text/plain' },
  })
  if (!res.ok) throw new Error('Web fetch failed')

  const text = await res.text()

  // Extract title from first line if it looks like a heading
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const source_title = lines[0]?.replace(/^#+\s*/, '') || 'Imported page'

  // Split into paragraphs, filter meaningful ones
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 30 && !p.startsWith('!') && !p.startsWith('['))
  const items: ImportedItem[] = paragraphs.slice(0, 500).map(p => ({
    content: p.replace(/\n/g, ' '),
    author: null,
    evidence_type: null,
  }))

  return { items, source_title }
}

async function classifyItems(items: ImportedItem[]): Promise<ImportedItem[]> {
  const toClassify = items.slice(0, 100)
  const rest = items.slice(100)

  const prompt = `Classify each of the following ${toClassify.length} items as one of: quote, observation, pain_point, need.

Definitions:
- quote: a direct quote or verbatim statement from a person
- observation: a factual observation or behaviour noted
- pain_point: a frustration, problem, or complaint
- need: anything that doesn't clearly fit the above three categories

Return a JSON array of exactly ${toClassify.length} strings, one per item, in the same order.
Example: ["quote","pain_point","observation","need"]

Items:
${toClassify.map((item, i) => `${i + 1}. ${item.content.slice(0, 200)}`).join('\n')}`

  const { text } = await callAI(prompt)
  const types = parseEvidenceTypes(text, toClassify.length)

  const classified = toClassify.map((item, i) => ({ ...item, evidence_type: types[i] ?? null }))
  return [...classified, ...rest]
}

export async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return unauthorized()

  const { url } = await request.json()
  if (!url?.trim()) return badRequest('URL is required')

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url.trim())
  } catch {
    return badRequest('Invalid URL')
  }

  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    return badRequest('Only HTTP/HTTPS URLs are supported')
  }

  try {
    const isReddit = parsedUrl.hostname.includes('reddit.com')
    const { items: rawItems, source_title } = isReddit
      ? await fetchReddit(url.trim())
      : await fetchWeb(url.trim())

    if (rawItems.length === 0) {
      return NextResponse.json({ error: "We couldn't extract structured content from this URL." }, { status: 422 })
    }

    const items = await classifyItems(rawItems)

    return NextResponse.json({
      items,
      source_title,
      item_count: items.length,
      source_kind: isReddit ? 'reddit' : 'web',
    })
  } catch {
    return NextResponse.json(
      { error: "This page is not publicly accessible." },
      { status: 400 }
    )
  }
}
