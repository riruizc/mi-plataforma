import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Validación de entrada. Antes se accedía directo a origin.lng y a
    // jobs.map(): un body sin `origin` o con `jobs` no-array tumbaba la
    // función, y no había ningún tope de paradas, así que cualquier usuario
    // autenticado podía quemar la cuota de OpenRouteService con un solo POST.
    const body = await req.json().catch(() => null)
    const jobs = Array.isArray(body?.jobs) ? body.jobs : null
    const origin = body?.origin

    const isCoord = (v: any) =>
      v != null &&
      Number.isFinite(Number(v.lat)) && Number.isFinite(Number(v.lng)) &&
      Math.abs(Number(v.lat)) <= 90 && Math.abs(Number(v.lng)) <= 180

    const MAX_PARADAS = 60
    if (!jobs || jobs.length === 0 || jobs.length > MAX_PARADAS) {
      return NextResponse.json({ error: `Selecciona entre 1 y ${MAX_PARADAS} paradas` }, { status: 400 })
    }
    if (!isCoord(origin)) {
      return NextResponse.json({ error: 'Falta el punto de salida o sus coordenadas son inválidas' }, { status: 400 })
    }
    if (!jobs.every(isCoord)) {
      return NextResponse.json({ error: 'Uno de los pedidos tiene coordenadas inválidas' }, { status: 400 })
    }

    const apiKey = process.env.ORS_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Sin API key' }, { status: 500 })

    // Construir jobs para ORS Optimization
    const vehicles = [{
      id: 1,
      profile: 'driving-car',
      start: [origin.lng, origin.lat],
    }]

    const orsJobs = jobs.map((j: any, i: number) => ({
      id: i + 1,
      location: [j.lng, j.lat],
      description: j.id,
    }))

    const res = await fetch('https://api.openrouteservice.org/optimization', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ vehicles, jobs: orsJobs }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('ORS error:', err)
      return NextResponse.json({ error: 'ORS falló' }, { status: 502 })
    }

    const data = await res.json()
    // Extraer orden optimizado
    const steps = data.routes?.[0]?.steps?.filter((s: any) => s.type === 'job') || []
    const orderedIds = steps.map((s: any) => jobs[s.id - 1]?.id)

    // Get ordered jobs to call Directions for geometry + real distance
    const orderedJobs = steps
      .map((s: any) => jobs[s.id - 1])
      .filter(Boolean)

    const coordinates = [
      [origin.lng, origin.lat],
      ...orderedJobs.map((j: any) => [j.lng, j.lat]),
    ]

    let totalKm = 0
    let geometry: number[][] = []

    if (coordinates.length >= 2) {
      const dirRes = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
        method: 'POST',
        headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates }),
      })
      if (dirRes.ok) {
        const dirData = await dirRes.json()
        const route = dirData.features?.[0]
        totalKm = parseFloat(((route?.properties?.summary?.distance || 0) / 1000).toFixed(1))
        geometry = route?.geometry?.coordinates || []
      }
    }

    return NextResponse.json({ orderedIds, totalKm, geometry })
  } catch (e: any) {
    // Nunca devolver e.message al cliente: filtra detalles internos
    // (rutas de archivos, nombres de tablas, mensajes de Postgres).
    console.error('[optimize-route]', e)
    return NextResponse.json({ error: 'No se pudo optimizar la ruta' }, { status: 500 })
  }
}