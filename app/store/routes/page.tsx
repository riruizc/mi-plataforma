'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'

type Order = {
  id: string
  order_code: string
  customer_name: string
  destination: string
  reference: string
  lat: number | null
  lng: number | null
  status: string
}

export default function RoutesPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)
  const mapRef = useRef<any>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])

  useEffect(() => {
    loadOrders()
  }, [])

  useEffect(() => {
    if (!loading) {
      initMap()
    }
  }, [loading])

  const loadOrders = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: store } = await supabase
        .from('stores').select('id').eq('email', user.email).single()
      if (!store) return
      setStoreId(store.id)

      const { data } = await supabase
        .from('orders')
        .select('*, customers(name)')
        .eq('store_id', store.id)
        .in('status', ['pending', 'in_route'])
        .order('created_at', { ascending: false })

      const mapped = (data || []).map((o: any) => ({
        ...o,
        customer_name: o.customers?.name || 'Sin nombre',
      }))
      setOrders(mapped)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const initMap = async () => {
    if (typeof window === 'undefined') return
    if (mapInstanceRef.current) return

    const L = await import('leaflet')
    await import('leaflet/dist/leaflet.css')

    if (!mapRef.current) return

    const map = L.map(mapRef.current).setView([-8.1116, -79.0286], 13)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(map)

    mapInstanceRef.current = map
  }

  const toggleSelect = (orderId: string) => {
    setSelected(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    )
  }

  const selectedOrders = orders.filter(o => selected.includes(o.id))
  const ordersWithLocation = selectedOrders.filter(o => o.lat && o.lng)
  const ordersWithoutLocation = selectedOrders.filter(o => !o.lat || !o.lng)

  const generateRoute = async () => {
    if (selected.length === 0) { alert('Selecciona al menos un pedido'); return }

    const L = await import('leaflet')
    const map = mapInstanceRef.current
    if (!map) return

    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    const icon = L.divIcon({
      className: '',
      html: '<div style="background:#2563eb;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)">📦</div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    })

    const bounds: [number, number][] = []

    selectedOrders.forEach((order, i) => {
      if (order.lat && order.lng) {
        const marker = L.marker([order.lat, order.lng], { icon })
          .addTo(map)
          .bindPopup(`<b>${order.order_code}</b><br>${order.customer_name}<br>${order.destination}`)
        markersRef.current.push(marker)
        bounds.push([order.lat, order.lng])
      }
    })

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] })
    }

    alert(`Ruta generada con ${selected.length} pedidos. ${ordersWithoutLocation.length > 0 ? ordersWithoutLocation.length + ' pedidos sin ubicación GPS.' : ''}`)
  }

  const statusLabel: any = {
    pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
    in_route: { label: 'En ruta', color: 'bg-blue-100 text-blue-700' },
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-500">Cargando pedidos...</p>
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Rutas</h1>
        <p className="text-gray-500 mt-1">Selecciona pedidos y genera una ruta</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">
              Pedidos activos ({orders.length})
            </h2>
            {selected.length > 0 && (
              <span className="text-sm text-blue-600 font-medium">
                {selected.length} seleccionados
              </span>
            )}
          </div>

          {orders.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <p className="text-2xl mb-2">📦</p>
              <p className="text-gray-500 text-sm">No hay pedidos pendientes</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {orders.map(order => (
                <div
                  key={order.id}
                  onClick={() => toggleSelect(order.id)}
                  className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${
                    selected.includes(order.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-100 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 text-sm">{order.order_code}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusLabel[order.status]?.color}`}>
                          {statusLabel[order.status]?.label}
                        </span>
                        {(!order.lat || !order.lng) && (
                          <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Sin GPS</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700">{order.customer_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{order.destination}</p>
                      {order.reference && (
                        <p className="text-xs text-gray-400">{order.reference}</p>
                      )}
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-1 ${
                      selected.includes(order.id)
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-gray-300'
                    }`}>
                      {selected.includes(order.id) && (
                        <svg className="w-full h-full text-white p-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {orders.length > 0 && (
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setSelected(orders.map(o => o.id))}
                className="flex-1 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Seleccionar todos
              </button>
              <button
                onClick={generateRoute}
                disabled={selected.length === 0}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🗺️ Ver en mapa
              </button>
            </div>
          )}
        </div>

        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Mapa</h2>
          <div
            ref={mapRef}
            className="w-full rounded-xl overflow-hidden border border-gray-200"
            style={{ height: '450px' }}
          />
          {ordersWithoutLocation.length > 0 && selected.length > 0 && (
            <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-sm text-orange-700 font-medium">
                ⚠️ {ordersWithoutLocation.length} pedido(s) sin coordenadas GPS no aparecen en el mapa
              </p>
              <ul className="mt-1 space-y-0.5">
                {ordersWithoutLocation.map(o => (
                  <li key={o.id} className="text-xs text-orange-600">• {o.order_code} — {o.destination}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}