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
      end: [origin.lng, origin.lat],
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
    const totalDistance = data.routes?.[0]?.distance || 0

    return NextResponse.json({ orderedIds, totalKm: parseFloat((totalDistance / 1000).toFixed(1)) })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}