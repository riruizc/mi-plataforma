import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q) return NextResponse.json([])

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