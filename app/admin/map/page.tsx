'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'

type StoreOrder = {
  id: string
  order_code: string
  destination: string
  total_amount: number
  pending_amount: number
  lat: number
  lng: number
  status: string
  store_id: string
  store_name: string
  store_color: string
  assigned_cluster?: number
}

type StoreInfo = {
  id: string
  name: string
  color: string
  visible: boolean
  orderCount: number
  origin_lat?: number | null
  origin_lng?: number | null
}

type Rider = {
    id: string
    name: string
    phone: string
    selected: boolean
    origin_lat?: number | null
    origin_lng?: number | null
  }

const STORE_COLORS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#d97706',
  '#7c3aed',
  '#db2777',
  '#0891b2',
  '#65a30d',
  '#ea580c',
  '#4f46e5',
]

const CLUSTER_COLORS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#d97706',
  '#7c3aed',
  '#db2777',
  '#0891b2',
  '#ea580c',
  '#4f46e5',
  '#65a30d',
]

// K-means simple
function kMeans(
  points: { lat: number; lng: number; id: string }[],
  k: number,
  iterations = 20
) {
  if (points.length === 0 || k === 0) return []
  k = Math.min(k, points.length)

  const centroids: { lat: number; lng: number }[] = [{ ...points[0] }]

  for (let i = 1; i < k; i++) {
    let maxDist = -1
    let farthest = points[0]

    points.forEach((p) => {
      const minD = Math.min(
        ...centroids.map((c) =>
          Math.sqrt(Math.pow(p.lat - c.lat, 2) + Math.pow(p.lng - c.lng, 2))
        )
      )
      if (minD > maxDist) {
        maxDist = minD
        farthest = p
      }
    })

    centroids.push({ lat: farthest.lat, lng: farthest.lng })
  }

  let assignments: number[] = new Array(points.length).fill(0)

  for (let iter = 0; iter < iterations; iter++) {
    assignments = points.map((p) => {
      let minDist = Infinity
      let closest = 0

      centroids.forEach((c, ci) => {
        const d = Math.sqrt(Math.pow(p.lat - c.lat, 2) + Math.pow(p.lng - c.lng, 2))
        if (d < minDist) {
          minDist = d
          closest = ci
        }
      })

      return closest
    })

    for (let ci = 0; ci < k; ci++) {
      const clusterPoints = points.filter((_, i) => assignments[i] === ci)
      if (clusterPoints.length > 0) {
        centroids[ci] = {
          lat: clusterPoints.reduce((s, p) => s + p.lat, 0) / clusterPoints.length,
          lng: clusterPoints.reduce((s, p) => s + p.lng, 0) / clusterPoints.length,
        }
      }
    }
  }

  return assignments
}

