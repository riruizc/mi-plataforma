'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'

type StoreData = {
  id: string
  name: string
  owner_name: string
  phone: string
  email: string
  theme_color: string
  plan: string
  expires_at: string | null
  status: string
  origin_lat: number | null
  origin_lng: number | null
  activeOrders: number
}

export default function StoresMapPage() {
  const [stores, setStores] = useState<StoreData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStore, setSelectedStore] = useState<StoreData | null>(null)

  const mapRef = useRef<any>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())

  useEffect(() => { loadStores() }, [])
  useEffect(() => { if (!loading) initMap() }, [loading])

  const loadStores = async () => {
    try {
      const supabase = createClient()

      const { data: storesData } = await supabase
        .from('stores')
        .select('id, name, owner_name, phone, email, theme_color, plan, expires_at, status, origin_lat, origin_lng')
        .eq('status', 'active')
        .order('name')

      // Contar pedidos activos por tienda
      const { data: ordersData } = await supabase
        .from('orders')
        .select('store_id')
        .in('status', ['pending', 'in_route'])

      const orderCounts: Record<string, number> = {}
      ;(ordersData || []).forEach((o: any) => {
        orderCounts[o.store_id] = (orderCounts[o.store_id] || 0) + 1
      })

      setStores((storesData || []).map((s: any) => ({
        ...s,
        activeOrders: orderCounts[s.id] || 0,
      })))
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

    const map = L.map(mapRef.current).setView([-12.0464, -77.0428], 6)

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

    const storesWithLocation = stores.filter(s => s.origin_lat && s.origin_lng)

    storesWithLocation.forEach((store) => {
      const color = store.theme_color || '#2563eb'
      const hasOrders = store.activeOrders > 0

      const icon = L.divIcon({
        className: '',
        html: `
          <div style="position:relative">
            <div style="background:${color};color:white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer">
              🏪
            </div>
            ${hasOrders ? `<div style="position:absolute;top:-4px;right:-4px;background:#dc2626;color:white;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:bold;border:2px solid white">${store.activeOrders}</div>` : ''}
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      })

      const marker = L.marker([store.origin_lat!, store.origin_lng!], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="min-width:180px">
            <p style="font-weight:bold;margin:0 0 4px;font-size:14px">${store.name}</p>
            <p style="margin:0 0 2px;font-size:12px;color:#555">👤 ${store.owner_name || '-'}</p>
            <p style="margin:0 0 2px;font-size:12px;color:#555">📱 ${store.phone || '-'}</p>
            <p style="margin:0 0 4px;font-size:12px;color:#555">📧 ${store.email}</p>
            <p style="margin:0 0 2px;font-size:12px">
              <span style="background:#dbeafe;color:#1d4ed8;padding:2px 6px;border-radius:999px;font-size:11px">
                ${store.plan || 'free'}
              </span>
            </p>
            ${store.expires_at ? `<p style="margin:4px 0 0;font-size:11px;color:#888">Vence: ${new Date(store.expires_at).toLocaleDateString('es-PE')}</p>` : ''}
            ${store.activeOrders > 0 ? `<p style="margin:4px 0 0;font-size:12px;font-weight:bold;color:#dc2626">📦 ${store.activeOrders} pedidos activos</p>` : '<p style="margin:4px 0 0;font-size:12px;color:#888">Sin pedidos activos</p>'}
          </div>
        `)

      marker.on('click', () => setSelectedStore(store))
      markersRef.current.set(store.id, marker)
    })

    if (storesWithLocation.length > 0) {
      map.fitBounds(
        storesWithLocation.map(s => [s.origin_lat!, s.origin_lng!] as [number, number]),
        { padding: [60, 60] }
      )
    }
  }

  const focusStore = (store: StoreData) => {
    if (!store.origin_lat || !store.origin_lng || !mapInstanceRef.current) return
    mapInstanceRef.current.setView([store.origin_lat, store.origin_lng], 14)
    const marker = markersRef.current.get(store.id)
    if (marker) marker.openPopup()
    setSelectedStore(store)
  }

  const getDaysLeft = (expiresAt: string | null) => {
    if (!expiresAt) return null
    const diff = new Date(expiresAt).getTime() - new Date().getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
    </div>
  )

  const storesWithLocation = stores.filter(s => s.origin_lat && s.origin_lng)
  const storesWithoutLocation = stores.filter(s => !s.origin_lat || !s.origin_lng)
  const totalActiveOrders = stores.reduce((sum, s) => sum + s.activeOrders, 0)

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Mapa de Tiendas</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {stores.length} tiendas activas · {totalActiveOrders} pedidos en curso
        </p>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{stores.length}</p>
          <p className="text-xs text-gray-500">Tiendas activas</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{totalActiveOrders}</p>
          <p className="text-xs text-gray-500">Pedidos activos</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-2xl font-bold text-orange-500">{storesWithoutLocation.length}</p>
          <p className="text-xs text-gray-500">Sin ubicación</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lista lateral */}
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {stores.map(store => {
            const daysLeft = getDaysLeft(store.expires_at)
            const hasLocation = store.origin_lat && store.origin_lng
            const isSelected = selectedStore?.id === store.id

            return (
              <button key={store.id} onClick={() => hasLocation ? focusStore(store) : setSelectedStore(store)}
                className={`w-full text-left bg-white rounded-xl border p-3 transition-all touch-manipulation ${
                  isSelected ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: store.theme_color || '#2563eb' }} />
                  <span className="font-semibold text-gray-900 text-sm flex-1 truncate">{store.name}</span>
                  {store.activeOrders > 0 && (
                    <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                      {store.activeOrders} 📦
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{store.owner_name || store.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">
                    {store.plan || 'free'}
                  </span>
                  {daysLeft !== null && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      daysLeft <= 7 ? 'bg-red-50 text-red-600' :
                      daysLeft <= 30 ? 'bg-orange-50 text-orange-600' :
                      'bg-green-50 text-green-600'
                    }`}>
                      {daysLeft > 0 ? `${daysLeft}d` : 'Vencido'}
                    </span>
                  )}
                  {!hasLocation && (
                    <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">Sin GPS</span>
                  )}
                </div>
              </button>
            )
          })}

          {storesWithoutLocation.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
              <p className="text-xs text-orange-700 font-medium">
                ⚠️ {storesWithoutLocation.length} tienda(s) sin ubicación configurada
              </p>
              <p className="text-xs text-orange-500 mt-0.5">
                Las tiendas deben configurar su punto de salida en Ajustes para aparecer en el mapa.
              </p>
            </div>
          )}
        </div>

        {/* Mapa */}
        <div className="lg:col-span-2">
          <div ref={mapRef} className="w-full rounded-xl overflow-hidden border border-gray-200"
            style={{ height: '580px' }} />
          <p className="text-xs text-gray-400 mt-2 text-center">
            🏪 = tienda · número rojo = pedidos activos · click para ver detalles
          </p>
        </div>
      </div>
    </div>
  )
}