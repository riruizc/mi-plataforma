'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Store = {
  id: string; name: string; store_prefix: string; theme_color: string
  button_color?: string; text_color?: string
  logo_url: string; uses_agency_delivery: boolean; order_counter: number; form_active: boolean
}
type Product = {
  id: string; name: string; category: string; sale_price: number
  image_url?: string | null
  variants: { id: string; color: string; stock: number }[]
}
type ComboItem = { product_id: string; variant_id: string | null; quantity: number; product_name: string; color: string | null }
type Combo = {
  id: string; name: string; description: string; price: number; is_active: boolean; items: ComboItem[]
}
type Agency = { id: string; agency_name: string; destinations: string[]; is_active: boolean }
type CartItem = {
  product_id: string; variant_id: string; product_name: string; color: string; quantity: number; unit_price: number
}
type ComboCartItem = {
  combo_id: string; combo_name: string; quantity: number; unit_price: number; items: ComboItem[]
}

function AgencyDestinationSearch({ destinations, value, onChange, themeColor }: {
  destinations: string[]; value: string; onChange: (val: string) => void; themeColor: string
}) {
  const [query, setQuery] = useState(value || '')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const filtered = query.trim().length >= 2
    ? destinations.filter(d => d.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : []

  const handleSelect = (dest: string) => {
    setQuery(dest)
    onChange(dest)
    setShowSuggestions(false)
  }

  const handleChange = (val: string) => {
    setQuery(val)
    onChange(val)
    setShowSuggestions(true)
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        placeholder="Escribe tu destino..."
        className="w-full px-3 py-3 rounded-xl text-base text-white placeholder-white/30 focus:outline-none focus:ring-1" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
      />
      {query && (
        <button type="button" onClick={() => { setQuery(''); onChange(''); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl">×</button>
      )}
      {showSuggestions && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-52 overflow-y-auto">
          {filtered.map((dest, i) => (
            <button key={i} type="button" onMouseDown={() => handleSelect(dest)}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100 last:border-0 touch-manipulation">
              📍 {dest}
            </button>
          ))}
        </div>
      )}
      {showSuggestions && query.trim().length >= 2 && filtered.length === 0 && (
        <div className="absolute z-50 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow mt-1 px-4 py-3">
          <p className="text-sm text-gray-400">No se encontraron destinos</p>
        </div>
      )}
      {query.trim().length < 2 && !value && (
        <p className="text-xs text-gray-400 mt-1">Escribe al menos 2 letras para buscar</p>
      )}
    </div>
  )
}

function MapPicker({ lat, lng, onSelect, themeColor }: {
  lat: number | null; lng: number | null; onSelect: (lat: number, lng: number) => void; themeColor: string
}) {
  const mapRef = useRef<any>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)

  useEffect(() => {
    initMap()
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null } }
  }, [])

  useEffect(() => {
    if (!lat || !lng || !mapInstanceRef.current) return
    import('leaflet').then((L) => {
      const map = mapInstanceRef.current
      map.setView([lat, lng], 16)
      if (markerRef.current) markerRef.current.remove()
      const icon = L.divIcon({ className: '', html: '<div style="background:' + themeColor + ';width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>', iconSize: [22, 22], iconAnchor: [11, 11] })
      markerRef.current = L.marker([lat, lng], { icon }).addTo(map)
    })
  }, [lat, lng, themeColor])

  const initMap = async () => {
    if (typeof window === 'undefined' || mapInstanceRef.current || !mapRef.current) return
    const L = await import('leaflet')
    await import('leaflet/dist/leaflet.css' as any)
    if ((mapRef.current as any)._leaflet_id) { (mapRef.current as any)._leaflet_id = null }
    const map = L.map(mapRef.current).setView([-8.1116, -79.0286], 14)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map)
    map.on('click', (e: any) => {
      const { lat, lng } = e.latlng
      if (markerRef.current) markerRef.current.remove()
      const icon = L.divIcon({ className: '', html: '<div style="background:' + themeColor + ';width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>', iconSize: [22, 22], iconAnchor: [11, 11] })
      markerRef.current = L.marker([lat, lng], { icon }).addTo(map)
      onSelect(lat, lng)
    })
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition((pos) => { map.setView([pos.coords.latitude, pos.coords.longitude], 16) })
    mapInstanceRef.current = map
  }

  return (
    <div>
      <button type="button" onClick={async () => {
        if (!navigator.geolocation) { alert('Tu navegador no soporta geolocalización'); return }
        navigator.geolocation.getCurrentPosition((pos) => {
          const { latitude, longitude } = pos.coords
          const map = mapInstanceRef.current
          if (map) {
            map.setView([latitude, longitude], 17)
            import('leaflet').then((L) => {
              if (markerRef.current) markerRef.current.remove()
              const icon = L.divIcon({ className: '', html: '<div style="background:' + themeColor + ';width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>', iconSize: [22, 22], iconAnchor: [11, 11] })
              markerRef.current = L.marker([latitude, longitude], { icon }).addTo(map)
              onSelect(latitude, longitude)
            })
          }
        }, () => alert('No se pudo obtener tu ubicación'))
      }} className="w-full mb-3 py-3 rounded-xl text-sm font-semibold border-2 border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-gray-100 flex items-center justify-center gap-2 touch-manipulation">
        📍 Usar mi ubicación actual
      </button>
      <div ref={mapRef} className="w-full rounded-xl overflow-hidden border border-gray-200" style={{ height: '220px' }} />
    </div>
  )
}

