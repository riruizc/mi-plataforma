'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Order = {
  id: string
  order_code: string
  customer_name: string
  customer_phone: string
  status: string
  total_amount: number
  pending_amount: number
  delivery_method: string
  created_at: string
  tracking_token: string
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    loadOrders()
  }, [])

  const loadOrders = async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
  
      if (!user) {
        setLoading(false)
        return
      }
  
      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('email', user.email)
        .single()
  
      if (!store) {
        setLoading(false)
        return
      }
  
      setStoreId(store.id)
  
      const { data } = await supabase
        .from('orders')
        .select(`*, customers(name, phone)`)
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })
  
      const mapped = (data || []).map((o: any) => ({
        ...o,
        customer_name: o.customers?.name || 'Sin nombre',
        customer_phone: o.customers?.phone || '',
      }))
  
      setOrders(mapped)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeliver = async (orderId: string) => {
    const supabase = createClient()
    await supabase
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    loadOrders()
  }

  const handleStatusChange = async (orderId: string, status: string) => {
    const supabase = createClient()
    await supabase.from('orders').update({ status }).eq('id', orderId)
    loadOrders()
  }

  const handlePendingAmountChange = async (orderId: string, amount: number) => {
    const supabase = createClient()
    await supabase.from('orders').update({ pending_amount: amount }).eq('id', orderId)
    loadOrders()
  }

  const getTrackingLink = (token: string) => {
    return `${window.location.origin}/track?token=${token}`
  }

  const statusLabel: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
    in_route: { label: 'En ruta', color: 'bg-blue-100 text-blue-700' },
    delivered: { label: 'Entregado', color: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
  }

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Cargando pedidos...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-gray-500 mt-1">{filtered.length} pedidos</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'in_route', 'delivered'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f === 'all' ? 'Todos' : statusLabel[f]?.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-gray-500">No hay pedidos aún</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((order) => (
            <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="font-bold text-gray-900">{order.order_code}</span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusLabel[order.status]?.color}`}>
                      {statusLabel[order.status]?.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(order.created_at).toLocaleDateString('es-PE')}
                    </span>
                  </div>

                  <p className="text-gray-700 font-medium">{order.customer_name}</p>
                  <p className="text-gray-500 text-sm">📱 {order.customer_phone}</p>

                  <div className="flex gap-4 mt-2 text-sm">
                    <span className="text-gray-600">
                      Total: <strong>S/ {Number(order.total_amount).toFixed(2)}</strong>
                    </span>
                    <span className="text-orange-600">
                      Por cobrar: <strong>S/ {Number(order.pending_amount).toFixed(2)}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {order.customer_phone && (
                    <a
                      href={`https://wa.me/51${order.customer_phone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                    >
                      💬 WhatsApp
                    </a>
                  )}

                  <button
                    onClick={() => {
                      const link = getTrackingLink(order.tracking_token)
                      navigator.clipboard.writeText(link)
                      alert('Link de rastreo copiado')
                    }}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
                  >
                    🔗 Rastreo
                  </button>

                  {order.status !== 'delivered' && (
                    <button
                      onClick={() => handleDeliver(order.id)}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                    >
                      ✅ Entregado
                    </button>
                  )}

                  <select
                    value={order.status}
                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                    className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="pending">Pendiente</option>
                    <option value="in_route">En ruta</option>
                    <option value="delivered">Entregado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>

                  <button
                    onClick={() => setEditingOrder(order)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    ✏️ Editar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Editar pedido {editingOrder.order_code}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto pendiente</label>
                <input
                  type="number"
                  value={editingOrder.pending_amount}
                  onChange={(e) =>
                    setEditingOrder({
                      ...editingOrder,
                      pending_amount: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  value={editingOrder.status}
                  onChange={(e) =>
                    setEditingOrder({
                      ...editingOrder,
                      status: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pending">Pendiente</option>
                  <option value="in_route">En ruta</option>
                  <option value="delivered">Entregado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={async () => {
                  await handlePendingAmountChange(editingOrder.id, editingOrder.pending_amount)
                  await handleStatusChange(editingOrder.id, editingOrder.status)
                  setEditingOrder(null)
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm"
              >
                Guardar
              </button>

              <button
                onClick={() => setEditingOrder(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded-lg text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}