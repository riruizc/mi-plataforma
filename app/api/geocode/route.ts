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
  // Geocodificación inversa: con lat/lon se devuelve la dirección de ese punto.
  // Es lo que permite que marcar en el mapa rellene solo el campo «Dirección».
  const latParam = req.nextUrl.searchParams.get('lat')
  const lonParam = req.nextUrl.searchParams.get('lon')
  const esInversa = latParam !== null && lonParam !== null

  if (!esInversa && !q) return NextResponse.json([])

  // Verificar que la request viene de nuestro propio dominio.
  // Se compara el HOST exacto, no con .includes(): antes 'pedidospe.com'
  // matcheaba también 'pedidospe.com.attacker.io'.
  // (Sigue siendo falsificable con curl — es un filtro contra el abuso casual,
  //  no un control de seguridad. El límite real debe ser el rate limit.)
  const rawOrigin = req.headers.get('origin') || req.headers.get('referer') || ''
  let host = ''
  try { host = new URL(rawOrigin).host.toLowerCase() } catch { host = '' }

  const siteHost = (() => {
    const v = process.env.NEXT_PUBLIC_SITE_URL || 'pedidospe.com'
    try { return new URL(v.startsWith('http') ? v : `https://${v}`).host.toLowerCase() } catch { return v.toLowerCase() }
  })()

  const allowedHosts = new Set([siteHost, `www.${siteHost}`, 'localhost:3000', 'localhost'])
  if (!allowedHosts.has(host)) {
    return NextResponse.json([], { status: 403 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json([], { status: 429 })
  }

  // ── Geocodificación inversa: punto → dirección ──────────────────────────
  if (esInversa) {
    const lat = Number(latParam)
    const lon = Number(lonParam)
    if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
        Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return NextResponse.json({ error: 'Coordenadas inválidas' }, { status: 400 })
    }
    try {
      // zoom=18 devuelve el nivel de calle/edificio, que es lo útil para que
      // el motorizado sepa a qué puerta llegar.
      const url = 'https://nominatim.openstreetmap.org/reverse?format=json&zoom=18'
        + '&lat=' + encodeURIComponent(String(lat))
        + '&lon=' + encodeURIComponent(String(lon))
      const res = await fetch(url, {
        headers: { 'User-Agent': 'MiPlataforma/1.0', 'Accept-Language': 'es' }
      })
      if (!res.ok) return NextResponse.json({})
      const text = await res.text()
      if (!text || text.trim() === '') return NextResponse.json({})
      const data = JSON.parse(text)
      return NextResponse.json({ display_name: data?.display_name || '' })
    } catch {
      // Un fallo aquí no debe romper nada: el formulario tiene su respaldo.
      return NextResponse.json({})
    }
  }

  // ── Búsqueda normal: texto → sugerencias ────────────────────────────────
  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=5&q=' + encodeURIComponent(q!) + ', Lima, Peru'
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