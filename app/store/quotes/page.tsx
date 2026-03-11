'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import jsPDF from 'jspdf'

type QuoteItem = { product_id: string; variant_id: string | null; product_name: string; variant_name: string | null; quantity: number; unit_price: number; subtotal: number }
type Quote = {
  id: string
  customer_name: string
  customer_phone: string
  customer_dni: string
  destination: string
  reference: string
  delivery_method: string
  agency_name: string
  items: QuoteItem[]
  total_amount: number
  status: 'active' | 'converted' | 'expired'
  expires_at: string
  created_at: string
}
type Product = { id: string; name: string; sale_price: number; variants: { id: string; color: string; stock: number }[] }

export default function QuotesPage() {
  const [storeId, setStoreId] = useState<string | null>(null)
  const [storePrefix, setStorePrefix] = useState('')
  const [storeName, setStoreName] = useState('')
  const [loading, setLoading] = useState(true)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [agencies, setAgencies] = useState<any[]>([])

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ customer_name: '', customer_phone: '', customer_dni: '', destination: '', reference: '', delivery_method: 'motorizado', agency_name: '' })
  const [selectedItems, setSelectedItems] = useState<QuoteItem[]>([])
  const [searchProduct, setSearchProduct] = useState('')
  const [variantModal, setVariantModal] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [converting, setConverting] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  // Marcar expiradas automáticamente
  const checkExpired = async (storeId: string) => {
    const supabase = createClient()
    await supabase.from('quotes').update({ status: 'expired' })
      .eq('store_id', storeId).eq('status', 'active').lt('expires_at', new Date().toISOString())
  }

  const loadData = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: store } = await supabase.from('stores').select('id, name, store_prefix').eq('email', user.email).single()
      if (!store) return
      setStoreId(store.id)
      setStoreName(store.name)
      setStorePrefix(store.store_prefix)

      await checkExpired(store.id)

      const { data: quotesData } = await supabase.from('quotes').select('*').eq('store_id', store.id).order('created_at', { ascending: false })
      setQuotes(quotesData || [])

      const { data: prods } = await supabase.from('products').select('id, name, sale_price, product_variants(id, color, stock)').eq('store_id', store.id).eq('is_active', true).order('name')
      setProducts((prods || []).map((p: any) => ({ ...p, variants: p.product_variants || [] })))

      const { data: agencyData } = await supabase.from('delivery_agencies').select('*').eq('store_id', store.id).eq('is_active', true)
      setAgencies(agencyData || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const openNew = () => {
    setForm({ customer_name: '', customer_phone: '', customer_dni: '', destination: '', reference: '', delivery_method: 'motorizado', agency_name: '' })
    setSelectedItems([])
    setSearchProduct('')
    setShowForm(true)
  }

  const handleAddProduct = (product: Product) => {
    if (product.variants.length > 0) { setVariantModal(product) }
    else { addItem(product.id, null, product.name, null, product.sale_price) }
  }

  const addItem = (productId: string, variantId: string | null, productName: string, variantName: string | null, price: number) => {
    const existing = selectedItems.find(i => i.product_id === productId && i.variant_id === variantId)
    if (existing) {
      setSelectedItems(selectedItems.map(i => i.product_id === productId && i.variant_id === variantId
        ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unit_price } : i))
    } else {
      setSelectedItems([...selectedItems, { product_id: productId, variant_id: variantId, product_name: productName, variant_name: variantName, quantity: 1, unit_price: price, subtotal: price }])
    }
    setVariantModal(null)
  }

  const removeItem = (productId: string, variantId: string | null) => setSelectedItems(selectedItems.filter(i => !(i.product_id === productId && i.variant_id === variantId)))

  const updateQty = (productId: string, variantId: string | null, qty: number) => {
    if (qty <= 0) { removeItem(productId, variantId); return }
    setSelectedItems(selectedItems.map(i => i.product_id === productId && i.variant_id === variantId ? { ...i, quantity: qty, subtotal: qty * i.unit_price } : i))
  }

  const total = selectedItems.reduce((s, i) => s + i.subtotal, 0)

  const saveQuote = async () => {
    if (!form.customer_name) { alert('El nombre del cliente es obligatorio'); return }
    if (selectedItems.length === 0) { alert('Agrega al menos un producto'); return }
    if (!storeId) return
    setSaving(true)
    try {
      const supabase = createClient()
      const expires = new Date(); expires.setDate(expires.getDate() + 7)
      await supabase.from('quotes').insert({
        store_id: storeId,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_dni: form.customer_dni,
        destination: form.destination,
        reference: form.reference,
        delivery_method: form.delivery_method,
        agency_name: form.delivery_method === 'agencia' ? form.agency_name : null,
        items: selectedItems,
        total_amount: total,
        expires_at: expires.toISOString(),
        status: 'active',
      })
      setShowForm(false)
      loadData()
    } catch (e: any) { alert('Error: ' + e.message) }
    finally { setSaving(false) }
  }

  const generatePDF = (quote: Quote) => {
    const doc = new jsPDF()
    const fecha = new Date(quote.created_at).toLocaleDateString('es-PE')
    const vence = new Date(quote.expires_at).toLocaleDateString('es-PE')

    doc.setFontSize(18); doc.setFont('helvetica', 'bold')
    doc.text(storeName, 105, 20, { align: 'center' })
    doc.setFontSize(12); doc.setFont('helvetica', 'normal')
    doc.text('COTIZACIÓN', 105, 30, { align: 'center' })
    doc.setFontSize(10)
    doc.text('Fecha: ' + fecha, 20, 44)
    doc.text('Vence: ' + vence, 140, 44)
    doc.text('Cliente: ' + quote.customer_name, 20, 52)
    if (quote.customer_phone) doc.text('Celular: ' + quote.customer_phone, 20, 59)
    if (quote.customer_dni) doc.text('DNI/CE: ' + quote.customer_dni, 20, 66)
    doc.setLineWidth(0.5); doc.line(20, 72, 190, 72)
    doc.setFont('helvetica', 'bold')
    doc.text('Producto', 20, 79); doc.text('Var.', 100, 79); doc.text('Cant.', 130, 79); doc.text('P. Unit.', 150, 79); doc.text('Subtotal', 175, 79)
    doc.line(20, 82, 190, 82); doc.setFont('helvetica', 'normal')
    let y = 90
    quote.items.forEach(item => {
      doc.text(String(item.product_name).substring(0, 28), 20, y)
      doc.text(String(item.variant_name || '-'), 100, y)
      doc.text(String(item.quantity), 130, y)
      doc.text('S/ ' + Number(item.unit_price).toFixed(2), 148, y)
      doc.text('S/ ' + Number(item.subtotal).toFixed(2), 173, y)
      y += 8
    })
    doc.line(20, y, 190, y); y += 8
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL: S/ ' + Number(quote.total_amount).toFixed(2), 173, y, { align: 'right' })
    y += 12; doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    doc.text('Entrega: ' + (quote.delivery_method === 'motorizado' ? 'Motorizado' : 'Agencia - ' + (quote.agency_name || '')), 20, y)
    if (quote.destination) { y += 7; doc.text('Dirección: ' + quote.destination, 20, y) }
    y += 10; doc.setFontSize(8)
    doc.text('Esta cotización es válida hasta el ' + vence, 105, y, { align: 'center' })
    doc.save('cotizacion-' + quote.customer_name.replace(/\s/g, '-') + '.pdf')
  }

  const convertToOrder = async (quote: Quote) => {
    if (!confirm(`¿Convertir la cotización de "${quote.customer_name}" a pedido? Se descontará el stock de los productos.`)) return
    if (!storeId) return
    setConverting(quote.id)
    try {
      const supabase = createClient()

      // Buscar o crear cliente
      let customerId = null
      if (quote.customer_phone) {
        const { data: existing } = await supabase.from('customers').select('id').eq('store_id', storeId).eq('phone', quote.customer_phone).single()
        customerId = existing?.id
        if (!customerId) {
          const { data: newC } = await supabase.from('customers').insert({ store_id: storeId, name: quote.customer_name, phone: quote.customer_phone, dni: quote.customer_dni }).select('id').single()
          customerId = newC?.id
        }
      }

      // Crear código de pedido
      const year = new Date().getFullYear()
      const { data: counterData } = await supabase.rpc('increment_order_counter', { p_store_id: storeId })
      const code = storePrefix + '-' + year + '-' + String(counterData).padStart(3, '0')
      const token = Math.random().toString(36).substring(2, 15)

      // Crear pedido
      const { data: newOrder } = await supabase.from('orders').insert({
        store_id: storeId,
        customer_id: customerId,
        order_code: code,
        delivery_method: quote.delivery_method,
        agency_name: quote.agency_name || null,
        destination: quote.destination || null,
        reference: quote.reference || null,
        total_amount: quote.total_amount,
        pending_amount: quote.total_amount,
        status: 'pending',
        tracking_token: token,
      }).select('id').single()

      if (newOrder) {
        // Insertar items
        await supabase.from('order_items').insert(
          quote.items.map(i => ({
            order_id: newOrder.id,
            product_id: i.product_id,
            variant_id: i.variant_id || null,
            product_name: i.product_name,
            color: i.variant_name || '',
            quantity: i.quantity,
            unit_price: i.unit_price,
            subtotal: i.subtotal,
          }))
        )
        // Descontar stock
        for (const item of quote.items) {
          if (item.variant_id) {
            await supabase.rpc('decrement_stock', { p_variant_id: item.variant_id, p_qty: item.quantity })
          }
        }
      }

      // Marcar cotización como convertida
      await supabase.from('quotes').update({ status: 'converted' }).eq('id', quote.id)
      loadData()
      alert(`✅ Pedido creado: ${code}`)
    } catch (e: any) { alert('Error: ' + e.message) }
    finally { setConverting(null) }
  }

  const deleteQuote = async (quote: Quote) => {
    if (!confirm(`¿Eliminar la cotización de "${quote.customer_name}"?`)) return
    const supabase = createClient()
    await supabase.from('quotes').delete().eq('id', quote.id)
    loadData()
  }

  const statusStyle: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    converted: 'bg-blue-100 text-blue-700',
    expired: 'bg-red-100 text-red-700',
  }
  const statusText: Record<string, string> = { active: 'Activa', converted: 'Convertida', expired: 'Expirada' }

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchProduct.toLowerCase()))

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto" />
    </div>
  )

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Cotizaciones</h1>
          <p className="text-gray-500 text-sm mt-0.5">{quotes.length} cotizaciones</p>
        </div>
        <button onClick={openNew} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-sm">
          + Nueva
        </button>
      </div>

      {quotes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">📄</p>
          <p className="text-gray-500 font-medium">No hay cotizaciones aún</p>
          <p className="text-gray-400 text-sm mt-1">Crea una cotización y conviértela a pedido cuando el cliente confirme</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map(quote => {
            const diasRestantes = Math.ceil((new Date(quote.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            return (
              <div key={quote.id} className={`bg-white rounded-xl border p-4 lg:p-5 ${quote.status === 'expired' ? 'opacity-70 border-red-100' : quote.status === 'converted' ? 'border-blue-100' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900">{quote.customer_name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle[quote.status]}`}>
                        {statusText[quote.status]}
                      </span>
                    </div>
                    {quote.customer_phone && <p className="text-xs text-gray-400 mt-0.5">📱 {quote.customer_phone}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-gray-900">S/ {Number(quote.total_amount).toFixed(2)}</p>
                    {quote.status === 'active' && (
                      <p className={`text-xs font-medium ${diasRestantes <= 1 ? 'text-red-500' : diasRestantes <= 3 ? 'text-orange-500' : 'text-gray-400'}`}>
                        {diasRestantes > 0 ? `Vence en ${diasRestantes}d` : 'Vence hoy'}
                      </p>
                    )}
                    {quote.status === 'expired' && <p className="text-xs text-red-400">Expirada</p>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {quote.items.map((item, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {item.product_name}{item.variant_name ? ` (${item.variant_name})` : ''} x{item.quantity}
                    </span>
                  ))}
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => generatePDF(quote)}
                    className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium">
                    📄 Descargar PDF
                  </button>
                  {quote.status === 'active' && (
                    <button onClick={() => convertToOrder(quote)} disabled={converting === quote.id}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50">
                      {converting === quote.id ? 'Convirtiendo...' : '✅ Convertir a pedido'}
                    </button>
                  )}
                  <button onClick={() => deleteQuote(quote)}
                    className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium">Eliminar</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL NUEVA COTIZACIÓN */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
              <h2 className="font-bold text-gray-900">Nueva cotización</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 text-2xl font-bold">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Datos del cliente */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Datos del cliente</h3>
                <input type="text" value={form.customer_name} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nombre completo *" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" inputMode="numeric" value={form.customer_phone}
                    onChange={e => { const v = e.target.value.replace(/\D/g, ''); if (v.length <= 9) setForm(p => ({ ...p, customer_phone: v })) }}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Celular" />
                  <input type="text" inputMode="numeric" value={form.customer_dni}
                    onChange={e => { const v = e.target.value.replace(/\D/g, ''); if (v.length <= 12) setForm(p => ({ ...p, customer_dni: v })) }}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="DNI / CE" />
                </div>
              </div>

              {/* Entrega */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Entrega</h3>
                <div className="flex gap-2">
                  <button onClick={() => setForm(p => ({ ...p, delivery_method: 'motorizado', agency_name: '' }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border ${form.delivery_method === 'motorizado' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                    🛵 Motorizado
                  </button>
                  {agencies.length > 0 && (
                    <button onClick={() => setForm(p => ({ ...p, delivery_method: 'agencia' }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium border ${form.delivery_method === 'agencia' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                      📦 Agencia
                    </button>
                  )}
                </div>
                {form.delivery_method === 'agencia' && (
                  <select value={form.agency_name} onChange={e => setForm(p => ({ ...p, agency_name: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Selecciona agencia</option>
                    {agencies.map(a => <option key={a.id} value={a.agency_name}>{a.agency_name}</option>)}
                  </select>
                )}
                <input type="text" value={form.destination} onChange={e => setForm(p => ({ ...p, destination: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Dirección / Destino" />
                <input type="text" value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Referencia (opcional)" />
              </div>

              {/* Productos seleccionados */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Productos</h3>
                {selectedItems.length === 0 ? (
                  <div className="bg-gray-50 rounded-xl p-3 text-center text-sm text-gray-400">Agrega productos desde abajo</div>
                ) : (
                  <div className="space-y-2 mb-3">
                    {selectedItems.map(item => (
                      <div key={item.product_id + (item.variant_id || '')} className="flex items-center gap-3 bg-blue-50 rounded-xl px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-blue-900 truncate">{item.product_name}</p>
                          {item.variant_name && <p className="text-xs text-blue-600">{item.variant_name}</p>}
                        </div>
                        <span className="text-xs text-blue-600 flex-shrink-0">S/ {item.subtotal.toFixed(2)}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => updateQty(item.product_id, item.variant_id, item.quantity - 1)}
                            className="w-6 h-6 bg-white rounded-lg text-blue-600 font-bold text-sm flex items-center justify-center">−</button>
                          <span className="w-6 text-center text-sm font-bold text-blue-900">{item.quantity}</span>
                          <button onClick={() => updateQty(item.product_id, item.variant_id, item.quantity + 1)}
                            className="w-6 h-6 bg-white rounded-lg text-blue-600 font-bold text-sm flex items-center justify-center">+</button>
                        </div>
                        <button onClick={() => removeItem(item.product_id, item.variant_id)} className="text-red-400 text-lg font-bold">×</button>
                      </div>
                    ))}
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">Total: S/ {total.toFixed(2)}</p>
                    </div>
                  </div>
                )}

                {/* Buscador productos */}
                <div className="relative mb-2">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                  <input type="text" value={searchProduct} onChange={e => setSearchProduct(e.target.value)}
                    placeholder="Buscar producto..."
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  {searchProduct && <button onClick={() => setSearchProduct('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">×</button>}
                </div>
                <div className="space-y-1 max-h-44 overflow-y-auto border border-gray-100 rounded-xl p-2">
                  {filteredProducts.map(product => {
                    const qty = selectedItems.filter(i => i.product_id === product.id).reduce((s, i) => s + i.quantity, 0)
                    return (
                      <button key={product.id} onClick={() => handleAddProduct(product)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${qty > 0 ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}`}>
                        <div className="text-left">
                          <span className="font-medium">{product.name}</span>
                          {product.variants.length > 0 && <span className="ml-2 text-xs text-gray-400">{product.variants.length} variantes</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">S/ {Number(product.sale_price).toFixed(2)}</span>
                          {qty > 0 ? <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">x{qty}</span> : <span className="text-blue-500 font-bold">{product.variants.length > 0 ? '▾' : '+'}</span>}
                        </div>
                      </button>
                    )
                  })}
                  {filteredProducts.length === 0 && <p className="text-center text-gray-400 text-sm py-3">Sin resultados</p>}
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={saveQuote} disabled={saving}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {saving ? 'Guardando...' : 'Crear cotización'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VARIANTE */}
      {variantModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900">{variantModal.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">Elige una variante</p>
              </div>
              <button onClick={() => setVariantModal(null)} className="text-gray-400 text-2xl font-bold">×</button>
            </div>
            <div className="p-4 space-y-2">
              {variantModal.variants.map(v => (
                <button key={v.id} onClick={() => addItem(variantModal.id, v.id, variantModal.name, v.color, variantModal.sale_price)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-blue-50 rounded-xl">
                  <span className="font-medium text-gray-800 text-sm">{v.color}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{v.stock} en stock</span>
                    <span className="text-blue-500 font-bold text-lg">+</span>
                  </div>
                </button>
              ))}
              <button onClick={() => addItem(variantModal.id, null, variantModal.name, null, variantModal.sale_price)}
                className="w-full px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium">Sin variante específica</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}