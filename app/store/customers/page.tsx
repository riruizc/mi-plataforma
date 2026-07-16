'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { IconUsers, IconPlus, IconSearch, IconEdit, IconTrash, IconClose, IconStar, IconMessageCircle } from '@/lib/icons'

type Customer = {
  id: string
  name: string
  phone: string
  dni: string
  total_orders: number
  total_spent: number
  last_order_date: string | null
}

const statusLabel: Record<string, { label: string; text: string; bg: string }> = {
  pending: { label: 'Pendiente', text: 'text-db-pending', bg: 'bg-db-pending-bg' },
  in_route: { label: 'En ruta', text: 'text-db-route', bg: 'bg-db-route-bg' },
  delivered: { label: 'Entregado', text: 'text-db-delivered', bg: 'bg-db-delivered-bg' },
  cancelled: { label: 'Cancelado', text: 'text-db-cancelled', bg: 'bg-db-cancelled-bg' },
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [selected, setSelected] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', dni: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadCustomers() }, [])

  const loadCustomers = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: store } = await supabase.from('stores').select('id').eq('email', user.email).single()
      if (!store) return
      setStoreId(store.id)

      const { data: customerData } = await supabase.from('customers').select('*').eq('store_id', store.id).order('updated_at', { ascending: false })
      const { data: stats } = await supabase.rpc('get_customer_stats', { p_store_id: store.id })
      const { data: lastOrders } = await supabase.from('orders').select('customer_id, created_at').eq('store_id', store.id).neq('status', 'cancelled').order('created_at', { ascending: false })

      const lastOrderMap: Record<string, string> = {}
      for (const o of (lastOrders || [])) {
        if (o.customer_id && !lastOrderMap[o.customer_id]) lastOrderMap[o.customer_id] = o.created_at
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
      mapped.sort((a: any, b: any) => b.total_orders - a.total_orders)
      setCustomers(mapped)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const openCustomer = async (customer: Customer) => {
    setSelected(customer)
    setLoadingOrders(true)
    try {
      const supabase = createClient()
      const { data } = await supabase.from('orders').select('*, order_items(*)').eq('customer_id', customer.id).order('created_at', { ascending: false })
      setOrders(data || [])
    } catch (e) { console.error(e) }
    finally { setLoadingOrders(false) }
  }

  const openNew = () => {
    setEditingCustomer(null)
    setForm({ name: '', phone: '', dni: '' })
    setShowForm(true)
  }

  const openEdit = (customer: Customer) => {
    setSelected(null)
    setOrders([])
    setEditingCustomer(customer)
    setForm({ name: customer.name || '', phone: customer.phone || '', dni: customer.dni || '' })
    setShowForm(true)
  }

  const saveCustomer = async () => {
    if (!form.name || !form.phone) { alert('Nombre y celular son obligatorios'); return }
    if (!storeId) return
    setSaving(true)
    try {
      const supabase = createClient()
      if (editingCustomer) {
        await supabase.from('customers').update({ name: form.name, phone: form.phone, dni: form.dni }).eq('id', editingCustomer.id).eq('store_id', storeId)
      } else {
        await supabase.from('customers').insert({ store_id: storeId, name: form.name, phone: form.phone, dni: form.dni })
      }
      setShowForm(false)
      setEditingCustomer(null)
      loadCustomers()
    } catch (e: any) { alert('Error: ' + e.message) }
    finally { setSaving(false) }
  }

  const deleteCustomer = async (customer: Customer) => {
    if (!confirm(`¿Eliminar a "${customer.name}"?\n\nSus pedidos se conservarán pero ya no estarán asociados a este cliente.`)) return
    const supabase = createClient()
    await supabase.from('orders').update({ customer_id: null }).eq('customer_id', customer.id).eq('store_id', storeId)
    await supabase.from('customers').delete().eq('id', customer.id).eq('store_id', storeId)
    setSelected(null)
    setOrders([])
    loadCustomers()
  }

  const filtered = customers.filter(c => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    return c.name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.dni?.includes(q)
  })

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-db-line border-t-db-brand rounded-full animate-spin mx-auto" />
    </div>
  )

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-db-ink">Clientes</h1>
          <p className="text-db-ink-soft text-sm mt-0.5">{customers.length} clientes registrados</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-1.5 bg-db-brand text-white font-semibold px-4 py-2.5 rounded-full text-sm shadow-[0_4px_14px_-4px_rgba(36,81,232,0.55)]">
          <IconPlus className="w-4 h-4" />Agregar
        </button>
      </div>

      <div className="relative mb-4">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-db-ink-soft"><IconSearch className="w-4 h-4" /></span>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, celular o DNI/CE..."
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-sm bg-db-surface border-0 shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] focus:outline-none focus:ring-2 focus:ring-db-brand" />
        {search && <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-db-ink-soft text-lg leading-none">×</button>}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-db-surface rounded-2xl shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] p-3 text-center">
          <p className="text-xl lg:text-2xl font-bold text-db-ink font-data tabular-nums">{customers.length}</p>
          <p className="text-xs text-db-ink-soft mt-0.5">Total</p>
        </div>
        <div className="bg-db-surface rounded-2xl shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] p-3 text-center">
          <p className="text-xl lg:text-2xl font-bold text-db-brand font-data tabular-nums">{customers.filter(c => c.total_orders > 1).length}</p>
          <p className="text-xs text-db-ink-soft mt-0.5">Recurrentes</p>
        </div>
        <div className="bg-db-surface rounded-2xl shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] p-3 text-center">
          <p className="text-xl lg:text-2xl font-bold text-db-delivered font-data tabular-nums">S/ {customers.reduce((s, c) => s + c.total_spent, 0).toFixed(0)}</p>
          <p className="text-xs text-db-ink-soft mt-0.5">Facturado</p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-db-surface rounded-2xl shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] p-12 text-center">
          <IconUsers className="w-8 h-8 mx-auto mb-3 text-db-ink-soft opacity-50" />
          <p className="text-db-ink-soft">{search ? 'No se encontraron clientes' : 'No hay clientes aún'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(customer => (
            <div key={customer.id} className="bg-db-surface rounded-2xl shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] p-4 flex items-center gap-3">
              <button onClick={() => openCustomer(customer)} className="flex items-center gap-3 flex-1 text-left min-w-0">
                <div className="w-10 h-10 rounded-full bg-db-brand-tint flex items-center justify-center flex-shrink-0">
                  <span className="text-db-brand font-bold text-sm">{customer.name?.charAt(0)?.toUpperCase() || '?'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-db-ink text-sm truncate">{customer.name}</p>
                  <p className="text-xs text-db-ink-soft font-data">{customer.phone}{customer.dni ? ` · ${customer.dni}` : ''}</p>
                  {customer.total_orders > 1 && (
                    <span className="inline-flex items-center gap-1 text-[10.5px] bg-db-accent-tint text-db-accent px-2 py-0.5 rounded-full font-semibold mt-1">
                      <IconStar className="w-2.5 h-2.5" />Recurrente
                    </span>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-db-ink font-data tabular-nums">S/ {customer.total_spent.toFixed(2)}</p>
                  <p className="text-xs text-db-ink-soft">{customer.total_orders} {customer.total_orders === 1 ? 'compra' : 'compras'}</p>
                </div>
              </button>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => openEdit(customer)} className="p-2 rounded-full bg-db-brand-tint text-db-brand"><IconEdit className="w-3.5 h-3.5" /></button>
                <button onClick={() => deleteCustomer(customer)} className="p-2 rounded-full bg-db-cancelled-bg text-db-cancelled"><IconTrash className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL AGREGAR / EDITAR */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-db-surface rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-db-line">
              <h2 className="font-bold text-db-ink">{editingCustomer ? 'Editar cliente' : 'Nuevo cliente'}</h2>
              <button onClick={() => { setShowForm(false); setEditingCustomer(null) }} className="text-db-ink-soft"><IconClose className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-db-ink mb-1">Nombre completo *</label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand" placeholder="Juan Pérez" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-db-ink mb-1">Celular *</label>
                <input type="text" inputMode="numeric" value={form.phone}
                  onChange={e => { const v = e.target.value.replace(/\D/g, ''); if (v.length <= 9) setForm(p => ({ ...p, phone: v })) }}
                  className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand font-data" placeholder="999999999" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-db-ink mb-1">DNI / CE <span className="text-db-ink-soft font-normal">(opcional)</span></label>
                <input type="text" inputMode="numeric" value={form.dni}
                  onChange={e => { const v = e.target.value.replace(/\D/g, ''); if (v.length <= 12) setForm(p => ({ ...p, dni: v })) }}
                  className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand font-data" placeholder="12345678" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-db-line">
              <button onClick={() => { setShowForm(false); setEditingCustomer(null) }}
                className="flex-1 py-3 border border-db-line text-db-ink-soft rounded-full text-sm font-semibold">Cancelar</button>
              <button onClick={saveCustomer} disabled={saving}
                className="flex-1 py-3 bg-db-brand text-white rounded-full text-sm font-bold disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-db-surface rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-db-line flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-db-brand-tint flex items-center justify-center">
                  <span className="text-db-brand font-bold text-lg">{selected.name?.charAt(0)?.toUpperCase() || '?'}</span>
                </div>
                <div>
                  <h2 className="font-bold text-db-ink">{selected.name}</h2>
                  <p className="text-xs text-db-ink-soft font-data">{selected.phone}</p>
                  {selected.dni && <p className="text-xs text-db-ink-soft font-data">{selected.dni}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(selected)} className="p-2 rounded-full bg-db-brand-tint text-db-brand"><IconEdit className="w-4 h-4" /></button>
                <button onClick={() => deleteCustomer(selected)} className="p-2 rounded-full bg-db-cancelled-bg text-db-cancelled"><IconTrash className="w-4 h-4" /></button>
                <button onClick={() => { setSelected(null); setOrders([]) }} className="text-db-ink-soft ml-1"><IconClose className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 p-5 pb-3 flex-shrink-0">
              <div className="bg-db-paper rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-db-ink font-data">{selected.total_orders}</p>
                <p className="text-xs text-db-ink-soft">Compras</p>
              </div>
              <div className="bg-db-delivered-bg rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-db-delivered font-data">S/ {selected.total_spent.toFixed(2)}</p>
                <p className="text-xs text-db-ink-soft">Total gastado</p>
              </div>
              <div className="bg-db-brand-tint rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-db-brand font-data">
                  S/ {selected.total_orders > 0 ? (selected.total_spent / selected.total_orders).toFixed(2) : '0.00'}
                </p>
                <p className="text-xs text-db-ink-soft">Ticket prom.</p>
              </div>
            </div>

            {selected.phone && (
              <div className="px-5 pb-3 flex-shrink-0">
                <a href={`https://wa.me/51${selected.phone.replace(/\D/g, '')}`} target="_blank"
                  className="w-full py-2.5 bg-db-delivered text-white rounded-full text-sm font-semibold flex items-center justify-center gap-2">
                  <IconMessageCircle className="w-4 h-4" />Contactar por WhatsApp
                </a>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-5 pt-0">
              <h3 className="font-bold text-db-ink mb-3 text-sm">Historial de pedidos</h3>
              {loadingOrders ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-4 border-db-line border-t-db-brand rounded-full animate-spin" />
                </div>
              ) : orders.length === 0 ? (
                <p className="text-db-ink-soft text-sm text-center py-6">Sin pedidos registrados</p>
              ) : (
                <div className="space-y-2">
                  {orders.map(order => (
                    <div key={order.id} className="bg-db-paper rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-data text-xs font-bold text-db-ink-soft">{order.order_code}</span>
                        <span className={`text-[10.5px] px-2 py-0.5 rounded-full font-semibold ${statusLabel[order.status]?.bg} ${statusLabel[order.status]?.text}`}>
                          {statusLabel[order.status]?.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-db-ink-soft">{new Date(order.created_at).toLocaleDateString('es-PE')}</p>
                        <p className="text-sm font-bold text-db-ink font-data">S/ {Number(order.total_amount).toFixed(2)}</p>
                      </div>
                      {order.order_items?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {order.order_items.map((item: any, i: number) => (
                            <span key={i} className="text-xs bg-db-surface text-db-ink-soft px-2 py-0.5 rounded-full border border-db-line">
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
