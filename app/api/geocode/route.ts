import { NextRequest, NextResponse } from 'next/server'

// Rate limit best-effort en memoria (por IP). No es infalible en entornos
// serverless multi-instancia, pero frena el abuso directo del endpoint.
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60_000
const hits = new Map<string, number[]>()

function isRateLimited(ip: string) {
  const now = Date.now()
  const timestamps = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS)
  timestamps.push(now)
  hits.set(ip, timestamps)
  return timestamps.length > RATE_LIMIT
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q) return NextResponse.json([])

  // Verificar que la request viene de nuestro propio dominio
  const origin = req.headers.get('origin') || req.headers.get('referer') || ''
  const allowed = process.env.NEXT_PUBLIC_SITE_URL || 'pedidospe.com'
  if (!origin.includes(allowed) && !origin.includes('localhost')) {
    return NextResponse.json([], { status: 403 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json([], { status: 429 })
  }

  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=5&q=' + encodeURIComponent(q) + ', Lima, Peru'
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MiPlataforma/1.0', 'Accept-Language': 'es' }
    })
    if (!res.ok) return NextResponse.json([])
    const text = await res.text()
    if (!text || text.trim() === '') return NextResponse.json([])
    const data = JSON.parse(text)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json([])
  }
}