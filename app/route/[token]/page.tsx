'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type OrderItem = {
  product_name: string
  color: string
  quantity: number
  subtotal: number
}

type RouteOrder = {
  id: string
  order_code: string
  destination: string
  reference: string
  lat: number | null
  lng: number | null
  status: string
  pending_amount: number
  customers?: { name?: string; phone?: string }
  order_items?: OrderItem[]
}

type PickupStore = {
  store_id: string
  store_name: string
  lat: number
  lng: number
  order_count: number
}

export default function RiderRoutePage() {
  const params = useParams()
  const token = params.token as string

  const [orders, setOrders] = useState<RouteOrder[]>([])
  const [pickupStores, setPickupStores] = useState<PickupStore[]>([])
  const [loading, setLoading] = useState(true)
  const [routeData, setRouteData] = useState<any>(null)
  const [delivering, setDelivering] = useState<string | null>(null)
  const [pickedUp, setPickedUp] = useState<Set<string>>(new Set())

  useEffect(() => { loadRoute() }, [])

  const loadRoute = async () => {
    try {
      const supabase = createClient()
      let route: any = null

      const { data: r1 } = await supabase
        .from('routes')
        .select('*')
        .eq('route_token', token)
        .eq('is_active', true)
        .single()

      if (r1) {
        route = r1
      } else {
        const { data: r2 } = await supabase
          .from('global_routes')
          .select('*')
          .eq('route_token', token)
          .eq('is_active', true)
          .single()
        route = r2
      }

      if (!route) { setLoading(false); return }
      setRouteData(route)

      // Load pickup stores if this is a global route
      if (route.pickup_stores && Array.isArray(route.pickup_stores) && route.pickup_stores.length > 0) {
        setPickupStores(route.pickup_stores)
      }

      const orderIds = route.optimized_order?.length > 0 ? route.optimized_order : route.order_ids
      if (!orderIds || orderIds.length === 0) { setLoading(false); return }

      const { data: ordersData } = await supabase
        .from('orders')
        .select('*, order_items(*), customers(name, phone)')
        .in('id', orderIds)

      if (ordersData) {
        const sorted = orderIds
          .map((id: string) => ordersData.find((o: any) => o.id === id))
          .filter(Boolean)
        setOrders(sorted)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const marcarEntregado = async (orderId: string) => {
    setDelivering(orderId)
    try {
      const supabase = createClient()
      await supabase
        .from('orders')
        .update({ status: 'delivered', delivered_at: new Date().toISOString() })
        .eq('id', orderId)
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'delivered' } : o))
    } catch (e) {
      alert('Error al actualizar el pedido')
    } finally {
      setDelivering(null)
    }
  }

  const marcarRecogido = (storeId: string) => {
    setPickedUp(prev => new Set([...prev, storeId]))
  }

  const abrirMaps = (lat: number | null, lng: number | null, nombre: string) => {
    if (lat && lng) {
      window.open('https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lng, '_blank')
    } else {
      window.open('https://www.google.com/maps/search/' + encodeURIComponent(nombre), '_blank')
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Cargando ruta...</p>
      </div>
    </div>
  )

  if (!routeData) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center">
        <p className="text-5xl mb-4">🔒</p>
        <p className="text-gray-800 font-bold text-lg">Ruta no disponible</p>
        <p className="text-gray-500 text-sm mt-1">El link expiró o fue desactivado</p>
      </div>
    </div>
  )

  const pendientes = orders.filter(o => o.status !== 'delivered')
  const entregados = orders.filter(o => o.status === 'delivered')
  const recogidos = pickupStores.filter(s => pickedUp.has(s.store_id))
  const progreso = orders.length > 0 ? Math.round((entregados.length / orders.length) * 100) : 0
  const hasPickups = pickupStores.length > 0
  const allPickedUp = hasPickups && recogidos.length === pickupStores.length

  return (
    <div className="min-h-screen bg-gray-100">

      {/* HEADER STICKY */}
      <div className="bg-blue-600 sticky top-0 z-10 shadow-lg">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-white font-bold text-xl">🛵 Mi Ruta</h1>
              <p className="text-blue-200 text-xs mt-0.5">
                {hasPickups && `${recogidos.length}/${pickupStores.length} recojos · `}
                {pendientes.length} entrega{pendientes.length !== 1 ? 's' : ''} pendiente{pendientes.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="bg-white bg-opacity-20 rounded-2xl px-4 py-2 text-center">
              <p className="text-white font-bold text-2xl leading-none">{pendientes.length}</p>
              <p className="text-blue-200 text-xs mt-0.5">por entregar</p>
            </div>
          </div>
          <div className="bg-blue-500 rounded-full h-2 overflow-hidden">
            <div className="bg-white h-2 rounded-full transition-all duration-500" style={{ width: progreso + '%' }} />
          </div>
          <p className="text-blue-200 text-xs mt-1 text-right">{progreso}% completado</p>
        </div>
      </div>

      <div className="px-3 py-4 space-y-3 pb-8">

        {/* ── FASE 1: RECOJOS ── */}
        {hasPickups && (
          <div>
            {/* Section header */}
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="flex-1 h-px bg-gray-300" />
              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                📦 FASE 1 — RECOJOS EN TIENDAS
              </span>
              <div className="flex-1 h-px bg-gray-300" />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 mb-3">
              <p className="text-xs text-blue-700 font-semibold">
                Recoge los pedidos en estas tiendas antes de ir al central
              </p>
            </div>

            <div className="space-y-3">
              {pickupStores.map((store, index) => {
                const yaRecogido = pickedUp.has(store.store_id)
                return (
                  <div key={store.store_id}
                    className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-opacity ${yaRecogido ? 'border-green-200 opacity-60' : 'border-orange-200'}`}>
                    <div className={`px-4 py-3 flex items-center justify-between ${yaRecogido ? 'bg-green-50' : 'bg-orange-50'}`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-8 h-8 rounded-full text-white text-sm font-bold flex items-center justify-center flex-shrink-0 ${yaRecogido ? 'bg-green-500' : 'bg-orange-500'}`}>
                          {yaRecogido ? '✓' : index + 1}
                        </span>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{store.store_name}</p>
                          <p className="text-xs text-gray-500">{store.order_count} pedido{store.order_count !== 1 ? 's' : ''} para recoger</p>
                        </div>
                      </div>
                      <span className={`text-xs px-3 py-1 rounded-full font-semibold ${yaRecogido ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {yaRecogido ? '✅ Recogido' : '⏳ Pendiente'}
                      </span>
                    </div>

                    {!yaRecogido && (
                      <div className="p-4 flex gap-2">
                        <button
                          onClick={() => abrirMaps(store.lat, store.lng, store.store_name)}
                          className="flex-1 py-4 rounded-xl bg-blue-600 text-white font-bold text-sm touch-manipulation active:bg-blue-700">
                          🗺️ Ir a tienda
                        </button>
                        <button
                          onClick={() => marcarRecogido(store.store_id)}
                          className="flex-1 py-4 rounded-xl bg-orange-500 text-white font-bold text-sm touch-manipulation active:bg-orange-600">
                          📦 Recogido
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {allPickedUp && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center mt-3">
                <p className="text-green-700 font-bold">✅ Todos los recojos completados</p>
                <p className="text-green-600 text-xs mt-0.5">Dirígete al central y luego comienza las entregas</p>
              </div>
            )}

            {/* Divider before deliveries */}
            <div className="flex items-center gap-2 mt-4 mb-1 px-1">
              <div className="flex-1 h-px bg-gray-300" />
              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                🚚 FASE 2 — ENTREGAS A CLIENTES
              </span>
              <div className="flex-1 h-px bg-gray-300" />
            </div>
          </div>
        )}

        {/* ── FASE 2: ENTREGAS ── */}
        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm mt-4">
            <p className="text-5xl mb-3">📭</p>
            <p className="text-gray-600 font-semibold">No hay pedidos en esta ruta</p>
          </div>
        ) : (
          orders.map((order, index) => {
            const entregado = order.status === 'delivered'
            return (
              <div key={order.id}
                className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-opacity ${entregado ? 'border-green-200 opacity-60' : 'border-gray-200'}`}>
                <div className={`px-4 py-3 flex items-center justify-between ${entregado ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-8 h-8 rounded-full text-white text-sm font-bold flex items-center justify-center flex-shrink-0 ${entregado ? 'bg-green-500' : 'bg-blue-600'}`}>
                      {entregado ? '✓' : index + 1}
                    </span>
                    <span className="font-mono font-bold text-gray-900 text-sm">{order.order_code}</span>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-semibold ${entregado ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {entregado ? '✅ Entregado' : '⏳ Pendiente'}
                  </span>
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-base">{order.customers?.name || 'Sin nombre'}</p>
                      {order.customers?.phone && <p className="text-sm text-gray-500 mt-0.5">{order.customers.phone}</p>}
                      {order.destination && <p className="text-sm text-gray-500 mt-1 leading-snug">📍 {order.destination}</p>}
                      {order.reference && <p className="text-xs text-gray-400 mt-0.5">🏠 {order.reference}</p>}
                    </div>
                    {order.customers?.phone && (
                      <a href={`tel:${order.customers.phone}`}
                        className="flex-shrink-0 w-12 h-12 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-center touch-manipulation active:bg-blue-100">
                        <span className="text-2xl">📞</span>
                      </a>
                    )}
                  </div>

                  <div className={`rounded-xl p-3 mb-3 ${entregado ? 'bg-gray-50 border border-gray-200' : 'bg-orange-50 border border-orange-200'}`}>
                    <p className={`text-xs font-medium mb-0.5 ${entregado ? 'text-gray-400' : 'text-orange-600'}`}>💰 Monto por cobrar</p>
                    <p className={`text-2xl font-bold ${entregado ? 'text-gray-400 line-through' : 'text-orange-700'}`}>
                      S/ {Number(order.pending_amount).toFixed(2)}
                    </p>
                  </div>

                  {order.order_items && order.order_items.length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-3 mb-3 space-y-1.5">
                      {order.order_items.map((item, i) => (
                        <div key={i} className="flex justify-between text-xs text-gray-600">
                          <span className="flex-1 min-w-0 truncate pr-2">
                            {item.product_name}{item.color && item.color !== 'Único' ? ` · ${item.color}` : ''} ×{item.quantity}
                          </span>
                          <span className="font-semibold flex-shrink-0">S/ {Number(item.subtotal).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {!entregado && (
                    <div className="flex gap-2">
                      <button onClick={() => abrirMaps(order.lat, order.lng, order.destination)}
                        className="flex-1 py-4 rounded-xl bg-blue-600 text-white font-bold text-sm touch-manipulation active:bg-blue-700">
                        🗺️ Ir
                      </button>
                      <button onClick={() => marcarEntregado(order.id)} disabled={delivering === order.id}
                        className="flex-1 py-4 rounded-xl bg-green-600 text-white font-bold text-sm disabled:opacity-50 touch-manipulation active:bg-green-700">
                        {delivering === order.id ? (
                          <span className="flex items-center justify-center gap-1.5">
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Guardando
                          </span>
                        ) : '✅ Entregado'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}

        {/* RUTA COMPLETADA */}
        {entregados.length === orders.length && orders.length > 0 && (
          <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-8 text-center">
            <p className="text-5xl mb-3">🎉</p>
            <p className="text-green-700 font-bold text-xl">¡Ruta completada!</p>
            <p className="text-green-600 text-sm mt-1">Todos los {orders.length} pedidos fueron entregados</p>
          </div>
        )}
      </div>
    </div>
  )
}