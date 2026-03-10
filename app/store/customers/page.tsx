'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Customer = {
  id: string
  name: string
  phone: string
  dni: string
  total_orders: number
  total_spent: number
  last_order_date: string | null
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [storeId, setStoreId] = useState<string | null>(null)

  useEffect(() => { loadCustomers() }, [])

  const loadCustomers = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: store } = await supabase.from('stores').select('id').eq('email', user.email).single()
      if (!store) return
      setStoreId(store.id)

      // Traer clientes de la tienda
      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('store_id', store.id)
        .order('updated_at', { ascending: false })

      // Traer estadísticas
      const { data: stats } = await supabase.rpc('get_customer_stats', { p_store_id: store.id })

      // Traer última fecha de pedido por cliente
      const { data: lastOrders } = await supabase
        .from('orders')
        .select('customer_id, created_at')
        .eq('store_id', store.id)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })

      const lastOrderMap: Record<string, string> = {}
      for (const o of (lastOrders || [])) {
        if (o.customer_id && !lastOrderMap[o.customer_id]) {
          lastOrderMap[o.customer_id] = o.created_at
        }
      }

      const statsMap: Record<string, { total_orders: number; total_spent: number }> = {}
      for (const s of (stats || [])) {
        statsMap[s.customer_id] = { total_orders: Number(s.total_orders), total_spent: Number(s.total_spent) }
      }

      const mapped = (customerData || []).map((c: any) => ({
        ...c,
        total_orders: statsMap[c.id]?.total_orders || 0,
        total_spent: statsMap[c.id]?.total_spent || 0,
        last_order_date: lastOrderMap[c.id] || null,
      }))

      // Ordenar por total de pedidos descendente
      mapped.sort((a: any, b: any) => b.total_orders - a.total_orders)

      setCustomers(mapped)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const openCustomer = async (customer: Customer) => {
    setSelected(customer)
    setLoadingOrders(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
      setOrders(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingOrders(false)
    }
  }

  const filtered = customers.filter(c => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    return (
      c.name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.dni?.includes(q)
    )
  })

  const statusLabel: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
    in_route: { label: 'En ruta', color: 'bg-blue-100 text-blue-700' },
    delivered: { label: 'Entregado', color: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto" />
    </div>
  )

  return (
    <div>
      {/* HEADER */}
      <div className="mb-5">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Clientes</h1>
        <p className="text-gray-500 text-sm mt-0.5">{customers.length} clientes registrados</p>
      </div>

      {/* BUSCADOR */}
      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, celular o DNI/CE..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">×</button>
        )}
      </div>

      {/* STATS RÁPIDAS */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total clientes</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{customers.filter(c => c.total_orders > 1).length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Recurrentes</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-2xl font-bold text-green-600">
            S/ {customers.reduce((s, c) => s + c.total_spent, 0).toFixed(0)}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Total facturado</p>
        </div>
      </div>

      {/* LISTA */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-gray-500">{search ? 'No se encontraron clientes' : 'No hay clientes aún'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(customer => (
            <button key={customer.id} onClick={() => openCustomer(customer)}
              className="w-full bg-white rounded-xl border border-gray-100 p-4 text-left hover:border-blue-200 hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-bold text-sm">
                      {customer.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{customer.name}</p>
                    <p className="text-xs text-gray-400">📱 {customer.phone} {customer.dni ? `· DNI: ${customer.dni}` : ''}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-sm font-bold text-gray-900">S/ {customer.total_spent.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">
                    {customer.total_orders} {customer.total_orders === 1 ? 'compra' : 'compras'}
                  </p>
                </div>
              </div>
              {customer.total_orders > 1 && (
                <div className="mt-2">
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                    ⭐ Cliente recurrente
                  </span>
                </div>
              )}
              {customer.last_order_date && (
                <p className="text-xs text-gray-400 mt-1">
                  Último pedido: {new Date(customer.last_order_date).toLocaleDateString('es-PE')}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* MODAL DETALLE CLIENTE */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-lg">
                    {selected.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">{selected.name}</h2>
                  <p className="text-xs text-gray-400">📱 {selected.phone}</p>
                  {selected.dni && <p className="text-xs text-gray-400">🪪 {selected.dni}</p>}
                </div>
              </div>
              <button onClick={() => { setSelected(null); setOrders([]) }} className="text-gray-400 text-2xl font-bold">×</button>
            </div>

            {/* Stats del cliente */}
            <div className="grid grid-cols-3 gap-3 p-5 pb-0 flex-shrink-0">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-gray-900">{selected.total_orders}</p>
                <p className="text-xs text-gray-500">Compras</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-green-600">S/ {selected.total_spent.toFixed(2)}</p>
                <p className="text-xs text-gray-500">Total gastado</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-blue-600">
                  S/ {selected.total_orders > 0 ? (selected.total_spent / selected.total_orders).toFixed(2) : '0.00'}
                </p>
                <p className="text-xs text-gray-500">Ticket prom.</p>
              </div>
            </div>

            {/* Botón WhatsApp */}
            {selected.phone && (
              <div className="px-5 pt-3 flex-shrink-0">
                <a href={`https://wa.me/51${selected.phone.replace(/\D/g, '')}`} target="_blank"
                  className="w-full py-2.5 bg-green-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                  💬 Contactar por WhatsApp
                </a>
              </div>
            )}

            {/* Historial */}
            <div className="flex-1 overflow-y-auto p-5">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">Historial de pedidos</h3>
              {loadingOrders ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : orders.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">Sin pedidos registrados</p>
              ) : (
                <div className="space-y-2">
                  {orders.map(order => (
                    <div key={order.id} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-bold text-gray-700">{order.order_code}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusLabel[order.status]?.color}`}>
                          {statusLabel[order.status]?.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-400">
                          {new Date(order.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </p>
                        <p className="text-sm font-bold text-gray-900">S/ {Number(order.total_amount).toFixed(2)}</p>
                      </div>
                      {order.order_items && order.order_items.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {order.order_items.map((item: any, i: number) => (
                            <span key={i} className="text-xs bg-white text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                              {item.product_name} x{item.quantity}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}