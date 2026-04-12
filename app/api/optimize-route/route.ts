import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { jobs, origin } = await req.json()
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
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}