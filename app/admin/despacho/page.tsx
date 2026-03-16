'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'

type Central = {
  id: string; name: string; address: string
  lat: number; lng: number; is_active: boolean
}

type Rider = {
  id: string; name: string; phone: string
  central_id: string | null
  origin_lat: number | null; origin_lng: number | null
  working: boolean
}

type StoreOrder = {
  id: string; order_code: string; destination: string
  total_amount: number; pending_amount: number
  lat: number; lng: number; store_id: string
  store_name: string; store_lat: number | null; store_lng: number | null
  selected: boolean
}

type StoreGroup = {
  id: string; name: string
  lat: number | null; lng: number | null
  orders: StoreOrder[]; expanded: boolean
}

type PlanRider = {
  rider_id: string; rider_name: string; color: string
  phase1_stores: { store_id: string; store_name: string; store_lat: number; store_lng: number; order_count: number }[]
  phase2_orders: StoreOrder[]
  detour_km: number
}

const COLORS = ['#2563eb','#dc2626','#16a34a','#d97706','#7c3aed','#db2777','#0891b2','#ea580c','#4f46e5','#65a30d']

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function kMeans(points: {lat:number;lng:number;id:string}[], k: number): number[] {
  if (!points.length || !k) return []
  k = Math.min(k, points.length)
  const centroids: {lat:number;lng:number}[] = [{ lat: points[0].lat, lng: points[0].lng }]
  for (let i = 1; i < k; i++) {
    let maxD = -1, far = points[0]
    points.forEach(p => {
      const minD = Math.min(...centroids.map(c => haversine(p.lat,p.lng,c.lat,c.lng)))
      if (minD > maxD) { maxD = minD; far = p }
    })
    centroids.push({lat: far.lat, lng: far.lng})
  }
  let assignments = new Array(points.length).fill(0)
  for (let iter = 0; iter < 20; iter++) {
    assignments = points.map(p => {
      let minD = Infinity, best = 0
      centroids.forEach((c,ci) => { const d = haversine(p.lat,p.lng,c.lat,c.lng); if(d<minD){minD=d;best=ci} })
      return best
    })
    for (let ci = 0; ci < k; ci++) {
      const cp = points.filter((_,i) => assignments[i]===ci)
      if (cp.length) centroids[ci] = { lat: cp.reduce((s,p)=>s+p.lat,0)/cp.length, lng: cp.reduce((s,p)=>s+p.lng,0)/cp.length }
    }
  }
  return assignments
}