export default function AdminMapPage() {
  const [orders, setOrders] = useState<StoreOrder[]>([])
  const [stores, setStores] = useState<StoreInfo[]>([])
  const [riders, setRiders] = useState<Rider[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [routeLinks, setRouteLinks] = useState<
    { rider: string; link: string; color: string; km?: number }[]
  >([])
  const [clusters, setClusters] = useState<number[]>([])
  const [autoMode, setAutoMode] = useState(false)
  const [manualRider, setManualRider] = useState('')

  const mapRef = useRef<any>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!loading) initMap()
  }, [loading])

  useEffect(() => {
    updateMarkers()
  }, [stores, selectedOrders, clusters])

  const loadData = async () => {
    try {
      const supabase = createClient()

      const { data: storesData } = await supabase
        .from('stores')
        .select('id, name, theme_color, origin_lat, origin_lng')
        .eq('status', 'active')
        .order('name')

      const storeList = (storesData || []).map((s: any, i: number) => ({
        id: s.id,
        name: s.name,
        color: s.theme_color || STORE_COLORS[i % STORE_COLORS.length],
        visible: true,
        orderCount: 0,
        origin_lat: s.origin_lat || null,
        origin_lng: s.origin_lng || null,
      }))

      const { data: ordersData } = await supabase
        .from('orders')
        .select(
          'id, order_code, destination, total_amount, pending_amount, lat, lng, status, store_id, stores(name)'
        )
        .in('status', ['pending', 'in_route'])
        .eq('delivery_method', 'motorizado')
        .not('lat', 'is', null)
        .not('lng', 'is', null)

      const orderList: StoreOrder[] = (ordersData || []).map((o: any) => {
        const store = storeList.find((s) => s.id === o.store_id)
        return {
          ...o,
          store_name: o.stores?.name || 'Tienda',
          store_color: store?.color || '#2563eb',
        }
      })

      const updatedStores = storeList
        .map((s) => ({
          ...s,
          orderCount: orderList.filter((o) => o.store_id === s.id).length,
        }))
        .filter((s) => s.orderCount > 0)

        const { data: ridersData } = await supabase
        .from('riders')
        .select('id, name, phone, origin_lat, origin_lng')
        .eq('is_active', true)
        .order('name')

      setStores(updatedStores)
      setOrders(orderList)
      setRiders((ridersData || []).map((r: any) => ({ ...r, selected: false })))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const initMap = async () => {
    if (typeof window === 'undefined' || mapInstanceRef.current || !mapRef.current) return

    const L = await import('leaflet')
    await import('leaflet/dist/leaflet.css' as any)

    const map = L.map(mapRef.current).setView([-12.0464, -77.0428], 12)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map)

    mapInstanceRef.current = map
    setTimeout(() => addMarkers(), 100)
  }

  const addMarkers = async () => {
    if (!mapInstanceRef.current) return

    const L = await import('leaflet')
    const map = mapInstanceRef.current

    orders.forEach((order) => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:${order.store_color};color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);cursor:pointer">S/</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      })

      const marker = L.marker([order.lat, order.lng], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="min-width:160px">
            <p style="font-weight:bold;margin:0 0 4px">${order.order_code}</p>
            <p style="margin:0 0 2px;font-size:12px;color:#555">${order.store_name}</p>
            <p style="margin:0 0 2px;font-size:12px">${order.destination}</p>
            <p style="margin:0;font-weight:bold;color:#16a34a">S/ ${Number(order.total_amount).toFixed(2)}</p>
          </div>
        `)

      marker.on('click', () => {
        setSelectedOrders((prev) =>
          prev.includes(order.id) ? prev.filter((id) => id !== order.id) : [...prev, order.id]
        )
      })

      markersRef.current.set(order.id, marker)
    })

    if (orders.length > 0) {
      map.fitBounds(
        orders.map((o) => [o.lat, o.lng] as [number, number]),
        { padding: [40, 40] }
      )
    }
  }

  const updateMarkers = async () => {
    if (!mapInstanceRef.current) return

    markersRef.current.forEach((marker, orderId) => {
      const order = orders.find((o) => o.id === orderId)
      if (!order) return

      const store = stores.find((s) => s.id === order.store_id)
      const visible = store?.visible ?? true
      const isSelected = selectedOrders.includes(orderId)

      const orderIdx = orders.findIndex((o) => o.id === orderId)
      const clusterIdx = clusters[orderIdx]
      const clusterColor =
        clusters.length > 0 && clusterIdx !== undefined && clusterIdx >= 0
          ? CLUSTER_COLORS[clusterIdx % CLUSTER_COLORS.length]
          : order.store_color

      const el = marker.getElement()

      if (visible) {
        if (el) el.style.display = ''
        const div = el?.querySelector('div')
        if (div) {
          ;(div as HTMLElement).style.background = isSelected ? '#1e40af' : clusterColor
          ;(div as HTMLElement).style.transform = isSelected ? 'scale(1.3)' : 'scale(1)'
          ;(div as HTMLElement).style.border = isSelected
            ? '3px solid #60a5fa'
            : '2px solid white'
        }
      } else {
        if (el) el.style.display = 'none'
      }
    })
  }

  const toggleStore = (storeId: string) => {
    setStores((prev) =>
      prev.map((s) => (s.id === storeId ? { ...s, visible: !s.visible } : s))
    )
  }

  const toggleRider = (riderId: string) => {
    setRiders((prev) =>
      prev.map((r) => (r.id === riderId ? { ...r, selected: !r.selected } : r))
    )
  }

  const selectAllVisible = () => {
    const visibleStoreIds = stores.filter((s) => s.visible).map((s) => s.id)
    setSelectedOrders(orders.filter((o) => visibleStoreIds.includes(o.store_id)).map((o) => o.id))
  }

  const autoDistribute = () => {
    const selectedRiders = riders.filter((r) => r.selected)
    if (selectedRiders.length === 0) {
      alert('Selecciona al menos un motorizado')
      return
    }

    const visibleOrders = orders.filter((o) => {
      const store = stores.find((s) => s.id === o.store_id)
      return store?.visible ?? true
    })

    if (visibleOrders.length === 0) {
      alert('No hay pedidos visibles')
      return
    }

    const points = visibleOrders.map((o) => ({ lat: o.lat, lng: o.lng, id: o.id }))
    const assignments = kMeans(points, selectedRiders.length)

    const fullAssignments = orders.map((o) => {
      const idx = visibleOrders.findIndex((vo) => vo.id === o.id)
      return idx >= 0 ? assignments[idx] : -1
    })

    setClusters(fullAssignments)
    setAutoMode(true)
    setSelectedOrders([])
  }

  const generateAutoRoutes = async () => {
    const selectedRidersList = riders.filter((r) => r.selected)
    if (selectedRidersList.length === 0) {
      alert('Selecciona motorizados')
      return
    }

    if (clusters.length === 0) {
      alert('Primero haz click en Auto-distribuir')
      return
    }

    setGenerating(true)
    const supabase = createClient()
    const newLinks: { rider: string; link: string; color: string; km?: number }[] = []

    try {
      for (let ci = 0; ci < selectedRidersList.length; ci++) {
        const rider = selectedRidersList[ci]
        const clusterOrders2 = orders.filter((_, i) => clusters[i] === ci)
        const clusterOrderIds = clusterOrders2.map((o) => o.id)

        if (clusterOrderIds.length === 0) continue

        let kmTotal = 0
        try {
            const dominantStoreId = clusterOrders2[0]?.store_id
            const dominantStore = stores.find((s) => s.id === dominantStoreId)
            const originPoint =
              rider.origin_lat && rider.origin_lng
                ? [`${rider.origin_lng},${rider.origin_lat}`]
                : dominantStore?.origin_lat && dominantStore?.origin_lng
                  ? [`${dominantStore.origin_lng},${dominantStore.origin_lat}`]
                  : []

          const coordPoints = [
            ...originPoint,
            ...clusterOrders2.map((o) => `${o.lng},${o.lat}`),
          ]

          if (coordPoints.length >= 2) {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 25000)

            const res = await fetch(
              `https://router.project-osrm.org/trip/v1/driving/${coordPoints.join(
                ';'
              )}?roundtrip=false&source=first&geometries=geojson&overview=false`,
              { signal: controller.signal }
            )

            clearTimeout(timeout)
            const data = await res.json()

            if (data.code === 'Ok' && data.trips?.[0]) {
              kmTotal = parseFloat((data.trips[0].distance / 1000).toFixed(1))
            }
          }
        } catch (e) {
          // continuar sin km
        }

        const token =
          Math.random().toString(36).substring(2, 15) +
          Math.random().toString(36).substring(2, 15)

        const clusterOrders = orders.filter((o) => clusterOrderIds.includes(o.id))

        const { data: route, error } = await supabase
          .from('global_routes')
          .insert({
            date: new Date().toISOString().split('T')[0],
            store_ids_included: [...new Set(clusterOrders.map((o) => o.store_id))],
            rider_id: rider.id,
            order_ids: clusterOrderIds,
            optimized_order: clusterOrderIds,
            route_token: token,
            is_active: true,
            total_km: kmTotal,
          })
          .select('id, route_token')
          .single()

        if (!error && route) {
          newLinks.push({
            rider: rider.name,
            link: window.location.origin + '/route/' + route.route_token,
            color: CLUSTER_COLORS[ci % CLUSTER_COLORS.length],
            km: kmTotal,
          })
        }
      }

      setRouteLinks((prev) => [...prev, ...newLinks])
    } catch (e) {
      console.error(e)
      alert('Error al generar rutas')
    } finally {
      setGenerating(false)
    }
  }

  const generateManualRoute = async () => {
    if (selectedOrders.length === 0) {
      alert('Selecciona pedidos en el mapa')
      return
    }

    if (!manualRider) {
      alert('Selecciona un motorizado')
      return
    }

    setGenerating(true)

    try {
      const supabase = createClient()
      const token =
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15)

      const rider = riders.find((r) => r.id === manualRider)
      const selOrders = orders.filter((o) => selectedOrders.includes(o.id))

      const { data: route, error } = await supabase
        .from('global_routes')
        .insert({
          date: new Date().toISOString().split('T')[0],
          store_ids_included: [...new Set(selOrders.map((o) => o.store_id))],
          rider_id: manualRider,
          order_ids: selectedOrders,
          optimized_order: selectedOrders,
          route_token: token,
          is_active: true,
          total_km: 0,
        })
        .select('id, route_token')
        .single()

      if (!error && route) {
        setRouteLinks((prev) => [
          ...prev,
          {
            rider: rider?.name || 'Motorizado',
            link: window.location.origin + '/route/' + route.route_token,
            color: '#2563eb',
          },
        ])
        setSelectedOrders([])
      }
    } catch (e) {
      alert('Error al generar la ruta')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  const selectedRidersList = riders.filter((r) => r.selected)
  const visibleOrderCount = orders.filter(
    (o) => stores.find((s) => s.id === o.store_id)?.visible
  ).length

  return (
    <div className="h-full">
      <div className="mb-4">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Mapa Global</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {orders.length} pedidos con GPS · {stores.length} tienda
          {stores.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-4 max-h-[700px] overflow-y-auto pr-1">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h2 className="font-semibold text-gray-900 text-sm mb-3">Tiendas</h2>
            {stores.length === 0 ? (
              <p className="text-xs text-gray-400">No hay pedidos con GPS</p>
            ) : (
              <div className="space-y-1">
                {stores.map((store) => (
                  <button
                    key={store.id}
                    onClick={() => toggleStore(store.id)}
                    className={`flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-lg transition-all touch-manipulation ${
                      store.visible ? 'opacity-100' : 'opacity-40'
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: store.color }}
                    />
                    <span className="text-xs text-gray-700 flex-1">{store.name}</span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                      {store.orderCount}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h2 className="font-semibold text-gray-900 text-sm mb-1">
              🤖 Auto-distribuir por zonas
            </h2>
            <p className="text-xs text-gray-400 mb-3">
              Selecciona motorizados y el sistema divide los pedidos automáticamente por
              zona geográfica
            </p>

            <div className="space-y-1 mb-3">
              {riders.map((r) => (
                <button
                  key={r.id}
                  onClick={() => toggleRider(r.id)}
                  className={`flex items-center gap-2 w-full text-left py-2 px-3 rounded-lg border transition-all touch-manipulation ${
                    r.selected
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      r.selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                    }`}
                  >
                    {r.selected && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <span className="text-xs text-gray-700">{r.name}</span>
                </button>
              ))}
            </div>

            {selectedRidersList.length > 0 && (
              <div className="flex gap-1 mb-2 flex-wrap">
                {selectedRidersList.map((r, i) => (
                  <span
                    key={r.id}
                    className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                    style={{ background: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }}
                  >
                    {r.name}
                  </span>
                ))}
              </div>
            )}

            <button
              onClick={autoDistribute}
              disabled={selectedRidersList.length === 0}
              className="w-full py-2.5 rounded-xl text-sm font-medium bg-purple-600 text-white disabled:opacity-50 touch-manipulation mb-2"
            >
              🗺️ Auto-distribuir ({visibleOrderCount} pedidos ÷{' '}
              {selectedRidersList.length || '?'} motorizados)
            </button>

            {clusters.length > 0 && autoMode && (
              <>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 mb-2">
                  <p className="text-xs text-purple-700 font-medium">✅ Zonas calculadas</p>
                  {selectedRidersList.map((r, i) => {
                    const count = clusters.filter((c) => c === i).length
                    return (
                      <p key={r.id} className="text-xs text-purple-600 mt-0.5">
                        <span
                          className="inline-block w-2 h-2 rounded-full mr-1"
                          style={{ background: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }}
                        />
                        {r.name}: {count} pedidos
                      </p>
                    )
                  })}
                </div>

                <button
                  onClick={generateAutoRoutes}
                  disabled={generating}
                  className="w-full py-2.5 rounded-xl text-sm font-medium bg-green-600 text-white disabled:opacity-50 touch-manipulation"
                >
                  {generating ? '⏳ Generando...' : '✅ Generar links por motorizado'}
                </button>
              </>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h2 className="font-semibold text-gray-900 text-sm mb-1">✋ Asignación manual</h2>
            <p className="text-xs text-gray-400 mb-2">
              Selecciona pedidos y asígnalos a un motorizado
            </p>

            <button
              onClick={selectAllVisible}
              className="w-full py-2 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 mb-2 touch-manipulation"
            >
              Seleccionar todos visibles ({visibleOrderCount})
            </button>

            {selectedOrders.length > 0 && (
              <div className="bg-blue-50 rounded-lg px-3 py-2 mb-2 flex items-center justify-between">
                <p className="text-xs text-blue-700 font-medium">
                  {selectedOrders.length} seleccionados
                </p>
                <button
                  onClick={() => setSelectedOrders([])}
                  className="text-xs text-blue-500 underline"
                >
                  Limpiar
                </button>
              </div>
            )}

            <select
              value={manualRider}
              onChange={(e) => setManualRider(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2"
            >
              <option value="">Seleccionar motorizado...</option>
              {riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            <button
              onClick={generateManualRoute}
              disabled={generating || selectedOrders.length === 0 || !manualRider}
              className="w-full py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white disabled:opacity-50 touch-manipulation"
            >
              {generating ? '⏳ Generando...' : '🗺️ Generar Ruta'}
            </button>
          </div>

          {routeLinks.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 text-sm">Links generados</h2>
                <button
                  onClick={() => setRouteLinks([])}
                  className="text-xs text-red-400 underline"
                >
                  Limpiar
                </button>
              </div>

              {routeLinks.map((rl, i) => (
                <div
                  key={i}
                  className="rounded-lg p-3 border"
                  style={{
                    borderColor: rl.color + '40',
                    background: rl.color + '10',
                  }}
                >
                  <p className="text-xs font-semibold mb-1" style={{ color: rl.color }}>
                    🏍️ {rl.rider}
                  </p>

                  {rl.km ? (
                    <p className="text-xs font-medium mb-1" style={{ color: rl.color }}>
                      📏 {rl.km} km estimados
                    </p>
                  ) : null}

                  <p className="text-xs text-gray-500 break-all mb-2">{rl.link}</p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(rl.link)
                        alert('Copiado')
                      }}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white touch-manipulation"
                    >
                      📋 Copiar
                    </button>

                    <button
                      onClick={() =>
                        window.open(
                          'https://wa.me/?text=' + encodeURIComponent('Tu ruta: ' + rl.link),
                          '_blank'
                        )
                      }
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white touch-manipulation"
                    >
                      💬 WA
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div
            ref={mapRef}
            className="w-full rounded-xl overflow-hidden border border-gray-200"
            style={{ height: '650px' }}
          />
          <p className="text-xs text-gray-400 mt-2 text-center">
            {clusters.length > 0
              ? '🎨 Colores = zonas por motorizado'
              : 'Click en marcador para seleccionar y ver detalles'}
          </p>
        </div>
      </div>
    </div>
  )
}