export default function OrderForm() {
  const params = useParams()
  const prefix = (params.prefix as string)?.toUpperCase()

  const [store, setStore] = useState<Store | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [combos, setCombos] = useState<Combo[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [comboCart, setComboCart] = useState<ComboCartItem[]>([])
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([])
  const [orderCode, setOrderCode] = useState('')
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [formDisabled, setFormDisabled] = useState(false)
  const [activeTab, setActiveTab] = useState<'products' | 'combos'>('products')
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('Todos')

  const [customer, setCustomer] = useState({ dni: '', name: '', phone: '' })
  const [delivery, setDelivery] = useState({ method: 'motorizado', destination: '', reference: '', lat: '', lng: '', agency_name: '' })

  useEffect(() => { loadStore() }, [prefix])

  const loadStore = async () => {
    try {
      const supabase = createClient()
      const { data: storeData } = await supabase
        .from('stores')
        .select('*, button_color, text_color')
        .eq('store_prefix', prefix)
        .eq('status', 'active')
        .single()

      if (!storeData) { setLoading(false); return }

      if (storeData.form_active === false) {
        setStore(storeData); setFormDisabled(true); setLoading(false); return
      }

      setStore(storeData)

      const [{ data: prods }, { data: agencyData }, { data: combosData }] =
        await Promise.all([
          supabase.from('products').select('*, product_variants(*)').eq('store_id', storeData.id).eq('is_active', true).eq('show_in_form', true),
          supabase.from('delivery_agencies').select('*').eq('store_id', storeData.id).eq('is_active', true),
          supabase.from('combos').select('*').eq('store_id', storeData.id).eq('is_active', true).order('name'),
        ])

      setAgencies(agencyData || [])
      setProducts((prods || []).map((p: any) => ({ ...p, variants: p.product_variants || [] })))

      const comboIds = (combosData || []).map((c: any) => c.id)
      let mappedCombos: Combo[] = (combosData || []).map((c: any) => ({ ...c, items: [] }))

      if (comboIds.length > 0) {
        const { data: comboItems } = await supabase
          .from('combo_items')
          .select('combo_id, product_id, variant_id, quantity, products(name), product_variants(color)')
          .in('combo_id', comboIds)

        mappedCombos = (combosData || []).map((c: any) => ({
          ...c,
          items: ((comboItems || []) as any[])
            .filter((ci: any) => ci.combo_id === c.id)
            .map((ci: any) => ({
              product_id: ci.product_id,
              variant_id: ci.variant_id || null,
              quantity: ci.quantity,
              product_name: ci.products?.name || '',
              color: ci.product_variants?.color || null,
            })),
        }))
      }

      setCombos(mappedCombos)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const categories = ['Todos', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))]

  const filteredProducts = products.filter(p => {
    const matchSearch = search.trim() === '' || p.name.toLowerCase().includes(search.toLowerCase()) || p.category?.toLowerCase().includes(search.toLowerCase())
    const matchCategory = activeCategory === 'Todos' || p.category === activeCategory
    return matchSearch && matchCategory
  })

  const filteredCombos = search.trim() === '' ? combos : combos.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  const addToCart = (product: Product, variant: { id: string; color: string; stock: number }) => {
    const keyId = variant.id || product.id
    const existing = cart.find((c) => (c.variant_id || c.product_id) === keyId && c.product_id === product.id)
    if (existing) {
      setCart(cart.map((c) => ((c.variant_id || c.product_id) === keyId && c.product_id === product.id) ? { ...c, quantity: c.quantity + 1 } : c))
    } else {
      setCart([...cart, {
        product_id: product.id,
        variant_id: variant.id, // puede ser '' para productos sin variante
        product_name: product.name,
        color: variant.color,
        quantity: 1,
        unit_price: product.sale_price
      }])
    }
  }

  const addComboToCart = (combo: Combo) => {
    const existing = comboCart.find(c => c.combo_id === combo.id)
    if (existing) {
      setComboCart(comboCart.map(c => c.combo_id === combo.id ? { ...c, quantity: c.quantity + 1 } : c))
    } else {
      setComboCart([...comboCart, { combo_id: combo.id, combo_name: combo.name, quantity: 1, unit_price: combo.price, items: combo.items }])
    }
  }

  const removeFromCart = (item: CartItem) => setCart(cart.filter((c) => !(c.product_id === item.product_id && c.variant_id === item.variant_id)))
  const removeComboFromCart = (comboId: string) => setComboCart(comboCart.filter(c => c.combo_id !== comboId))

  const updateQty = (item: CartItem, qty: number) => {
    if (qty <= 0) { removeFromCart(item); return }
    setCart(cart.map((c) => (c.product_id === item.product_id && c.variant_id === item.variant_id) ? { ...c, quantity: qty } : c))
  }

  const updateComboQty = (comboId: string, qty: number) => {
    if (qty <= 0) { removeComboFromCart(comboId); return }
    setComboCart(comboCart.map(c => c.combo_id === comboId ? { ...c, quantity: qty } : c))
  }

  const productTotal = cart.reduce((sum, c) => sum + c.unit_price * c.quantity, 0)
  const comboTotal = comboCart.reduce((sum, c) => sum + c.unit_price * c.quantity, 0)
  const total = productTotal + comboTotal
  const totalItems = cart.reduce((s, c) => s + c.quantity, 0) + comboCart.reduce((s, c) => s + c.quantity, 0)

  const handleSubmit = async () => {
    if (!store) return
    if (cart.length === 0 && comboCart.length === 0) { alert('Agrega al menos un producto o combo'); return }
    if (!customer.name || !customer.phone) { alert('Completa tu nombre y celular'); return }
    if (delivery.method === 'agencia' && !delivery.agency_name) { alert('Selecciona una agencia'); return }
    if (!delivery.destination) { alert('Indica tu dirección o destino de entrega'); return }
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: existingCustomer } = await supabase.from('customers').select('id').eq('store_id', store.id).eq('phone', customer.phone).single()
      let customerId = existingCustomer?.id
      if (!customerId) {
        const { data: newCustomer } = await supabase.from('customers').insert({ store_id: store.id, name: customer.name, phone: customer.phone, dni: customer.dni }).select('id').single()
        customerId = newCustomer?.id
      }
      const year = new Date().getFullYear()
      const { data: counterData } = await supabase.rpc('increment_order_counter', { p_store_id: store.id })
      const code = store.store_prefix + '-' + year + '-' + String(counterData).padStart(3, '0')
      const token = Math.random().toString(36).substring(2, 15)
      const { data: order } = await supabase.from('orders').insert({
        store_id: store.id, customer_id: customerId, order_code: code,
        delivery_method: delivery.method,
        agency_name: delivery.method === 'agencia' ? delivery.agency_name : null,
        destination: delivery.destination, reference: delivery.reference || null,
        lat: delivery.method === 'motorizado' && delivery.lat ? Number(delivery.lat) : null,
        lng: delivery.method === 'motorizado' && delivery.lng ? Number(delivery.lng) : null,
        total_amount: total, pending_amount: total, status: 'pending', tracking_token: token,
      }).select('id').single()

      if (order) {
        // Insertar items de productos normales
        if (cart.length > 0) {
          await supabase.from('order_items').insert(
            cart.map((c) => ({
              order_id: order.id,
              product_id: c.product_id,
              variant_id: c.variant_id || null, // FIX: null para productos sin variante
              product_name: c.product_name,
              color: c.color,
              quantity: c.quantity,
              unit_price: c.unit_price,
              subtotal: c.unit_price * c.quantity
            }))
          )
          for (const item of cart) {
            // FIX: solo descontar stock si tiene variant_id real
            if (item.variant_id) {
              await supabase.rpc('decrement_stock', { p_variant_id: item.variant_id, p_qty: item.quantity })
            }
          }
        }

        // Insertar items de combos (expandidos) y descontar stock
        if (comboCart.length > 0) {
          for (const comboItem of comboCart) {
            for (const ci of comboItem.items) {
              const totalQty = ci.quantity * comboItem.quantity
              await supabase.from('order_items').insert({
                order_id: order.id,
                product_id: ci.product_id,
                variant_id: ci.variant_id || null,
                product_name: `[Combo: ${comboItem.combo_name}] ${ci.product_name}`,
                color: ci.color || 'Único',
                quantity: totalQty,
                unit_price: 0,
                subtotal: 0,
              })
              if (ci.variant_id) await supabase.rpc('decrement_stock', { p_variant_id: ci.variant_id, p_qty: totalQty })
            }
            await supabase.from('order_items').insert({
              order_id: order.id,
              product_id: comboItem.items[0]?.product_id || null,
              variant_id: null,
              product_name: `🎁 Combo: ${comboItem.combo_name}`,
              color: `x${comboItem.quantity}`,
              quantity: comboItem.quantity,
              unit_price: comboItem.unit_price,
              subtotal: comboItem.unit_price * comboItem.quantity,
            })
          }
        }

        setOrderCode(code)
        setStep(4)
      }
    } catch (e) { console.error(e); alert('Error al enviar el pedido, intenta de nuevo') }
    finally { setSubmitting(false) }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
        <p className="text-white/30 text-sm">Cargando tienda...</p>
      </div>
    </div>
  )

  if (!store) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0a0a0a' }}>
      <div className="text-center">
        <p className="text-white/20 text-5xl mb-4">🔍</p>
        <p className="text-white font-bold text-lg">Tienda no encontrada</p>
        <p className="text-white/40 text-sm mt-1">Verifica el enlace e intenta de nuevo</p>
      </div>
    </div>
  )

  if (formDisabled) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0a0a0a' }}>
      <div className="rounded-2xl p-8 max-w-sm w-full text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {store.logo_url && <img src={store.logo_url} alt="Logo" className="w-16 h-16 rounded-2xl object-cover mx-auto mb-4" />}
        <p className="text-4xl mb-3">🚫</p>
        <h2 className="text-xl font-bold text-white mb-2">{store.name}</h2>
        <p className="text-white/40 text-sm">No estamos recibiendo pedidos en este momento.</p>
        <p className="text-white/25 text-xs mt-2">Intenta más tarde o contacta directamente a la tienda.</p>
      </div>
    </div>
  )

  const color = store?.theme_color || '#3b82f6'
  const btnColor = (store as any)?.button_color || color
  const txtColor = (store as any)?.text_color || '#ffffff'

  if (step === 4) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0a0a0a', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');`}</style>
      <div className="rounded-3xl p-8 max-w-sm w-full text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <span className="text-3xl">✅</span>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">¡Pedido recibido!</h2>
        <p className="text-white/40 text-sm mb-4">Tu código de pedido es:</p>
        <div className="rounded-2xl px-4 py-4 mb-4" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <span className="text-xl font-bold tracking-widest font-mono" style={{ color: btnColor }}>{orderCode}</span>
        </div>
        <p className="text-white/25 text-xs mb-6">Guarda este código para rastrear tu pedido</p>
        <a href={`/track?code=${orderCode}`}
          className="w-full py-4 rounded-2xl font-bold block text-center text-base touch-manipulation"
          style={{ background: btnColor, color: txtColor }}>
          Rastrear mi pedido →
        </a>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');`}</style>
      {/* HEADER */}
      <div className="sticky top-0 z-10" style={{ background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-lg mx-auto px-4 pt-3 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              {store.logo_url && <img src={store.logo_url} alt="Logo" className="w-8 h-8 rounded-xl object-cover flex-shrink-0" style={{ border: `1.5px solid ${color}40` }} />}
              <h1 className="text-white font-bold text-sm truncate">{store.name}</h1>
            </div>
          </div>
          <div className="flex items-center justify-center gap-1 pb-3">
            {['Productos', 'Tus datos', 'Entrega'].map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all"
                  style={{ background: step >= i + 1 ? btnColor : 'rgba(255,255,255,0.1)', color: step >= i + 1 ? txtColor : 'rgba(255,255,255,0.3)' }}>
                  {step > i + 1 ? '✓' : i + 1}
                </div>
                <span className="text-xs font-medium" style={{ color: step === i + 1 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)' }}>{s}</span>
                {i < 2 && <span className="text-white/20 text-xs mx-0.5">›</span>}
              </div>
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="sticky z-9 px-4 pb-2" style={{ background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="relative mb-2">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">🔍</span>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar producto o combo..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm bg-white bg-opacity-95 text-gray-800 placeholder-gray-400 focus:outline-none border-0" />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg leading-none">×</button>}
            </div>
            {combos.length > 0 && (
              <div className="flex gap-2 pb-1">
                <button onClick={() => setActiveTab('products')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === 'products' ? 'bg-white text-gray-800' : 'bg-white/20 text-white'}`}>
                  📦 Productos ({products.length})
                </button>
                <button onClick={() => setActiveTab('combos')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === 'combos' ? 'bg-white text-gray-800' : 'bg-white/20 text-white'}`}>
                  🎁 Combos ({combos.length})
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FILTRO CATEGORÍA */}
      {step === 1 && activeTab === 'products' && categories.length > 2 && (
        <div className="sticky z-9 px-4 py-2" style={{ background: "rgba(10,10,10,0.9)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all touch-manipulation ${activeCategory === cat ? "text-white border-transparent" : "border-white/10 text-white/40"}`}
                style={activeCategory === cat ? { backgroundColor: btnColor } : {}}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 py-5 pb-32" style={{ color: "white" }}>

        {/* PASO 1 */}
        {step === 1 && (
          <div>
            {activeTab === 'products' && (
              <div>
                {filteredProducts.length === 0 ? (
                  <div className="bg-white rounded-xl p-10 text-center mt-2">
                    <p className="text-3xl mb-2">😕</p>
                    <p className="text-gray-500 text-sm font-medium">No encontramos productos</p>
                    {search && <button onClick={() => setSearch('')} className="mt-3 text-blue-600 text-sm underline">Limpiar búsqueda</button>}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredProducts.map((product) => (
                      <div key={product.id} className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div className="flex items-start gap-3 mb-3">
                          {product.image_url && (
                            <img src={product.image_url} alt={product.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-gray-100" />
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-white text-sm leading-snug">{product.name}</h3>
                            {product.category && <p className="text-xs text-white/30 mt-0.5">{product.category}</p>}
                          </div>
                        </div>
                        {product.variants.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {product.variants.map((v) => {
                              const inCart = cart.find((c) => c.variant_id === v.id && c.product_id === product.id)
                              return (
                                <button key={v.id} onClick={() => addToCart(product, v)}
                                  className="px-3 py-2 rounded-lg text-sm font-medium border transition-all touch-manipulation"
                                style={inCart ? { background: btnColor, color: txtColor, borderColor: btnColor } : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.1)' }}>
                                  {v.color} {inCart ? `✓ ${inCart.quantity}` : ''}
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <button onClick={() => addToCart(product, { id: '', color: 'Único', stock: 99 })}
                            className="px-4 py-2 rounded-lg text-sm font-medium touch-manipulation" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
                            {cart.find(c => c.product_id === product.id && !c.variant_id)
                              ? `✓ ${cart.find(c => c.product_id === product.id && !c.variant_id)?.quantity} en carrito`
                              : '+ Agregar'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'combos' && (
              <div>
                {filteredCombos.length === 0 ? (
                  <div className="bg-white rounded-xl p-10 text-center mt-2">
                    <p className="text-3xl mb-2">🎁</p>
                    <p className="text-gray-500 text-sm font-medium">No hay combos disponibles</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredCombos.map(combo => {
                      const inCart = comboCart.find(c => c.combo_id === combo.id)
                      return (
                        <div key={combo.id} className={`rounded-2xl p-4 transition-all`}>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0 pr-3">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">🎁</span>
                                <h3 className="font-semibold text-white text-sm leading-snug">{combo.name}</h3>
                              </div>
                              {combo.description && <p className="text-xs text-white/30 mt-0.5 ml-7">{combo.description}</p>}
                              {combo.items.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2 ml-7">
                                  {combo.items.map((ci, i) => (
                                    <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                      {ci.quantity}x {ci.product_name}{ci.color ? ` (${ci.color})` : ''}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            
                          </div>
                          {inCart ? (
                            <div className="flex items-center gap-3 mt-3">
                              <div className="flex items-center gap-2">
                                <button onClick={() => updateComboQty(combo.id, inCart.quantity - 1)}
                                  className="w-7 h-7 rounded-full flex items-center justify-center font-bold touch-manipulation" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>−</button>
                                <span className="w-6 text-center text-sm font-semibold">{inCart.quantity}</span>
                                <button onClick={() => updateComboQty(combo.id, inCart.quantity + 1)}
                                  className="w-7 h-7 rounded-full flex items-center justify-center font-bold touch-manipulation" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>+</button>
                              </div>
                              <button onClick={() => removeComboFromCart(combo.id)} className="text-xs font-medium" style={{ color: "rgba(239,68,68,0.7)" }}>✕ Quitar</button>
                
                            </div>
                          ) : (
                            <button onClick={() => addComboToCart(combo)}
                              className="mt-2 px-4 py-2 rounded-lg text-sm font-medium touch-manipulation" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
                              + Agregar combo
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {totalItems > 0 && (
              <div className="fixed bottom-0 left-0 right-0" style={{ background: "rgba(10,10,10,0.95)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/40">{totalItems} item{totalItems !== 1 ? 's' : ''}</p>
                    <p className="font-bold text-white text-base">S/ {total.toFixed(2)}</p>
                  </div>
                  <button onClick={() => setStep(2)}
                    className="px-6 py-3 rounded-xl text-white font-bold text-sm flex-shrink-0 touch-manipulation active:opacity-80"
                    style={{ backgroundColor: btnColor }}>
                    Continuar →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PASO 2 */}
        {step === 2 && (
          <div>
            <h2 className="text-base font-bold text-white mb-3">Tus datos</h2>
            <div className="rounded-2xl p-4 space-y-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1">DNI / CE <span className="text-gray-400 font-normal">(opcional)</span></label>
                <input type="text" inputMode="numeric" value={customer.dni}
                  onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= 12) setCustomer({ ...customer, dni: val }) }}
                  className="w-full px-3 py-3 rounded-xl text-base text-white placeholder-white/30 focus:outline-none focus:ring-1" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                  placeholder="DNI (8 dígitos) o CE (hasta 12)" maxLength={12} />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1">Nombre completo <span className="text-red-500">*</span></label>
                <input type="text" autoCapitalize="words" value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  className="w-full px-3 py-3 rounded-xl text-base text-white placeholder-white/30 focus:outline-none focus:ring-1" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} placeholder="Juan Pérez" />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1">Celular <span className="text-red-500">*</span></label>
                <input type="text" inputMode="numeric" value={customer.phone}
                  onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= 9) setCustomer({ ...customer, phone: val }) }}
                  className="w-full px-3 py-3 rounded-xl text-base text-white placeholder-white/30 focus:outline-none focus:ring-1" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                  placeholder="999 999 999" maxLength={9} />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl font-semibold touch-manipulation" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>← Atrás</button>
              <button onClick={() => { if (!customer.name || !customer.phone) { alert('Nombre y celular son obligatorios'); return } setStep(3) }}
                className="flex-1 py-3 rounded-xl text-white font-bold touch-manipulation active:opacity-80"
                style={{ backgroundColor: btnColor }}>
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* PASO 3 */}
        {step === 3 && (
          <div>
            <h2 className="text-base font-bold text-white mb-3">Datos de entrega</h2>
            <div className="rounded-2xl p-4 space-y-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Método de entrega</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setDelivery((prev) => ({ ...prev, method: 'motorizado', agency_name: '', destination: '', lat: '', lng: '' }))}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all touch-manipulation`}
                    style={delivery.method === 'motorizado' ? { borderColor: btnColor, background: btnColor + '15', color: 'rgba(255,255,255,0.9)' } : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}>
                    🛵 Motorizado
                  </button>
                  {agencies.length > 0 && (
                    <button type="button" onClick={() => setDelivery((prev) => ({ ...prev, method: 'agencia', lat: '', lng: '' }))}
                      className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all touch-manipulation`}
                    style={delivery.method === 'agencia' ? { borderColor: btnColor, background: btnColor + '15', color: 'rgba(255,255,255,0.9)' } : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}>
                      📦 Agencia
                    </button>
                  )}
                </div>
              </div>

              {delivery.method === 'motorizado' ? (
                <div className="relative">
                  <label className="block text-sm font-medium text-white/60 mb-1">Dirección <span className="text-red-500">*</span></label>
                  <input type="text" autoComplete="street-address" value={delivery.destination}
                    onChange={(e) => {
                      const value = e.target.value
                      setDelivery((prev) => ({ ...prev, destination: value }))
                      if (value.length < 8) { setAddressSuggestions([]); return }
                      clearTimeout((window as any)._geocodeTimer)
                      ;(window as any)._geocodeTimer = setTimeout(async () => {
                        try {
                          const res = await fetch('/api/geocode?q=' + encodeURIComponent(value))
                          if (!res.ok) { setAddressSuggestions([]); return }
                          const text = await res.text()
                          if (!text || text.trim() === '') { setAddressSuggestions([]); return }
                          setAddressSuggestions(JSON.parse(text))
                        } catch { setAddressSuggestions([]) }
                      }, 500)
                    }}
                    className="w-full px-3 py-3 rounded-xl text-base text-white placeholder-white/30 focus:outline-none focus:ring-1" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                    placeholder="Av. Principal 123" />
                  {addressSuggestions.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-52 overflow-y-auto">
                      {addressSuggestions.map((s: any) => (
                        <button key={s.place_id} type="button"
                          onClick={() => { setDelivery((prev) => ({ ...prev, destination: s.display_name, lat: String(s.lat), lng: String(s.lon) })); setAddressSuggestions([]) }}
                          className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 border-b border-gray-100 last:border-0 touch-manipulation">
                          📍 {s.display_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-1">Agencia <span className="text-red-500">*</span></label>
                    <select value={delivery.agency_name || ''} onChange={(e) => setDelivery((prev) => ({ ...prev, agency_name: e.target.value, destination: '' }))}
                      className="w-full px-3 py-3 rounded-xl text-base text-white placeholder-white/30 focus:outline-none focus:ring-1" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      <option value="">Selecciona una agencia</option>
                      {agencies.map((a) => <option key={a.id} value={a.agency_name}>{a.agency_name}</option>)}
                    </select>
                  </div>
                  {delivery.agency_name && (
                    <div>
                      <label className="block text-sm font-medium text-white/60 mb-1">Destino <span className="text-red-500">*</span></label>
                      {agencies.find((a) => a.agency_name === delivery.agency_name)?.destinations?.length ? (
                        <AgencyDestinationSearch
                          destinations={agencies.find((a) => a.agency_name === delivery.agency_name)?.destinations || []}
                          value={delivery.destination}
                          onChange={(val) => setDelivery((prev) => ({ ...prev, destination: val }))}
                          themeColor={btnColor}
                        />
                      ) : (
                        <input type="text" value={delivery.destination} onChange={(e) => setDelivery((prev) => ({ ...prev, destination: e.target.value }))}
                          className="w-full px-3 py-3 rounded-xl text-base text-white placeholder-white/30 focus:outline-none focus:ring-1" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                          placeholder="Ciudad o distrito de destino" />
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-white/60 mb-1">Referencia <span className="text-gray-400 font-normal">(opcional)</span></label>
                <input type="text" value={delivery.reference} onChange={(e) => setDelivery({ ...delivery, reference: e.target.value })}
                  className="w-full px-3 py-3 rounded-xl text-base text-white placeholder-white/30 focus:outline-none focus:ring-1" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                  placeholder="Casa azul, frente al parque" />
              </div>

              {delivery.method === 'motorizado' && (
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1">Ubicación en mapa <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <p className="text-xs text-white/30 mb-2">Toca el mapa para marcar tu ubicación exacta</p>
                  <MapPicker lat={delivery.lat ? parseFloat(delivery.lat) : null} lng={delivery.lng ? parseFloat(delivery.lng) : null}
                    onSelect={(lat, lng) => setDelivery((prev) => ({ ...prev, lat: String(lat), lng: String(lng) }))}
                    themeColor={btnColor} />
                  {delivery.lat && delivery.lng && <p className="text-xs mt-2 font-medium" style={{ color: "#10b981" }}>✅ Ubicación marcada</p>}
                </div>
              )}
            </div>

            {/* Resumen del pedido */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mt-4">
              <h3 className="font-bold text-white mb-3 text-sm">Resumen del pedido</h3>
              {cart.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => updateQty(item, item.quantity - 1)} className="w-7 h-7 rounded-full flex items-center justify-center text-base font-bold touch-manipulation" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>−</button>
                      <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                      <button onClick={() => updateQty(item, item.quantity + 1)} className="w-7 h-7 rounded-full flex items-center justify-center text-base font-bold touch-manipulation" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>+</button>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white/80 truncate">{item.product_name}</p>
                      <p className="text-xs text-white/30">{item.color}</p>
                    </div>
                  </div>
                
                </div>
              ))}
              {comboCart.map((item) => (
                <div key={item.combo_id} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => updateComboQty(item.combo_id, item.quantity - 1)} className="w-7 h-7 rounded-full flex items-center justify-center text-base font-bold touch-manipulation" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>−</button>
                      <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                      <button onClick={() => updateComboQty(item.combo_id, item.quantity + 1)} className="w-7 h-7 rounded-full flex items-center justify-center text-base font-bold touch-manipulation" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>+</button>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white/80 truncate">🎁 {item.combo_name}</p>
                      <p className="text-xs text-white/30">Combo</p>
                    </div>
                  </div>
                
                </div>
              ))}
              <div className="flex justify-between pt-3">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-white text-base">S/ {total.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-3 mt-4 pb-8">
              <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl font-semibold touch-manipulation" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>← Atrás</button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 py-4 rounded-xl text-white font-bold disabled:opacity-50 touch-manipulation active:opacity-80"
                style={{ backgroundColor: btnColor }}>
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Enviando...
                  </span>
                ) : 'Confirmar pedido ✓'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}