export default function DespachoPage() {
  const [step, setStep] = useState(1)
  const [centrales, setCentrales] = useState<Central[]>([])
  const [selectedCentral, setSelectedCentral] = useState<Central | null>(null)
  const [riders, setRiders] = useState<Rider[]>([])
  const [storeGroups, setStoreGroups] = useState<StoreGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState<PlanRider[]>([])
  const [generating, setGenerating] = useState(false)
  const [routeLinks, setRouteLinks] = useState<{rider:string;link:string;color:string;detail:string}[]>([])
  const mapRef = useRef<any>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const layersRef = useRef<any[]>([])

  useEffect(() => { loadData() }, [])
  useEffect(() => { if (!loading) setTimeout(() => initMap(), 200) }, [loading])

  const loadData = async () => {
    try {
      const supabase = createClient()
      const [{ data: centralesData }, { data: ridersData }, { data: storesData }, { data: ordersData }] = await Promise.all([
        supabase.from('centrales').select('*').eq('is_active', true).order('name'),
        supabase.from('riders').select('*').eq('is_active', true).order('name'),
        supabase.from('stores').select('id, name, origin_lat, origin_lng').eq('status', 'active'),
        supabase.from('orders').select('id,order_code,destination,total_amount,pending_amount,lat,lng,store_id')
          .eq('status', 'pending').eq('delivery_method', 'motorizado')
          .not('lat', 'is', null).not('lng', 'is', null)
      ])
      setCentrales(centralesData || [])
      setRiders((ridersData || []).map((r:any) => ({ ...r, working: false })))
      const storeMap = new Map((storesData || []).map((s:any) => [s.id, s]))
      const groups: StoreGroup[] = []
      ;(ordersData || []).forEach((o:any) => {
        const store = storeMap.get(o.store_id)
        let group = groups.find(g => g.id === o.store_id)
        if (!group) {
          group = { id: o.store_id, name: store?.name || 'Tienda', lat: store?.origin_lat || null, lng: store?.origin_lng || null, orders: [], expanded: false }
          groups.push(group)
        }
        group.orders.push({ ...o, store_name: group.name, store_lat: group.lat, store_lng: group.lng, selected: false })
      })
      setStoreGroups(groups)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  const initMap = async () => {
    if (typeof window === 'undefined' || mapInstanceRef.current || !mapRef.current) return
    const L = await import('leaflet')
    await import('leaflet/dist/leaflet.css' as any)
    const map = L.map(mapRef.current).setView([-12.0464, -77.0428], 11)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map)
    mapInstanceRef.current = map
  }

  const workingRiders = riders.filter(r => r.working)
  const selectedOrders = storeGroups.flatMap(g => g.orders.filter(o => o.selected))

  const updateMapMarkers = async (planData: PlanRider[]) => {
    if (!mapInstanceRef.current) return
    const L = await import('leaflet')
    markersRef.current.forEach(m => m.remove())
    layersRef.current.forEach(l => l.remove())
    markersRef.current = []
    layersRef.current = []
    const map = mapInstanceRef.current

    planData.forEach((p, i) => {
      const color = p.color
      p.phase2_orders.forEach(o => {
        const icon = L.divIcon({ className: '', html: `<div style="background:${color};color:white;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:bold;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)">${i+1}</div>`, iconSize:[26,26], iconAnchor:[13,13] })
        const m = L.marker([o.lat, o.lng], { icon }).addTo(map).bindPopup(`<b>${o.order_code}</b><br>${o.destination}`)
        markersRef.current.push(m)
      })
      p.phase1_stores.forEach(s => {
        const icon = L.divIcon({ className: '', html: `<div style="background:#1f2937;color:white;border-radius:8px;padding:2px 6px;font-size:9px;font-weight:bold;white-space:nowrap;border:2px solid ${color}">📦 ${s.store_name}</div>`, iconSize:[100,24], iconAnchor:[50,12] })
        const m = L.marker([s.store_lat, s.store_lng], { icon }).addTo(map)
        markersRef.current.push(m)
      })
    })

    if (selectedCentral?.lat && selectedCentral?.lng) {
      const icon = L.divIcon({ className: '', html: `<div style="background:#1e40af;color:white;border-radius:8px;padding:4px 8px;font-size:10px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)">🏢 Central</div>`, iconSize:[100,28], iconAnchor:[50,14] })
      const m = L.marker([selectedCentral.lat, selectedCentral.lng], { icon }).addTo(map)
      markersRef.current.push(m)
    }

    const allPoints: [number,number][] = [
      ...planData.flatMap(p => p.phase2_orders.map(o => [o.lat, o.lng] as [number,number])),
      ...(selectedCentral?.lat && selectedCentral?.lng ? [[selectedCentral.lat, selectedCentral.lng] as [number,number]] : [])
    ]
    if (allPoints.length > 0) map.fitBounds(allPoints, { padding: [40,40] })
  }

  const toggleRiderWorking = (id: string) => setRiders(prev => prev.map(r => r.id===id ? {...r,working:!r.working} : r))
  const toggleOrder = (storeId: string, orderId: string) => setStoreGroups(prev => prev.map(g => g.id===storeId ? {...g, orders: g.orders.map(o => o.id===orderId ? {...o,selected:!o.selected} : o)} : g))
  const toggleAllStore = (storeId: string) => {
    setStoreGroups(prev => {
      const group = prev.find(g => g.id===storeId)
      const allSel = group?.orders.every(o => o.selected)
      return prev.map(g => g.id===storeId ? {...g, orders: g.orders.map(o => ({...o,selected:!allSel}))} : g)
    })
  }
  const toggleExpanded = (storeId: string) => setStoreGroups(prev => prev.map(g => g.id===storeId ? {...g,expanded:!g.expanded} : g))

  const generatePlan = () => {
    if (!selectedCentral || workingRiders.length===0 || selectedOrders.length===0) return
    const centralRiders = workingRiders.filter(r => !r.central_id || r.central_id===selectedCentral.id)
    if (!centralRiders.length) { alert('Los motorizados seleccionados no pertenecen a este central'); return }

    // PHASE 1: assign stores to riders by minimum detour
    const storesToPickup = storeGroups.filter(g => g.orders.some(o=>o.selected) && g.lat && g.lng)
    type Assignment = { riderId:string; store:StoreGroup; detour:number }
    const allAssignments: Assignment[] = []

    storesToPickup.forEach(store => {
      centralRiders.forEach(rider => {
        if (!rider.origin_lat || !rider.origin_lng) return
        const distDirect = haversine(rider.origin_lat, rider.origin_lng, selectedCentral.lat, selectedCentral.lng)
        const distVia = haversine(rider.origin_lat, rider.origin_lng, store.lat!, store.lng!) + haversine(store.lat!, store.lng!, selectedCentral.lat, selectedCentral.lng)
        allAssignments.push({ riderId: rider.id, store, detour: distVia - distDirect })
      })
    })
    allAssignments.sort((a,b) => a.detour - b.detour)

    const assignedStores = new Set<string>()
    const riderStoreMap = new Map<string, StoreGroup[]>()
    centralRiders.forEach(r => riderStoreMap.set(r.id, []))
    allAssignments.forEach(a => {
      if (!assignedStores.has(a.store.id)) {
        assignedStores.add(a.store.id)
        riderStoreMap.get(a.riderId)?.push(a.store)
      }
    })

    // PHASE 2: k-means clustering of delivery points
    const deliveryPoints = selectedOrders.map(o => ({ lat:o.lat, lng:o.lng, id:o.id }))
    const clusterAssignments = kMeans(deliveryPoints, centralRiders.length)

    // Match clusters to riders by proximity of cluster centroid to rider home
    const clusterCentroids = centralRiders.map((_, ci) => {
      const pts = deliveryPoints.filter((_,i) => clusterAssignments[i]===ci)
      if (!pts.length) return { lat: selectedCentral.lat, lng: selectedCentral.lng }
      return { lat: pts.reduce((s,p)=>s+p.lat,0)/pts.length, lng: pts.reduce((s,p)=>s+p.lng,0)/pts.length }
    })

    const usedClusters = new Set<number>()
    const riderClusterMap = new Map<string, number>()
    centralRiders.forEach(rider => {
      if (!rider.origin_lat || !rider.origin_lng) { riderClusterMap.set(rider.id, usedClusters.size); usedClusters.add(usedClusters.size); return }
      let minD = Infinity, best = 0
      clusterCentroids.forEach((c,ci) => {
        if (usedClusters.has(ci)) return
        const d = haversine(rider.origin_lat!, rider.origin_lng!, c.lat, c.lng)
        if (d<minD) { minD=d; best=ci }
      })
      usedClusters.add(best)
      riderClusterMap.set(rider.id, best)
    })

    const newPlan: PlanRider[] = centralRiders.map((rider, i) => {
      const stores = riderStoreMap.get(rider.id) || []
      const detour = stores.reduce((sum, s) => {
        if (!rider.origin_lat || !rider.origin_lng) return sum
        return sum + haversine(rider.origin_lat, rider.origin_lng, s.lat!, s.lng!) + haversine(s.lat!, s.lng!, selectedCentral.lat, selectedCentral.lng) - haversine(rider.origin_lat, rider.origin_lng, selectedCentral.lat, selectedCentral.lng)
      }, 0)
      const clusterIdx = riderClusterMap.get(rider.id) ?? i
      const riderOrders = selectedOrders.filter((_,j) => clusterAssignments[j]===clusterIdx)
      return {
        rider_id: rider.id,
        rider_name: rider.name,
        color: COLORS[i % COLORS.length],
        phase1_stores: stores.map(s => ({ store_id:s.id, store_name:s.name, store_lat:s.lat!, store_lng:s.lng!, order_count: s.orders.filter(o=>o.selected).length })),
        phase2_orders: riderOrders,
        detour_km: Math.round(detour*10)/10
      }
    })

    setPlan(newPlan)
    setStep(3)
    updateMapMarkers(newPlan)
  }

  const generateRoutes = async () => {
    if (!plan.length || !selectedCentral) return
    setGenerating(true)
    const supabase = createClient()
    const newLinks: typeof routeLinks = []
    try {
      for (const p of plan) {
        if (!p.phase2_orders.length) continue
        const token = Math.random().toString(36).substring(2,15) + Math.random().toString(36).substring(2,15)
        const allOrderIds = p.phase2_orders.map(o => o.id)
        const pickupStores = p.phase1_stores.map(s => ({
          store_id: s.store_id,
          store_name: s.store_name,
          lat: s.store_lat,
          lng: s.store_lng,
          order_count: s.order_count,
        }))

        const { data: route } = await supabase.from('global_routes').insert({
          date: new Date().toISOString().split('T')[0],
          store_ids_included: [...new Set(p.phase2_orders.map(o => o.store_id))],
          rider_id: p.rider_id,
          order_ids: allOrderIds,
          optimized_order: allOrderIds,
          route_token: token,
          is_active: true,
          total_km: 0,
          pickup_stores: pickupStores,
        }).select('route_token').single()
        if (route) {
          newLinks.push({
            rider: p.rider_name,
            link: window.location.origin + '/route/' + route.route_token,
            color: p.color,
            detail: `${p.phase1_stores.length} recojo(s) · ${p.phase2_orders.length} entregas`
          })
        }
      }
      setRouteLinks(newLinks)
      setStep(4)
    } catch(e) { alert('Error al generar rutas') }
    finally { setGenerating(false) }
  }

  const resetAll = () => {
    setStep(1); setPlan([]); setRouteLinks([]); setSelectedCentral(null)
    setRiders(prev => prev.map(r => ({...r,working:false})))
    setStoreGroups(prev => prev.map(g => ({...g, orders: g.orders.map(o => ({...o,selected:false}))})))
    markersRef.current.forEach(m => m.remove()); markersRef.current = []
    layersRef.current.forEach(l => l.remove()); layersRef.current = []
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Despacho Global</h1>
        <p className="text-gray-500 text-sm mt-0.5">Planifica recojos y entregas con asignación automática</p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1">
        {[{n:1,label:'Configurar'},{n:2,label:'Pedidos'},{n:3,label:'Plan'},{n:4,label:'Rutas'}].map((s,i,arr) => (
          <div key={s.n} className="flex items-center gap-1 flex-shrink-0">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step>=s.n?'bg-blue-600 text-white':'bg-gray-200 text-gray-500'}`}>{s.n}</div>
            <span className={`text-xs font-medium ${step===s.n?'text-blue-600':'text-gray-400'}`}>{s.label}</span>
            {i<arr.length-1 && <span className="text-gray-300 text-xs mx-1">›</span>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left panel */}
        <div className="space-y-4 lg:max-h-[680px] lg:overflow-y-auto lg:pr-1">

          {/* STEP 1 */}
          {step === 1 && (
            <>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h2 className="font-semibold text-gray-900 mb-3 text-sm">1. Selecciona el central</h2>
                {centrales.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-400 mb-2">No hay centrales configurados</p>
                    <a href="/admin/centrales" className="text-xs text-blue-600 underline font-medium">Crear central →</a>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {centrales.map(c => (
                      <button key={c.id} onClick={() => setSelectedCentral(c)}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all ${selectedCentral?.id===c.id?'border-blue-500 bg-blue-50':'border-gray-200 hover:border-gray-300'}`}>
                        <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                        {c.address && <p className="text-xs text-gray-500">{c.address}</p>}
                        {c.lat && c.lng
                          ? <p className="text-xs text-green-600 mt-0.5">📍 Coordenadas OK</p>
                          : <p className="text-xs text-red-400 mt-0.5">⚠️ Sin coordenadas</p>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedCentral && (
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <h2 className="font-semibold text-gray-900 mb-1 text-sm">2. Motorizados de hoy</h2>
                  <p className="text-xs text-gray-400 mb-3">Marca los que trabajan hoy</p>
                  {riders.filter(r => !r.central_id || r.central_id===selectedCentral.id).length === 0 ? (
                    <p className="text-sm text-gray-400">No hay motorizados asignados a este central</p>
                  ) : (
                    <div className="space-y-2">
                      {riders.filter(r => !r.central_id || r.central_id===selectedCentral.id).map(rider => (
                        <button key={rider.id} onClick={() => toggleRiderWorking(rider.id)}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 transition-all touch-manipulation ${rider.working?'border-blue-400 bg-blue-50':'border-gray-200 hover:border-gray-300'}`}>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${rider.working?'bg-blue-600 border-blue-600':'border-gray-300'}`}>
                            {rider.working && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <div className="text-left flex-1">
                            <p className="text-sm font-medium text-gray-900">{rider.name}</p>
                            {!rider.origin_lat && <p className="text-xs text-orange-400">⚠️ Sin coordenadas de casa</p>}
                          </div>
                          {rider.working && <span className="text-xs text-blue-600 font-medium">✓ Activo</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {workingRiders.length > 0 && (
                    <button onClick={() => setStep(2)}
                      className="w-full mt-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold touch-manipulation">
                      Continuar → {workingRiders.length} motorizado{workingRiders.length!==1?'s':''}
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900 text-sm">Selecciona pedidos</h2>
                <button onClick={() => setStep(1)} className="text-xs text-blue-600">← Atrás</button>
              </div>
              <p className="text-xs text-gray-400 mb-3">Elige qué pedidos entran al plan de hoy</p>

              {storeGroups.length === 0 ? (
                <p className="text-sm text-gray-400">No hay pedidos pendientes con GPS</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {storeGroups.map(group => {
                    const selCount = group.orders.filter(o=>o.selected).length
                    const allSel = group.orders.every(o=>o.selected)
                    return (
                      <div key={group.id} className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 cursor-pointer" onClick={() => toggleExpanded(group.id)}>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">{group.name}</span>
                            <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{group.orders.length}</span>
                            {selCount>0 && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{selCount} ✓</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={e=>{e.stopPropagation();toggleAllStore(group.id)}}
                              className="text-xs text-blue-600 font-medium touch-manipulation">
                              {allSel?'Desel.':'Todo'}
                            </button>
                            <span className="text-gray-400 text-xs">{group.expanded?'▲':'▼'}</span>
                          </div>
                        </div>
                        {group.expanded && (
                          <div className="divide-y divide-gray-50">
                            {group.orders.map(order => (
                              <div key={order.id} onClick={() => toggleOrder(group.id, order.id)}
                                className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors touch-manipulation ${order.selected?'bg-blue-50':'hover:bg-gray-50'}`}>
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${order.selected?'bg-blue-600 border-blue-600':'border-gray-300'}`}>
                                  {order.selected && <span className="text-white text-xs">✓</span>}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-mono font-bold text-gray-900">{order.order_code}</p>
                                  <p className="text-xs text-gray-500 truncate">{order.destination}</p>
                                </div>
                                <span className="text-xs font-semibold text-orange-600 flex-shrink-0">S/{Number(order.pending_amount).toFixed(0)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {selectedOrders.length > 0 && (
                <div className="mt-3">
                  <div className="bg-blue-50 rounded-lg px-3 py-2 mb-3 text-center">
                    <p className="text-xs text-blue-700 font-semibold">{selectedOrders.length} pedido{selectedOrders.length!==1?'s':''} · {workingRiders.length} motorizado{workingRiders.length!==1?'s':''}</p>
                  </div>
                  <button onClick={generatePlan}
                    className="w-full py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold touch-manipulation">
                    🤖 Generar plan automático
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3 - Plan */}
          {step === 3 && plan.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900 text-sm">Plan sugerido</h2>
                <button onClick={() => setStep(2)} className="text-xs text-blue-600">← Ajustar</button>
              </div>
              <p className="text-xs text-gray-400 mb-3">El sistema asignó recojos y entregas por zona geográfica</p>

              <div className="space-y-3 max-h-80 overflow-y-auto">
                {plan.map(p => (
                  <div key={p.rider_id} className="rounded-xl overflow-hidden border" style={{ borderColor: p.color + '50' }}>
                    <div className="px-3 py-2 text-sm font-bold text-white" style={{ background: p.color }}>
                      🏍️ {p.rider_name}
                    </div>
                    <div className="p-3 space-y-2">
                      {/* Phase 1 */}
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-1">Fase 1 — Recojo (casa → tiendas → central)</p>
                        {p.phase1_stores.length > 0 ? (
                          <>
                            {p.phase1_stores.map(s => (
                              <p key={s.store_id} className="text-xs text-gray-600 ml-2">📦 {s.store_name} ({s.order_count} pedido{s.order_count!==1?'s':''})</p>
                            ))}
                            <p className="text-xs text-orange-500 ml-2">+{p.detour_km} km de desvío estimado</p>
                          </>
                        ) : (
                          <p className="text-xs text-gray-400 ml-2">Va directo al central (sin recojos asignados)</p>
                        )}
                      </div>
                      {/* Phase 2 */}
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-1">Fase 2 — Reparto ({p.phase2_orders.length} entregas)</p>
                        {p.phase2_orders.slice(0,3).map(o => (
                          <p key={o.id} className="text-xs text-gray-600 ml-2 truncate">🚚 {o.order_code} · {o.destination}</p>
                        ))}
                        {p.phase2_orders.length > 3 && <p className="text-xs text-gray-400 ml-2">+{p.phase2_orders.length-3} entregas más...</p>}
                        {p.phase2_orders.length === 0 && <p className="text-xs text-gray-400 ml-2">Sin entregas asignadas</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={generateRoutes} disabled={generating}
                className="w-full mt-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 touch-manipulation">
                {generating ? '⏳ Generando...' : '✅ Activar todas las rutas'}
              </button>
            </div>
          )}

          {/* STEP 4 - Links */}
          {step === 4 && routeLinks.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
              <h2 className="font-semibold text-gray-900 text-sm">🎉 Rutas activadas</h2>
              {routeLinks.map((rl, i) => (
                <div key={i} className="rounded-xl p-3 border-2" style={{ borderColor: rl.color + '50', background: rl.color + '08' }}>
                  <p className="text-sm font-bold mb-0.5" style={{ color: rl.color }}>🏍️ {rl.rider}</p>
                  <p className="text-xs text-gray-500 mb-1">{rl.detail}</p>
                  <p className="text-xs text-gray-400 break-all mb-2">{rl.link}</p>
                  <div className="flex gap-2">
                    <button onClick={() => { navigator.clipboard.writeText(rl.link); alert('¡Copiado!') }}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white touch-manipulation">📋 Copiar</button>
                    <button onClick={() => window.open('https://wa.me/?text='+encodeURIComponent('Tu ruta de hoy: '+rl.link),'_blank')}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white touch-manipulation">💬 WA</button>
                  </div>
                </div>
              ))}
              <button onClick={resetAll}
                className="w-full py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium touch-manipulation">
                🔄 Nuevo despacho
              </button>
            </div>
          )}
        </div>

        {/* Map */}
        <div className="lg:col-span-2">
          <div ref={mapRef} className="w-full rounded-xl overflow-hidden border border-gray-200" style={{ height: '650px' }} />
          <p className="text-xs text-gray-400 mt-2 text-center">
            {step===3 ? '🎨 Colores = motorizado asignado · 📦 cuadros = tiendas de recojo · 🏢 = central' : 'El mapa mostrará el plan una vez generado'}
          </p>
        </div>
      </div>
    </div>
  )
}