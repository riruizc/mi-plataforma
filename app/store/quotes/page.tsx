'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { IconFileText, IconSearch, IconPlus, IconClose, IconCheck, IconDownload } from '@/lib/icons'

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

  const generatePDF = async (quote: Quote) => {
    const { default: jsPDF } = await import('jspdf')
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

      // Validar stock disponible antes de convertir (la cotización pudo
      // haberse creado cuando había stock, y ya no queda suficiente)
      const variantIds = quote.items.filter(i => i.variant_id).map(i => i.variant_id as string)
      const stockMap = new Map<string, number>()
      if (variantIds.length > 0) {
        const { data: variantsStock } = await supabase.from('product_variants').select('id, stock').in('id', variantIds)
        for (const v of (variantsStock || []) as any[]) stockMap.set(v.id, v.stock)
        const shortages = quote.items.filter(i => i.variant_id && (stockMap.get(i.variant_id) ?? 0) < i.quantity)
        if (shortages.length > 0) {
          const list = shortages.map(i => `• ${i.product_name}${i.variant_name ? ' (' + i.variant_name + ')' : ''}: pide ${i.quantity}, hay ${stockMap.get(i.variant_id!) ?? 0}`).join('\n')
          if (!confirm(`Stock insuficiente para:\n${list}\n\n¿Convertir de todas formas? El stock de esos productos quedará en 0.`)) {
            setConverting(null); return
          }
        }
      }

      // Buscar o crear cliente
      let customerId = null
      if (quote.customer_phone) {
        const { data: existing } = await supabase.from('customers').select('id').eq('store_id', storeId).eq('phone', quote.customer_phone).maybeSingle()
        customerId = existing?.id
        if (!customerId) {
          const { data: newC } = await supabase.from('customers').insert({ store_id: storeId, name: quote.customer_name, phone: quote.customer_phone, dni: quote.customer_dni }).select('id').maybeSingle()
          customerId = newC?.id
          if (!customerId) {
            const { data: retryC } = await supabase.from('customers').select('id').eq('store_id', storeId).eq('phone', quote.customer_phone).maybeSingle()
            customerId = retryC?.id
          }
        }
        if (!customerId) { alert('No se pudo crear el cliente, intenta de nuevo'); setConverting(null); return }
      }

      // Crear código de pedido
      const year = new Date().getFullYear()
      const { data: counterData } = await supabase.rpc('increment_order_counter', { p_store_id: storeId })
      const code = storePrefix + '-' + year + '-' + String(counterData).padStart(3, '0')
      const token = crypto.randomUUID().replace(/-/g, '')

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
        // Descontar stock (clampeado a 0, nunca negativo)
        for (const item of quote.items) {
          if (item.variant_id) {
            const available = stockMap.get(item.variant_id) ?? item.quantity
            await supabase.rpc('decrement_stock', { p_variant_id: item.variant_id, p_qty: Math.min(item.quantity, available) })
          }
        }
      }

      // Marcar cotización como convertida
      await supabase.from('quotes').update({ status: 'converted' }).eq('id', quote.id).eq('store_id', storeId)
      loadData()
      alert(`✅ Pedido creado: ${code}`)
    } catch (e: any) { alert('Error: ' + e.message) }
    finally { setConverting(null) }
  }

  const deleteQuote = async (quote: Quote) => {
    if (!confirm(`¿Eliminar la cotización de "${quote.customer_name}"?`)) return
    const supabase = createClient()
    await supabase.from('quotes').delete().eq('id', quote.id).eq('store_id', storeId)
    loadData()
  }

  const statusStyle: Record<string, { text: string; bg: string }> = {
    active: { text: 'text-db-delivered', bg: 'bg-db-delivered-bg' },
    converted: { text: 'text-db-brand', bg: 'bg-db-brand-tint' },
    expired: { text: 'text-db-cancelled', bg: 'bg-db-cancelled-bg' },
  }
  const statusText: Record<string, string> = { active: 'Activa', converted: 'Convertida', expired: 'Expirada' }

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchProduct.toLowerCase()))

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-db-line border-t-db-brand rounded-full animate-spin mx-auto" />
    </div>
  )

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-db-ink">Cotizaciones</h1>
          <p className="text-db-ink-soft text-sm mt-0.5">{quotes.length} cotizaciones</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-1.5 bg-db-brand text-white font-semibold px-4 py-2.5 rounded-full text-sm shadow-[0_4px_14px_-4px_rgba(36,81,232,0.55)]">
          <IconPlus className="w-4 h-4" />Nueva
        </button>
      </div>

      {quotes.length === 0 ? (
        <div className="bg-db-surface rounded-2xl shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] p-12 text-center">
          <IconFileText className="w-8 h-8 mx-auto mb-3 text-db-ink-soft opacity-50" />
          <p className="text-db-ink font-semibold">No hay cotizaciones aún</p>
          <p className="text-db-ink-soft text-sm mt-1">Crea una cotización y conviértela a pedido cuando el cliente confirme</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map(quote => {
            const diasRestantes = Math.ceil((new Date(quote.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            return (
              <div key={quote.id} className={`bg-db-surface rounded-2xl shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] p-4 lg:p-5 ${quote.status === 'expired' ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-db-ink">{quote.customer_name}</p>
                      <span className={`text-[10.5px] px-2 py-0.5 rounded-full font-semibold ${statusStyle[quote.status]?.bg} ${statusStyle[quote.status]?.text}`}>
                        {statusText[quote.status]}
                      </span>
                    </div>
                    {quote.customer_phone && <p className="text-xs text-db-ink-soft mt-0.5 font-data">{quote.customer_phone}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-db-ink font-data tabular-nums">S/ {Number(quote.total_amount).toFixed(2)}</p>
                    {quote.status === 'active' && (
                      <p className={`text-xs font-semibold ${diasRestantes <= 1 ? 'text-db-cancelled' : diasRestantes <= 3 ? 'text-db-accent' : 'text-db-ink-soft'}`}>
                        {diasRestantes > 0 ? `Vence en ${diasRestantes}d` : 'Vence hoy'}
                      </p>
                    )}
                    {quote.status === 'expired' && <p className="text-xs text-db-cancelled">Expirada</p>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {quote.items.map((item, i) => (
                    <span key={i} className="text-[11px] font-semibold bg-db-brand-tint text-db-brand px-2.5 py-1 rounded-full">
                      {item.product_name}{item.variant_name ? ` (${item.variant_name})` : ''} x{item.quantity}
                    </span>
                  ))}
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => generatePDF(quote)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-db-delivered-bg text-db-delivered rounded-full text-xs font-semibold">
                    <IconDownload className="w-3.5 h-3.5" />PDF
                  </button>
                  {quote.status === 'active' && (
                    <button onClick={() => convertToOrder(quote)} disabled={converting === quote.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-db-brand text-white rounded-full text-xs font-semibold disabled:opacity-50">
                      <IconCheck className="w-3.5 h-3.5" />{converting === quote.id ? 'Convirtiendo...' : 'Convertir a pedido'}
                    </button>
                  )}
                  <button onClick={() => deleteQuote(quote)}
                    className="px-3 py-1.5 bg-db-cancelled-bg text-db-cancelled rounded-full text-xs font-semibold">Eliminar</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL NUEVA COTIZACIÓN */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-db-surface rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-db-line flex-shrink-0">
              <h2 className="font-bold text-db-ink">Nueva cotización</h2>
              <button onClick={() => setShowForm(false)} className="text-db-ink-soft"><IconClose className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Datos del cliente */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-db-ink">Datos del cliente</h3>
                <input type="text" value={form.customer_name} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand"
                  placeholder="Nombre completo *" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" inputMode="numeric" value={form.customer_phone}
                    onChange={e => { const v = e.target.value.replace(/\D/g, ''); if (v.length <= 9) setForm(p => ({ ...p, customer_phone: v })) }}
                    className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand font-data"
                    placeholder="Celular" />
                  <input type="text" inputMode="numeric" value={form.customer_dni}
                    onChange={e => { const v = e.target.value.replace(/\D/g, ''); if (v.length <= 12) setForm(p => ({ ...p, customer_dni: v })) }}
                    className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand font-data"
                    placeholder="DNI / CE" />
                </div>
              </div>

              {/* Entrega */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-db-ink">Entrega</h3>
                <div className="flex gap-2">
                  <button onClick={() => setForm(p => ({ ...p, delivery_method: 'motorizado', agency_name: '' }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${form.delivery_method === 'motorizado' ? 'bg-db-brand text-white border-db-brand' : 'bg-db-surface text-db-ink-soft border-db-line'}`}>
                    Motorizado
                  </button>
                  {agencies.length > 0 && (
                    <button onClick={() => setForm(p => ({ ...p, delivery_method: 'agencia' }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${form.delivery_method === 'agencia' ? 'bg-db-brand text-white border-db-brand' : 'bg-db-surface text-db-ink-soft border-db-line'}`}>
                      Agencia
                    </button>
                  )}
                </div>
                {form.delivery_method === 'agencia' && (
                  <select value={form.agency_name} onChange={e => setForm(p => ({ ...p, agency_name: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand">
                    <option value="">Selecciona agencia</option>
                    {agencies.map(a => <option key={a.id} value={a.agency_name}>{a.agency_name}</option>)}
                  </select>
                )}
                <input type="text" value={form.destination} onChange={e => setForm(p => ({ ...p, destination: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand"
                  placeholder="Dirección / Destino" />
                <input type="text" value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand"
                  placeholder="Referencia (opcional)" />
              </div>

              {/* Productos seleccionados */}
              <div>
                <h3 className="text-sm font-bold text-db-ink mb-2">Productos</h3>
                {selectedItems.length === 0 ? (
                  <div className="bg-db-paper rounded-xl p-3 text-center text-sm text-db-ink-soft">Agrega productos desde abajo</div>
                ) : (
                  <div className="space-y-2 mb-3">
                    {selectedItems.map(item => (
                      <div key={item.product_id + (item.variant_id || '')} className="flex items-center gap-3 bg-db-brand-tint rounded-xl px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-db-brand truncate">{item.product_name}</p>
                          {item.variant_name && <p className="text-xs text-db-brand/70">{item.variant_name}</p>}
                        </div>
                        <span className="text-xs text-db-brand flex-shrink-0 font-data">S/ {item.subtotal.toFixed(2)}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => updateQty(item.product_id, item.variant_id, item.quantity - 1)}
                            className="w-6 h-6 bg-db-surface rounded-full text-db-brand font-bold text-sm flex items-center justify-center">−</button>
                          <span className="w-6 text-center text-sm font-bold text-db-brand font-data">{item.quantity}</span>
                          <button onClick={() => updateQty(item.product_id, item.variant_id, item.quantity + 1)}
                            className="w-6 h-6 bg-db-surface rounded-full text-db-brand font-bold text-sm flex items-center justify-center">+</button>
                        </div>
                        <button onClick={() => removeItem(item.product_id, item.variant_id)} className="text-db-cancelled"><IconClose className="w-4 h-4" /></button>
                      </div>
                    ))}
                    <div className="text-right">
                      <p className="text-sm font-bold text-db-ink font-data">Total: S/ {total.toFixed(2)}</p>
                    </div>
                  </div>
                )}

                {/* Buscador productos */}
                <div className="relative mb-2">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-db-ink-soft"><IconSearch className="w-3.5 h-3.5" /></span>
                  <input type="text" value={searchProduct} onChange={e => setSearchProduct(e.target.value)}
                    placeholder="Buscar producto..."
                    className="w-full pl-8 pr-3 py-2 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand" />
                  {searchProduct && <button onClick={() => setSearchProduct('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-db-ink-soft">×</button>}
                </div>
                <div className="space-y-1 max-h-44 overflow-y-auto border border-db-line rounded-xl p-2">
                  {filteredProducts.map(product => {
                    const qty = selectedItems.filter(i => i.product_id === product.id).reduce((s, i) => s + i.quantity, 0)
                    return (
                      <button key={product.id} onClick={() => handleAddProduct(product)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${qty > 0 ? 'bg-db-brand-tint text-db-brand' : 'hover:bg-db-paper text-db-ink'}`}>
                        <div className="text-left">
                          <span className="font-semibold">{product.name}</span>
                          {product.variants.length > 0 && <span className="ml-2 text-xs text-db-ink-soft">{product.variants.length} variantes</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-db-ink-soft font-data">S/ {Number(product.sale_price).toFixed(2)}</span>
                          {qty > 0 ? <span className="text-xs bg-db-brand text-white px-1.5 py-0.5 rounded-full font-bold font-data">x{qty}</span> : <span className="text-db-brand font-bold">+</span>}
                        </div>
                      </button>
                    )
                  })}
                  {filteredProducts.length === 0 && <p className="text-center text-db-ink-soft text-sm py-3">Sin resultados</p>}
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-db-line flex-shrink-0">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-3 border border-db-line text-db-ink-soft rounded-full text-sm font-semibold">Cancelar</button>
              <button onClick={saveQuote} disabled={saving}
                className="flex-1 py-3 bg-db-brand text-white rounded-full text-sm font-bold disabled:opacity-50">
                {saving ? 'Guardando...' : 'Crear cotización'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VARIANTE */}
      {variantModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-db-surface rounded-2xl w-full max-w-xs shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-db-line">
              <div>
                <h3 className="font-bold text-db-ink">{variantModal.name}</h3>
                <p className="text-xs text-db-ink-soft mt-0.5">Elige una variante</p>
              </div>
              <button onClick={() => setVariantModal(null)} className="text-db-ink-soft"><IconClose className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-2">
              {variantModal.variants.map(v => (
                <button key={v.id} onClick={() => addItem(variantModal.id, v.id, variantModal.name, v.color, variantModal.sale_price)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-db-paper hover:bg-db-brand-tint rounded-xl">
                  <span className="font-semibold text-db-ink text-sm">{v.color}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-db-ink-soft font-data">{v.stock} en stock</span>
                    <span className="text-db-brand font-bold text-lg">+</span>
                  </div>
                </button>
              ))}
              <button onClick={() => addItem(variantModal.id, null, variantModal.name, null, variantModal.sale_price)}
                className="w-full px-4 py-2.5 bg-db-paper text-db-ink-soft rounded-xl text-sm font-semibold">Sin variante específica</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
