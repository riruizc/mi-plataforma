'use client'

import { useEffect, useRef, useState } from 'react'
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
  store_id: string
  customer_id?: string | null
  order_code: string
  customer_name: string
  customer_phone: string
  status: string
  total_amount: number
  pending_amount: number
  delivery_method: string
  created_at: string
  tracking_token: string
  destination?: string | null
  reference?: string | null
  agency_name?: string | null
  lat?: number | null
  lng?: number | null
  order_items?: OrderItem[]
  customers?: { name?: string; phone?: string; dni?: string } | null
  stores?: { name?: string } | null
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [editOrder, setEditOrder] = useState<any>(null)
  const [editData, setEditData] = useState<any>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editAgencies, setEditAgencies] = useState<any[]>([])
  const [editSuggestions, setEditSuggestions] = useState<any[]>([])
  const editMapRef = useRef<any>(null)
  const editMapInstanceRef = useRef<any>(null)
  const editMarkerRef = useRef<any>(null)
  const editSearchTimeout = useRef<any>(null)

  useEffect(() => { loadOrders() }, [])

  useEffect(() => {
    if (editOrder && editData?.delivery_method === 'motorizado') {
      const t = setTimeout(() => { initEditMap() }, 100)
      return () => clearTimeout(t)
    }
  }, [editOrder, editData?.delivery_method])

  useEffect(() => {
    const syncMarker = async () => {
      if (!editMapInstanceRef.current || !editData?.lat || !editData?.lng) return
      const L = await import('leaflet')
      const lat = parseFloat(editData.lat)
      const lng = parseFloat(editData.lng)
      if (Number.isNaN(lat) || Number.isNaN(lng)) return
      editMapInstanceRef.current.setView([lat, lng], 16)
      const icon = L.divIcon({ className: '', html: '<div style="background:#ef4444;border-radius:50%;width:20px;height:20px;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>', iconSize: [20, 20], iconAnchor: [10, 10] })
      if (editMarkerRef.current) editMarkerRef.current.remove()
      editMarkerRef.current = L.marker([lat, lng], { icon }).addTo(editMapInstanceRef.current)
    }
    syncMarker()
  }, [editData?.lat, editData?.lng])

  const loadOrders = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: store } = await supabase.from('stores').select('id').eq('email', user.email).single()
      if (!store) { setLoading(false); return }
      setStoreId(store.id)
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*), customers(name, phone, dni), stores(name)')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })
      setOrders((data || []).map((o: any) => ({ ...o, customer_name: o.customers?.name || 'Sin nombre', customer_phone: o.customers?.phone || '' })))
    } catch (error) { console.error(error) }
    finally { setLoading(false) }
  }

  const handleDeliver = async (orderId: string) => {
    const supabase = createClient()
    await supabase.from('orders').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', orderId)
    loadOrders()
  }

  const handleStatusChange = async (orderId: string, status: string) => {
    const supabase = createClient()
    await supabase.from('orders').update({ status }).eq('id', orderId)
    loadOrders()
  }

  const enviarComprobante = (order: any) => {
    const doc = new jsPDF()
    const store_name = order.stores?.name || 'Tienda'
    const fecha = new Date(order.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    doc.setFontSize(18); doc.setFont('helvetica', 'bold')
    doc.text(store_name, 105, 20, { align: 'center' })
    doc.setFontSize(11); doc.setFont('helvetica', 'normal')
    doc.text('NOTA DE VENTA', 105, 30, { align: 'center' })
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
    const items = order.order_items || []
    items.forEach((item: any) => {
      doc.text(String(item.product_name).substring(0, 30), 20, y)
      doc.text(String(item.color), 100, y); doc.text(String(item.quantity), 135, y)
      doc.text('S/ ' + Number(item.unit_price).toFixed(2), 150, y)
      doc.text('S/ ' + Number(item.subtotal).toFixed(2), 175, y)
      y += 8
    })
    doc.line(20, y, 190, y); y += 8; doc.setFont('helvetica', 'bold')
    doc.text('TOTAL: S/ ' + Number(order.total_amount).toFixed(2), 175, y, { align: 'right' })
    y += 12; doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    doc.text('Entrega: ' + (order.delivery_method === 'motorizado' ? 'Motorizado' : 'Agencia'), 20, y)
    if (order.destination) { y += 7; doc.text('Direccion: ' + order.destination, 20, y) }
    if (order.reference) { y += 7; doc.text('Referencia: ' + order.reference, 20, y) }
    doc.save('comprobante-' + order.order_code + '.pdf')

    const nombre = order.customers?.name || 'Cliente'
    const phone = (order.customers?.phone || '').replace(/\D/g, '')
    if (!phone) { alert('Este pedido no tiene número de celular registrado'); return }
    const lineas = items.map((item: any) => '• ' + item.product_name + ' ' + item.color + ' x' + item.quantity + ' - S/ ' + Number(item.subtotal).toFixed(2)).join('%0A')
    const trackingLink = window.location.origin + '/track?code=' + order.order_code
    const mensaje = '✅ *Pedido confirmado - ' + order.order_code + '*%0A%0A' + 'Hola ' + nombre + '! Aquí está tu comprobante:%0A%0A' + 'Productos:%0A' + lineas + '%0A%0A' + 'Total: *S/ ' + Number(order.total_amount).toFixed(2) + '*%0A' + 'Entrega: ' + (order.delivery_method === 'motorizado' ? 'Motorizado 🛵' : 'Agencia 📦') + (order.destination ? '%0ADirección: ' + order.destination : '') + '%0A%0A🔗 *Rastrea tu pedido:*%0A' + trackingLink + '%0A%0A¡Gracias por tu compra! 🙌'
    window.open('https://wa.me/51' + phone + '?text=' + mensaje, '_blank')
  }

  const openEdit = async (order: any) => {
    setEditOrder(order)
    setEditData({ name: order.customers?.name || '', phone: order.customers?.phone || '', dni: order.customers?.dni || '', delivery_method: order.delivery_method || 'motorizado', destination: order.destination || '', reference: order.reference || '', lat: order.lat || '', lng: order.lng || '', agency_name: order.agency_name || '', pending_amount: order.pending_amount || 0 })
    setEditSuggestions([])
    const supabase = createClient()
    const { data } = await supabase.from('delivery_agencies').select('*').eq('store_id', order.store_id).eq('is_active', true)
    setEditAgencies(data || [])
  }

  const closeEdit = () => {
    if (editMapInstanceRef.current) editMapInstanceRef.current.remove()
    setEditOrder(null); setEditData(null); setEditSuggestions([])
    editMapInstanceRef.current = null; editMarkerRef.current = null
    clearTimeout(editSearchTimeout.current)
  }

  const initEditMap = async () => {
    if (typeof window === 'undefined' || !editMapRef.current || editMapInstanceRef.current) return
    const L = await import('leaflet')
    await import('leaflet/dist/leaflet.css' as any)
    const lat = parseFloat(editData?.lat) || -8.1116
    const lng = parseFloat(editData?.lng) || -79.0286
    if ((editMapRef.current as any)._leaflet_id) (editMapRef.current as any)._leaflet_id = null
    const map = L.map(editMapRef.current).setView([lat, lng], 15)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map)
    if (editData?.lat && editData?.lng) {
      const icon = L.divIcon({ className: '', html: '<div style="background:#ef4444;border-radius:50%;width:20px;height:20px;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>', iconSize: [20, 20], iconAnchor: [10, 10] })
      editMarkerRef.current = L.marker([lat, lng], { icon }).addTo(map)
    }
    map.on('click', (e: any) => {
      const { lat, lng } = e.latlng
      setEditData((prev: any) => ({ ...prev, lat: lat.toString(), lng: lng.toString() }))
      const icon = L.divIcon({ className: '', html: '<div style="background:#ef4444;border-radius:50%;width:20px;height:20px;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>', iconSize: [20, 20], iconAnchor: [10, 10] })
      if (editMarkerRef.current) editMarkerRef.current.remove()
      editMarkerRef.current = L.marker([lat, lng], { icon }).addTo(map)
    })
    editMapInstanceRef.current = map
  }

  const handleEditAddress = (value: string) => {
    setEditData((prev: any) => ({ ...prev, destination: value }))
    clearTimeout(editSearchTimeout.current)
    if (value.length < 6) { setEditSuggestions([]); return }
    editSearchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/geocode?q=' + encodeURIComponent(value))
        const data = await res.json()
        setEditSuggestions(data || [])
      } catch { setEditSuggestions([]) }
    }, 500)
  }

  const selectEditSuggestion = async (s: any) => {
    setEditData((prev: any) => ({ ...prev, destination: s.display_name, lat: s.lat, lng: s.lng }))
    setEditSuggestions([])
    if (editMapInstanceRef.current && s.lat && s.lng) {
      const L = await import('leaflet')
      editMapInstanceRef.current.setView([parseFloat(s.lat), parseFloat(s.lng)], 16)
      const icon = L.divIcon({ className: '', html: '<div style="background:#ef4444;border-radius:50%;width:20px;height:20px;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>', iconSize: [20, 20], iconAnchor: [10, 10] })
      if (editMarkerRef.current) editMarkerRef.current.remove()
      editMarkerRef.current = L.marker([parseFloat(s.lat), parseFloat(s.lng)], { icon }).addTo(editMapInstanceRef.current)
    }
  }

  const saveEdit = async () => {
    if (!editOrder || !editData) return
    setEditSaving(true)
    try {
      const supabase = createClient()
      if (editOrder.customer_id) {
        await supabase.from('customers').update({ name: editData.name, phone: editData.phone, dni: editData.dni }).eq('id', editOrder.customer_id)
      }
      await supabase.from('orders').update({ delivery_method: editData.delivery_method, destination: editData.destination, reference: editData.reference, lat: editData.lat ? parseFloat(editData.lat) : null, lng: editData.lng ? parseFloat(editData.lng) : null, agency_name: editData.agency_name || null, pending_amount: parseFloat(editData.pending_amount) || 0 }).eq('id', editOrder.id)
      await loadOrders()
      closeEdit()
    } catch (e) { alert('Error al guardar los cambios') }
    finally { setEditSaving(false) }
  }

  const statusLabel: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
    in_route: { label: 'En ruta', color: 'bg-blue-100 text-blue-700' },
    delivered: { label: 'Entregado', color: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
        <p className="text-gray-500 text-sm">Cargando pedidos...</p>
      </div>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-gray-500 text-sm mt-0.5">{filtered.length} pedidos</p>
        </div>
        {/* Filtros */}
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'pending', 'in_route', 'delivered'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs lg:text-sm font-medium transition-colors touch-manipulation ${filter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
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
        <div className="space-y-3">
          {filtered.map(order => (
            <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              {/* Fila superior: código + estado + fecha */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-bold text-gray-900 text-sm">{order.order_code}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusLabel[order.status]?.color}`}>
                  {statusLabel[order.status]?.label}
                </span>
                <span className="text-xs text-gray-400 ml-auto">
                  {new Date(order.created_at).toLocaleDateString('es-PE')}
                </span>
              </div>

              {/* Cliente */}
              <p className="font-semibold text-gray-800 text-sm">{order.customer_name}</p>
              <p className="text-gray-500 text-xs">📱 {order.customer_phone}</p>

              {/* Productos */}
              {order.order_items && order.order_items.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {order.order_items.map((item: any, i: number) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {item.product_name} {item.color} x{item.quantity}
                    </span>
                  ))}
                </div>
              )}

              {/* Método entrega */}
              <div className="mt-1.5">
                {order.delivery_method === 'motorizado' ? (
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">🛵 Motorizado</span>
                ) : (
                  <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                    📦 {order.agency_name || 'Agencia'} — {order.destination || 'Sin destino'}
                  </span>
                )}
              </div>

              {/* Montos */}
              <div className="flex gap-4 mt-2 text-xs">
                <span className="text-gray-600">Total: <strong>S/ {Number(order.total_amount).toFixed(2)}</strong></span>
                <span className="text-orange-600">Por cobrar: <strong>S/ {Number(order.pending_amount).toFixed(2)}</strong></span>
              </div>

              {/* Botones — en grid 2 columnas en móvil */}
              <div className="grid grid-cols-2 sm:flex gap-2 mt-3">
                <button onClick={() => enviarComprobante(order)}
                  className="px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-medium touch-manipulation active:bg-green-100">
                  📄💬 Comprobante
                </button>
                <button onClick={() => { const link = window.location.origin + '/track?code=' + order.order_code; navigator.clipboard.writeText(link); alert('Link copiado') }}
                  className="px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-medium touch-manipulation active:bg-purple-100">
                  🔗 Rastreo
                </button>
                {order.status !== 'delivered' && (
                  <button onClick={() => handleDeliver(order.id)}
                    className="px-3 py-2 rounded-lg text-xs font-medium bg-green-600 text-white touch-manipulation active:bg-green-700">
                    ✅ Entregado
                  </button>
                )}
                <select value={order.status} onChange={e => handleStatusChange(order.id, e.target.value)}
                  className="px-2 py-2 rounded-lg text-xs border border-gray-200 focus:outline-none bg-white">
                  <option value="pending">Pendiente</option>
                  <option value="in_route">En ruta</option>
                  <option value="delivered">Entregado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
                <button onClick={() => openEdit(order)}
                  className="px-3 py-2 bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-xs font-medium touch-manipulation active:bg-gray-100">
                  ✏️ Editar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal editar */}
      {editOrder && editData && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
              <div>
                <h2 className="font-bold text-gray-900">Editar pedido</h2>
                <p className="text-xs text-gray-500 font-mono">{editOrder.order_code}</p>
              </div>
              <button onClick={closeEdit} className="text-gray-400 hover:text-gray-600 text-2xl font-bold w-8 h-8 flex items-center justify-center">×</button>
            </div>

            <div className="p-4 sm:p-5 space-y-5">
              {/* Datos cliente */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Datos del cliente</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo</label>
                    <input type="text" value={editData.name} onChange={e => setEditData((p: any) => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">DNI</label>
                      <input type="text" value={editData.dni} onChange={e => setEditData((p: any) => ({ ...p, dni: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Celular</label>
                      <input type="tel" value={editData.phone} onChange={e => setEditData((p: any) => ({ ...p, phone: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Entrega */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Entrega</h3>
                <div className="flex gap-2 mb-3">
                  <button onClick={() => setEditData((p: any) => ({ ...p, delivery_method: 'motorizado', agency_name: '' }))}
                    className={'flex-1 py-2.5 rounded-xl text-sm font-medium border ' + (editData.delivery_method === 'motorizado' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200')}>
                    🛵 Motorizado
                  </button>
                  {editAgencies.length > 0 && (
                    <button onClick={() => setEditData((p: any) => ({ ...p, delivery_method: 'agencia', lat: '', lng: '' }))}
                      className={'flex-1 py-2.5 rounded-xl text-sm font-medium border ' + (editData.delivery_method === 'agencia' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200')}>
                      📦 Agencia
                    </button>
                  )}
                </div>

                {editData.delivery_method === 'motorizado' && (
                  <div className="space-y-3">
                    <div className="relative">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Dirección</label>
                      <input type="text" value={editData.destination} onChange={e => handleEditAddress(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Buscar dirección..." />
                      {editSuggestions.length > 0 && (
                        <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-40 overflow-y-auto">
                          {editSuggestions.map((s: any, i: number) => (
                            <button key={i} onClick={() => selectEditSuggestion(s)} className="w-full text-left px-3 py-2.5 text-xs text-gray-700 hover:bg-blue-50 border-b border-gray-50 last:border-0 touch-manipulation">{s.display_name}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Referencia</label>
                      <input type="text" value={editData.reference} onChange={e => setEditData((p: any) => ({ ...p, reference: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Mapa</label>
                      <div ref={el => { editMapRef.current = el }} className="w-full rounded-xl overflow-hidden border border-gray-200" style={{ height: '180px' }} />
                      {editData.lat && editData.lng && <p className="text-xs text-green-600 mt-1">📍 Ubicación marcada</p>}
                    </div>
                  </div>
                )}

                {editData.delivery_method === 'agencia' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Agencia</label>
                      <select value={editData.agency_name} onChange={e => setEditData((p: any) => ({ ...p, agency_name: e.target.value, destination: '' }))}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Selecciona agencia</option>
                        {editAgencies.map((a: any) => <option key={a.id} value={a.agency_name}>{a.agency_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Destino</label>
                      {editAgencies.find((a: any) => a.agency_name === editData.agency_name)?.destinations?.length > 0 ? (
                        <select value={editData.destination} onChange={e => setEditData((p: any) => ({ ...p, destination: e.target.value }))}
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="">Selecciona destino</option>
                          {editAgencies.find((a: any) => a.agency_name === editData.agency_name)?.destinations.map((d: string, i: number) => <option key={i} value={d}>{d}</option>)}
                        </select>
                      ) : (
                        <input type="text" value={editData.destination} onChange={e => setEditData((p: any) => ({ ...p, destination: e.target.value }))}
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Monto pendiente (S/)</label>
                <input type="number" step="0.01" value={editData.pending_amount} onChange={e => setEditData((p: any) => ({ ...p, pending_amount: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="flex gap-3 p-4 sm:p-5 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={closeEdit} className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium touch-manipulation">Cancelar</button>
              <button onClick={saveEdit} disabled={editSaving} className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 touch-manipulation">
                {editSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}