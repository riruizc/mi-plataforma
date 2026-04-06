'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import jsPDF from 'jspdf'

type OrderItem = {
  id?: string
  product_name: string
  color: string
  quantity: number
  unit_price: number
  subtotal: number
}

type Order = {
  id: string
  order_code: string
  customer_name: string
  destination: string
  reference: string
  lat: number | null
  lng: number | null
  status: string
  created_at: string
  delivery_method: string
  total_amount: number
  customers?: { name?: string; phone?: string; dni?: string } | null
  stores?: { name?: string } | null
  order_items?: OrderItem[]
}

export default function RoutesPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [storeOrigin, setStoreOrigin] = useState<{ lat: number; lng: number } | null>(null)
  const [routeLink, setRouteLink] = useState('')
  const [optimizing, setOptimizing] = useState(false)
  const [optimizingMsg, setOptimizingMsg] = useState('Optimizando...')
  const [totalKm, setTotalKm] = useState<number | null>(null)
  const [optimizedOrder, setOptimizedOrder] = useState<string[]>([])

  const mapRef = useRef<any>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const routeLayerRef = useRef<any>(null)

  useEffect(() => { loadOrders() }, [])
  useEffect(() => { if (!loading) initMap() }, [loading])

  const loadOrders = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: store } = await supabase.from('stores').select('id, origin_lat, origin_lng').eq('email', (user.email ?? '').toLowerCase()).single()
      if (!store) return
      setStoreId(store.id)
      if (store.origin_lat && store.origin_lng) setStoreOrigin({ lat: store.origin_lat, lng: store.origin_lng })
      const { data } = await supabase.from('orders').select('*, order_items(*), customers(name, phone, dni), stores(name)').eq('store_id', store.id).in('status', ['pending', 'in_route']).eq('delivery_method', 'motorizado').order('created_at', { ascending: false })
      setOrders((data || []).map((o: any) => ({ ...o, customer_name: o.customers?.name || 'Sin nombre' })))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const initMap = async () => {
    if (typeof window === 'undefined' || mapInstanceRef.current || !mapRef.current) return
    const L = await import('leaflet')
    await import('leaflet/dist/leaflet.css' as any)
    const map = L.map(mapRef.current).setView([-8.1116, -79.0286], 13)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map)
    mapInstanceRef.current = map
  }

  const toggleSelect = (orderId: string) => {
    setSelected(prev => prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId])
  }

  const selectedOrders = orders.filter(o => selected.includes(o.id))
  const ordersWithLocation = selectedOrders.filter(o => o.lat && o.lng)
  const ordersWithoutLocation = selectedOrders.filter(o => !o.lat || !o.lng)

  // Optimización local por distancia (fallback cuando OSRM falla)
  const optimizeLocally = (points: Order[], origin: { lat: number; lng: number } | null): Order[] => {
    if (points.length <= 1) return points
    const haversine = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
      const R = 6371
      const dLat = (b.lat - a.lat) * Math.PI / 180
      const dLng = (b.lng - a.lng) * Math.PI / 180
      const h = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180) * Math.cos(b.lat*Math.PI/180) * Math.sin(dLng/2)**2
      return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h))
    }
    const remaining = [...points]
    const sorted: Order[] = []
    let current = origin || { lat: points[0].lat!, lng: points[0].lng! }
    while (remaining.length > 0) {
      let minDist = Infinity, minIdx = 0
      remaining.forEach((o, i) => {
        const d = haversine(current, { lat: o.lat!, lng: o.lng! })
        if (d < minDist) { minDist = d; minIdx = i }
      })
      sorted.push(remaining[minIdx])
      current = { lat: remaining[minIdx].lat!, lng: remaining[minIdx].lng! }
      remaining.splice(minIdx, 1)
    }
    return sorted
  }



  const generateRoute = async () => {
    if (selected.length === 0) { alert('Selecciona al menos un pedido'); return }
    if (!storeId) return
    const L = await import('leaflet')
    const map = mapInstanceRef.current
    if (!map) return

    setOptimizing(true)
    setOptimizingMsg('Optimizando...')
    setRouteLink('')
    setTotalKm(null)
    setOptimizedOrder([])

    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    if (routeLayerRef.current) { routeLayerRef.current.remove(); routeLayerRef.current = null }

    if (ordersWithLocation.length === 0) { alert('Ningún pedido seleccionado tiene coordenadas GPS'); setOptimizing(false); return }

    // Marcador origen
    if (storeOrigin) {
      const originIcon = L.divIcon({ className: '', html: `<div style="background:#16a34a;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)">🏪</div>`, iconSize: [32, 32], iconAnchor: [16, 16] })
      markersRef.current.push(L.marker([storeOrigin.lat, storeOrigin.lng], { icon: originIcon }).addTo(map).bindPopup('<b>Punto de salida</b>'))
    }

    const bounds: [number, number][] = storeOrigin ? [[storeOrigin.lat, storeOrigin.lng]] : []
    ordersWithLocation.forEach((order, i) => {
      const icon = L.divIcon({ className: '', html: `<div style="background:#2563eb;color:white;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)">${i + 1}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] })
      markersRef.current.push(L.marker([order.lat!, order.lng!], { icon }).addTo(map).bindPopup(`<b>${order.order_code}</b><br>${order.customer_name}`))
      bounds.push([order.lat!, order.lng!])
    })
    if (bounds.length > 0) map.fitBounds(bounds, { padding: [50, 50] })

    let savedOptimized = selected
    let kmTotal = 0
    let usedLocalOptimization = false

    try {
      const coordPoints = [
        ...(storeOrigin ? [`${storeOrigin.lng},${storeOrigin.lat}`] : []),
        ...ordersWithLocation.map(o => `${o.lng},${o.lat}`),
      ]

      if (ordersWithLocation.length >= 1 && storeOrigin) {
        try {
          setOptimizingMsg('Optimizando con ORS...')
          const jobs = ordersWithLocation.map(o => ({ id: o.id, lat: o.lat!, lng: o.lng! }))
          const res = await fetch('/api/optimize-route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobs, origin: storeOrigin }),
          })

          if (res.ok) {
            const result = await res.json()
            if (result.orderedIds?.length > 0) {
              kmTotal = result.totalKm || 0
              const sortedByOrs = result.orderedIds
                .map((id: string) => ordersWithLocation.find(o => o.id === id))
                .filter(Boolean) as Order[]

              savedOptimized = sortedByOrs.map(x => x.id)
              setOptimizedOrder(savedOptimized)
              setTotalKm(result.totalKm)

              // Re-numerar marcadores
              markersRef.current.forEach(m => m.remove())
              markersRef.current = []
              if (storeOrigin) {
                const originIcon = L.divIcon({ className: '', html: `<div style="background:#16a34a;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)">🏪</div>`, iconSize: [32, 32], iconAnchor: [16, 16] })
                markersRef.current.push(L.marker([storeOrigin.lat, storeOrigin.lng], { icon: originIcon }).addTo(map).bindPopup('<b>Punto de salida</b>'))
              }
              sortedByOrs.forEach((order, i) => {
                const icon = L.divIcon({ className: '', html: `<div style="background:#2563eb;color:white;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)">${i + 1}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] })
                markersRef.current.push(L.marker([order.lat!, order.lng!], { icon }).addTo(map).bindPopup(`<b>#${i + 1} — ${order.order_code}</b><br>${order.customer_name}`))
              })
            } else {
              usedLocalOptimization = true
            }
          } else {
            usedLocalOptimization = true
          }
        } catch (e) {
          console.warn('ORS falló, usando optimización local')
          usedLocalOptimization = true
        }
      } else {
        usedLocalOptimization = true
      }
    } catch (e) {
      console.error('Error en optimización:', e)
      usedLocalOptimization = true
    }

    // Fallback: optimización local por distancia (vecino más cercano)
    if (usedLocalOptimization) {
      setOptimizingMsg('Usando optimización local...')
      const sorted = optimizeLocally(ordersWithLocation, storeOrigin)
      savedOptimized = sorted.map(x => x.id)
      setOptimizedOrder(savedOptimized)

      // Re-numerar marcadores
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      if (storeOrigin) {
        const originIcon = L.divIcon({ className: '', html: `<div style="background:#16a34a;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)">🏪</div>`, iconSize: [32, 32], iconAnchor: [16, 16] })
        markersRef.current.push(L.marker([storeOrigin.lat, storeOrigin.lng], { icon: originIcon }).addTo(map).bindPopup('<b>Punto de salida</b>'))
      }
      sorted.forEach((order, i) => {
        const icon = L.divIcon({ className: '', html: `<div style="background:#2563eb;color:white;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)">${i + 1}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] })
        markersRef.current.push(L.marker([order.lat!, order.lng!], { icon }).addTo(map).bindPopup(`<b>#${i + 1} — ${order.order_code}</b><br>${order.customer_name}`))
      })

      alert('⚠️ OSRM no disponible. Se usó optimización por distancia directa — la ruta puede no ser perfecta.')
    }

    try {
      const supabase = createClient()
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
      const { data: route, error } = await supabase.from('routes').insert({
        store_id: storeId,
        origin_lat: storeOrigin?.lat || null,
        origin_lng: storeOrigin?.lng || null,
        order_ids: selected,
        optimized_order: savedOptimized,
        route_token: token,
        is_active: true,
        total_km: kmTotal,
      }).select('id, route_token').single()

      if (error || !route) { alert('Error al guardar la ruta'); setOptimizing(false); return }
      setRouteLink(window.location.origin + '/route/' + route.route_token)
    } catch (e) { console.error(e); alert('Error al crear la ruta') }

    setOptimizing(false)
  }

  const generarComprobante = (order: any) => {
    const doc = new jsPDF()
    const store_name = order.stores?.name || 'Tienda'
    const fecha = new Date(order.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text(store_name, 105, 20, { align: 'center' })
    doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.text('NOTA DE VENTA', 105, 30, { align: 'center' })
    doc.setFontSize(10)
    doc.text('Codigo: ' + order.order_code, 20, 45)
    doc.text('Fecha: ' + fecha, 20, 52)
    doc.text('Cliente: ' + (order.customers?.name || '-'), 20, 59)
    doc.text('Celular: ' + (order.customers?.phone || '-'), 20, 66)
    doc.text('DNI: ' + (order.customers?.dni || '-'), 20, 73)
    doc.setLineWidth(0.5); doc.line(20, 78, 190, 78)
    doc.setFont('helvetica', 'bold')
    doc.text('Producto', 20, 85); doc.text('Color', 100, 85); doc.text('Cant.', 135, 85); doc.text('Precio', 155, 85); doc.text('Subtotal', 175, 85)
    doc.line(20, 88, 190, 88); doc.setFont('helvetica', 'normal')
    let y = 95
    ;(order.order_items || []).forEach((item: any) => {
      doc.text(String(item.product_name).substring(0, 30), 20, y)
      doc.text(String(item.color), 100, y); doc.text(String(item.quantity), 135, y)
      doc.text('S/ ' + Number(item.unit_price).toFixed(2), 150, y); doc.text('S/ ' + Number(item.subtotal).toFixed(2), 175, y)
      y += 8
    })
    doc.line(20, y, 190, y); y += 8; doc.setFont('helvetica', 'bold')
    doc.text('TOTAL: S/ ' + Number(order.total_amount).toFixed(2), 175, y, { align: 'right' }); y += 12
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text('Entrega: Motorizado', 20, y)
    if (order.destination) { y += 7; doc.text('Direccion: ' + order.destination, 20, y) }
    if (order.reference) { y += 7; doc.text('Referencia: ' + order.reference, 20, y) }
    doc.save('comprobante-' + order.order_code + '.pdf')
  }

  const statusLabel: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
    in_route: { label: 'En ruta', color: 'bg-blue-100 text-blue-700' },
  }

  const displayOrders = optimizedOrder.length > 0
    ? [...orders].sort((a, b) => {
        const ai = optimizedOrder.indexOf(a.id), bi = optimizedOrder.indexOf(b.id)
        if (ai === -1 && bi === -1) return 0
        if (ai === -1) return 1; if (bi === -1) return -1
        return ai - bi
      })
    : orders

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto" />
    </div>
  )

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Rutas</h1>
        <p className="text-gray-500 text-sm mt-0.5">Selecciona pedidos y genera una ruta optimizada</p>
        {storeOrigin
          ? <p className="text-xs text-green-600 mt-1">🏪 Punto de salida configurado</p>
          : <p className="text-xs text-orange-500 mt-1">⚠️ Sin punto de salida — configúralo en <a href="/store/settings" className="underline">Ajustes</a></p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 text-sm lg:text-base">Pedidos activos ({orders.length})</h2>
            {selected.length > 0 && <span className="text-sm text-blue-600 font-medium">{selected.length} seleccionados</span>}
          </div>

          {orders.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <p className="text-2xl mb-2">📦</p>
              <p className="text-gray-500 text-sm">No hay pedidos pendientes</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] lg:max-h-[500px] overflow-y-auto pr-1">
              {displayOrders.map(order => {
                const optimIdx = optimizedOrder.indexOf(order.id)
                const showNumber = optimizedOrder.length > 0 && selected.includes(order.id) && !!order.lat && !!order.lng
                return (
                  <div key={order.id} onClick={() => toggleSelect(order.id)}
                    className={`bg-white rounded-xl border p-3 lg:p-4 cursor-pointer transition-all touch-manipulation ${selected.includes(order.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-300'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 flex-1">
                        {showNumber && (
                          <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{optimIdx + 1}</div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm">{order.order_code}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusLabel[order.status]?.color}`}>{statusLabel[order.status]?.label}</span>
                            {(!order.lat || !order.lng) && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Sin GPS</span>}
                          </div>
                          <p className="text-sm text-gray-700">{order.customer_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{order.destination}</p>
                          {order.reference && <p className="text-xs text-gray-400">{order.reference}</p>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <button onClick={e => { e.stopPropagation(); generarComprobante(order) }}
                          className="px-2 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-medium touch-manipulation">📄 PDF</button>
                        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${selected.includes(order.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                          {selected.includes(order.id) && <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {orders.length > 0 && (
            <>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setSelected(orders.map(o => o.id))}
                  className="flex-1 py-2.5 rounded-xl text-xs lg:text-sm font-medium border border-gray-200 text-gray-700 touch-manipulation">
                  Seleccionar todos
                </button>
                <button onClick={generateRoute} disabled={selected.length === 0 || optimizing}
                  className="flex-1 py-2.5 rounded-xl text-xs lg:text-sm font-medium bg-blue-600 text-white disabled:opacity-50 touch-manipulation">
                  {optimizing ? `⏳ ${optimizingMsg}` : '🗺️ Generar ruta'}
                </button>
              </div>

              {totalKm !== null && (
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-2">
                  <span className="text-blue-600 text-lg">📍</span>
                  <div>
                    <p className="text-sm font-semibold text-blue-800">Ruta optimizada</p>
                    <p className="text-xs text-blue-600">{totalKm} km totales · {ordersWithLocation.length} paradas</p>
                  </div>
                </div>
              )}

              {routeLink && (
                <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-green-800 mb-2">🔗 Link del motorizado:</p>
                  <p className="text-xs text-green-600 break-all mb-3">{routeLink}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { navigator.clipboard.writeText(routeLink); alert('Link copiado') }}
                      className="py-2.5 rounded-xl text-xs font-medium bg-blue-600 text-white touch-manipulation">📋 Copiar link</button>
                    <button onClick={() => window.open('https://wa.me/?text=' + encodeURIComponent('Tu ruta de entregas: ' + routeLink), '_blank')}
                      className="py-2.5 rounded-xl text-xs font-medium bg-green-600 text-white touch-manipulation">💬 WhatsApp</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <h2 className="font-semibold text-gray-900 mb-3 text-sm lg:text-base">Mapa</h2>
          <div ref={mapRef} className="w-full rounded-xl overflow-hidden border border-gray-200" style={{ height: '300px' }} />
          {ordersWithoutLocation.length > 0 && selected.length > 0 && (
            <div className="mt-3 bg-orange-50 border border-orange-200 rounded-xl p-3">
              <p className="text-sm text-orange-700 font-medium">⚠️ {ordersWithoutLocation.length} pedido(s) sin GPS no aparecen en el mapa</p>
              {ordersWithoutLocation.map(o => <p key={o.id} className="text-xs text-orange-600 mt-0.5">• {o.order_code} — {o.destination}</p>)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}