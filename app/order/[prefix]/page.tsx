'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Store = {
  id: string
  name: string
  store_prefix: string
  theme_color: string
  logo_url: string
  uses_agency_delivery: boolean
  order_counter: number
  form_active: boolean
}

type Product = {
  id: string
  name: string
  category: string
  sale_price: number
  variants: { id: string; color: string; stock: number }[]
}

type Agency = {
  id: string
  agency_name: string
  destinations: string[]
  is_active: boolean
}

type CartItem = {
  product_id: string
  variant_id: string
  product_name: string
  color: string
  quantity: number
  unit_price: number
}

function MapPicker({
  lat,
  lng,
  onSelect,
  themeColor,
}: {
  lat: number | null
  lng: number | null
  onSelect: (lat: number, lng: number) => void
  themeColor: string
}) {
  const mapRef = useRef<any>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)

  useEffect(() => {
    initMap()
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!lat || !lng || !mapInstanceRef.current) return
    import('leaflet').then((L) => {
      const map = mapInstanceRef.current
      map.setView([lat, lng], 16)
      if (markerRef.current) markerRef.current.remove()
      const icon = L.divIcon({
        className: '',
        html: '<div style="background:' + themeColor + ';width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      })
      markerRef.current = L.marker([lat, lng], { icon }).addTo(map)
    })
  }, [lat, lng, themeColor])

  const initMap = async () => {
    if (typeof window === 'undefined') return
    if (mapInstanceRef.current) return
    if (!mapRef.current) return
    const L = await import('leaflet')
    await import('leaflet/dist/leaflet.css' as any)
    if ((mapRef.current as any)._leaflet_id) {
      ;(mapRef.current as any)._leaflet_id = null
    }
    const map = L.map(mapRef.current).setView([-8.1116, -79.0286], 14)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map)
    map.on('click', (e: any) => {
      const { lat, lng } = e.latlng
      if (markerRef.current) markerRef.current.remove()
      const icon = L.divIcon({
        className: '',
        html: '<div style="background:' + themeColor + ';width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      })
      markerRef.current = L.marker([lat, lng], { icon }).addTo(map)
      onSelect(lat, lng)
    })
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        map.setView([pos.coords.latitude, pos.coords.longitude], 16)
      })
    }
    mapInstanceRef.current = map
  }

  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          if (!navigator.geolocation) { alert('Tu navegador no soporta geolocalización'); return }
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude } = pos.coords
              const map = mapInstanceRef.current
              if (map) {
                map.setView([latitude, longitude], 17)
                import('leaflet').then((L) => {
                  if (markerRef.current) markerRef.current.remove()
                  const icon = L.divIcon({
                    className: '',
                    html: '<div style="background:' + themeColor + ';width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>',
                    iconSize: [22, 22],
                    iconAnchor: [11, 11],
                  })
                  markerRef.current = L.marker([latitude, longitude], { icon }).addTo(map)
                  onSelect(latitude, longitude)
                })
              }
            },
            () => alert('No se pudo obtener tu ubicación')
          )
        }}
        className="w-full mb-3 py-3 rounded-xl text-sm font-semibold border-2 border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-gray-100 flex items-center justify-center gap-2 touch-manipulation"
      >
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
  const [cart, setCart] = useState<CartItem[]>([])
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([])
  const [orderCode, setOrderCode] = useState('')
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [formDisabled, setFormDisabled] = useState(false)

  const [customer, setCustomer] = useState({ dni: '', name: '', phone: '' })
  const [delivery, setDelivery] = useState({
    method: 'motorizado',
    destination: '',
    reference: '',
    lat: '',
    lng: '',
    agency_name: '',
  })

  useEffect(() => { loadStore() }, [prefix])

  const loadStore = async () => {
    try {
      const supabase = createClient()
      const { data: storeData } = await supabase
        .from('stores')
        .select('*')
        .eq('store_prefix', prefix)
        .eq('status', 'active')
        .single()

      if (!storeData) { setLoading(false); return }

      // Verificar si el formulario está activo
      if (storeData.form_active === false) {
        setStore(storeData)
        setFormDisabled(true)
        setLoading(false)
        return
      }

      setStore(storeData)

      const { data: prods } = await supabase
        .from('products')
        .select('*, product_variants(*)')
        .eq('store_id', storeData.id)
        .eq('is_active', true)

      const { data: agencyData } = await supabase
        .from('delivery_agencies')
        .select('*')
        .eq('store_id', storeData.id)
        .eq('is_active', true)

      setAgencies(agencyData || [])
      setProducts((prods || []).map((p: any) => ({ ...p, variants: p.product_variants || [] })))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const addToCart = (product: Product, variant: { id: string; color: string; stock: number }) => {
    const existing = cart.find((c) => c.variant_id === variant.id)
    if (existing) {
      setCart(cart.map((c) => c.variant_id === variant.id ? { ...c, quantity: c.quantity + 1 } : c))
    } else {
      setCart([...cart, {
        product_id: product.id,
        variant_id: variant.id,
        product_name: product.name,
        color: variant.color,
        quantity: 1,
        unit_price: product.sale_price,
      }])
    }
  }

  const removeFromCart = (variantId: string) => {
    setCart(cart.filter((c) => c.variant_id !== variantId))
  }

  const updateQty = (variantId: string, qty: number) => {
    if (qty <= 0) { removeFromCart(variantId); return }
    setCart(cart.map((c) => (c.variant_id === variantId ? { ...c, quantity: qty } : c)))
  }

  const total = cart.reduce((sum, c) => sum + c.unit_price * c.quantity, 0)

  const handleSubmit = async () => {
    if (!store) return
    if (cart.length === 0) { alert('Agrega al menos un producto'); return }
    if (!customer.name || !customer.phone) { alert('Completa tu nombre y celular'); return }
    if (delivery.method === 'agencia' && !delivery.agency_name) { alert('Selecciona una agencia'); return }
    if (!delivery.destination) { alert('Indica tu dirección o destino de entrega'); return }

    setSubmitting(true)
    try {
      const supabase = createClient()

      const { data: existingCustomer } = await supabase
        .from('customers').select('id')
        .eq('store_id', store.id).eq('phone', customer.phone).single()

      let customerId = existingCustomer?.id
      if (!customerId) {
        const { data: newCustomer } = await supabase
          .from('customers')
          .insert({ store_id: store.id, name: customer.name, phone: customer.phone, dni: customer.dni })
          .select('id').single()
        customerId = newCustomer?.id
      }

      const year = new Date().getFullYear()
      const { data: counterData } = await supabase.rpc('increment_order_counter', { p_store_id: store.id })
      const code = store.store_prefix + '-' + year + '-' + String(counterData).padStart(3, '0')
      const token = Math.random().toString(36).substring(2, 15)

      const { data: order } = await supabase
        .from('orders')
        .insert({
          store_id: store.id,
          customer_id: customerId,
          order_code: code,
          delivery_method: delivery.method,
          agency_name: delivery.method === 'agencia' ? delivery.agency_name : null,
          destination: delivery.destination,
          reference: delivery.reference || null,
          lat: delivery.method === 'motorizado' && delivery.lat ? Number(delivery.lat) : null,
          lng: delivery.method === 'motorizado' && delivery.lng ? Number(delivery.lng) : null,
          total_amount: total,
          pending_amount: total,
          status: 'pending',
          tracking_token: token,
        })
        .select('id').single()

      if (order) {
        await supabase.from('order_items').insert(
          cart.map((c) => ({
            order_id: order.id,
            product_id: c.product_id,
            variant_id: c.variant_id,
            product_name: c.product_name,
            color: c.color,
            quantity: c.quantity,
            unit_price: c.unit_price,
            subtotal: c.unit_price * c.quantity,
          }))
        )
        for (const item of cart) {
          if (item.variant_id) {
            await supabase.rpc('decrement_stock', { p_variant_id: item.variant_id, p_qty: item.quantity })
          }
        }
        setOrderCode(code)
        setStep(4)
      }
    } catch (e) {
      console.error(e)
      alert('Error al enviar el pedido, intenta de nuevo')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Cargando tienda...</p>
        </div>
      </div>
    )
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <p className="text-5xl mb-4">🔍</p>
          <p className="text-gray-700 font-semibold text-lg">Tienda no encontrada</p>
          <p className="text-gray-500 text-sm mt-1">Verifica el enlace e intenta de nuevo</p>
        </div>
      </div>
    )
  }

  // Formulario desactivado
  if (formDisabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          {store.logo_url && (
            <img src={store.logo_url} alt="Logo" className="w-16 h-16 rounded-2xl object-cover mx-auto mb-4" />
          )}
          <p className="text-4xl mb-3">🚫</p>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{store.name}</h2>
          <p className="text-gray-500 text-sm">
            No estamos recibiendo pedidos en este momento.
          </p>
          <p className="text-gray-400 text-xs mt-2">
            Intenta más tarde o contacta directamente a la tienda.
          </p>
        </div>
      </div>
    )
  }

  // ─── PASO 4: CONFIRMACIÓN ───────────────────────────────────────────────────
  if (step === 4) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✅</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">¡Pedido recibido!</h2>
          <p className="text-gray-500 text-sm mb-4">Tu código de pedido es:</p>
          <div className="bg-gray-100 rounded-xl px-4 py-4 mb-4">
            <span className="text-xl sm:text-2xl font-bold text-gray-900 tracking-wide">{orderCode}</span>
          </div>
          <p className="text-gray-400 text-xs mb-6">Guarda este código para rastrear tu pedido.</p>
          <a
            href={`/track?code=${orderCode}`}
            className="w-full py-4 rounded-xl text-white font-bold block text-center text-base touch-manipulation"
            style={{ backgroundColor: store.theme_color || '#2563eb' }}
          >
            🔍 Rastrear mi pedido
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 shadow-sm" style={{ backgroundColor: store.theme_color || '#2563eb' }}>
        <div className="flex items-center justify-center gap-2 pt-3 pb-2 px-4">
          {store.logo_url && (
            <img src={store.logo_url} alt="Logo" className="w-8 h-8 rounded-full object-cover border-2 border-white border-opacity-60 flex-shrink-0" />
          )}
          <h1 className="text-white font-bold text-base truncate">{store.name}</h1>
        </div>
        <div className="px-4 pb-3 flex items-center justify-center gap-1">
          {['Productos', 'Tus datos', 'Entrega'].map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div
                className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${step >= i + 1 ? 'bg-white' : 'bg-white bg-opacity-30'}`}
                style={{ color: step >= i + 1 ? store.theme_color || '#2563eb' : 'white' }}
              >
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className={`text-white text-xs font-medium ${step === i + 1 ? 'opacity-100' : 'opacity-60'}`}>{s}</span>
              {i < 2 && <span className="text-white opacity-40 text-xs mx-0.5">›</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 pb-32">

        {step === 1 && (
          <div>
            <h2 className="text-base font-bold text-gray-900 mb-3">Elige tus productos</h2>
            {products.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center">
                <p className="text-gray-400 text-sm">No hay productos disponibles</p>
              </div>
            ) : (
              <div className="space-y-3">
                {products.map((product) => (
                  <div key={product.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0 pr-3">
                        <h3 className="font-semibold text-gray-900 text-sm leading-snug">{product.name}</h3>
                        {product.category && <p className="text-xs text-gray-400 mt-0.5">{product.category}</p>}
                      </div>
                      <span className="font-bold text-gray-900 text-sm flex-shrink-0">S/ {Number(product.sale_price).toFixed(2)}</span>
                    </div>
                    {product.variants.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {product.variants.map((v) => {
                          const inCart = cart.find((c) => c.variant_id === v.id)
                          return (
                            <button key={v.id} onClick={() => addToCart(product, v)}
                              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors touch-manipulation ${inCart ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 active:bg-gray-50'}`}>
                              {v.color} {inCart ? `✓ ${inCart.quantity}` : ''}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <button onClick={() => addToCart(product, { id: product.id, color: 'Único', stock: 99 })}
                        className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 active:bg-gray-50 touch-manipulation">
                        + Agregar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {cart.length > 0 && (
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg safe-area-bottom">
                <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500">{cart.reduce((s, c) => s + c.quantity, 0)} producto{cart.reduce((s, c) => s + c.quantity, 0) !== 1 ? 's' : ''}</p>
                    <p className="font-bold text-gray-900 text-base">S/ {total.toFixed(2)}</p>
                  </div>
                  <button onClick={() => setStep(2)}
                    className="px-6 py-3 rounded-xl text-white font-bold text-sm flex-shrink-0 touch-manipulation active:opacity-80"
                    style={{ backgroundColor: store.theme_color || '#2563eb' }}>
                    Continuar →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-base font-bold text-gray-900 mb-3">Tus datos</h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DNI <span className="text-gray-400 font-normal">(opcional)</span></label>
                <input type="number" inputMode="numeric" value={customer.dni}
                  onChange={(e) => setCustomer({ ...customer, dni: e.target.value })}
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="12345678" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo <span className="text-red-500">*</span></label>
                <input type="text" autoCapitalize="words" value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Juan Pérez" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Celular <span className="text-red-500">*</span></label>
                <input type="tel" inputMode="tel" value={customer.phone}
                  onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="999 999 999" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl font-semibold border border-gray-200 text-gray-700 touch-manipulation">← Atrás</button>
              <button onClick={() => { if (!customer.name || !customer.phone) { alert('Nombre y celular son obligatorios'); return } setStep(3) }}
                className="flex-1 py-3 rounded-xl text-white font-bold touch-manipulation active:opacity-80"
                style={{ backgroundColor: store.theme_color || '#2563eb' }}>
                Continuar →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-base font-bold text-gray-900 mb-3">Datos de entrega</h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Método de entrega</label>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => setDelivery((prev) => ({ ...prev, method: 'motorizado', agency_name: '', destination: '', lat: '', lng: '' }))}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-colors touch-manipulation ${delivery.method === 'motorizado' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                    🛵 Motorizado
                  </button>
                  {agencies.length > 0 && (
                    <button type="button"
                      onClick={() => setDelivery((prev) => ({ ...prev, method: 'agencia', lat: '', lng: '' }))}
                      className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-colors touch-manipulation ${delivery.method === 'agencia' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                      📦 Agencia
                    </button>
                  )}
                </div>
              </div>

              {delivery.method === 'motorizado' ? (
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección <span className="text-red-500">*</span></label>
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
                    className="w-full px-3 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Agencia <span className="text-red-500">*</span></label>
                    <select value={delivery.agency_name || ''}
                      onChange={(e) => setDelivery((prev) => ({ ...prev, agency_name: e.target.value, destination: '' }))}
                      className="w-full px-3 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Selecciona una agencia</option>
                      {agencies.map((a) => <option key={a.id} value={a.agency_name}>{a.agency_name}</option>)}
                    </select>
                  </div>
                  {delivery.agency_name && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Destino <span className="text-red-500">*</span></label>
                      {agencies.find((a) => a.agency_name === delivery.agency_name)?.destinations?.length ? (
                        <select value={delivery.destination}
                          onChange={(e) => setDelivery((prev) => ({ ...prev, destination: e.target.value }))}
                          className="w-full px-3 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="">Selecciona destino</option>
                          {agencies.find((a) => a.agency_name === delivery.agency_name)?.destinations.map((d: string) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      ) : (
                        <input type="text" value={delivery.destination}
                          onChange={(e) => setDelivery((prev) => ({ ...prev, destination: e.target.value }))}
                          className="w-full px-3 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Ciudad o distrito de destino" />
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Referencia <span className="text-gray-400 font-normal">(opcional)</span></label>
                <input type="text" value={delivery.reference}
                  onChange={(e) => setDelivery({ ...delivery, reference: e.target.value })}
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Casa azul, frente al parque" />
              </div>

              {delivery.method === 'motorizado' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación en mapa <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <p className="text-xs text-gray-400 mb-2">Toca el mapa para marcar tu ubicación exacta</p>
                  <MapPicker
                    lat={delivery.lat ? parseFloat(delivery.lat) : null}
                    lng={delivery.lng ? parseFloat(delivery.lng) : null}
                    onSelect={(lat, lng) => setDelivery((prev) => ({ ...prev, lat: String(lat), lng: String(lng) }))}
                    themeColor={store?.theme_color || '#2563eb'}
                  />
                  {delivery.lat && delivery.lng && <p className="text-xs text-green-600 mt-2 font-medium">✅ Ubicación marcada</p>}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mt-4">
              <h3 className="font-bold text-gray-900 mb-3 text-sm">Resumen del pedido</h3>
              {cart.map((item) => (
                <div key={item.variant_id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => updateQty(item.variant_id, item.quantity - 1)} className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 text-base font-bold flex items-center justify-center touch-manipulation active:bg-gray-200">−</button>
                      <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                      <button onClick={() => updateQty(item.variant_id, item.quantity + 1)} className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 text-base font-bold flex items-center justify-center touch-manipulation active:bg-gray-200">+</button>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.product_name}</p>
                      <p className="text-xs text-gray-400">{item.color}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900 flex-shrink-0 ml-2">S/ {(item.unit_price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-3">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-gray-900 text-base">S/ {total.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-3 mt-4 pb-8">
              <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl font-semibold border border-gray-200 text-gray-700 touch-manipulation">← Atrás</button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 py-4 rounded-xl text-white font-bold disabled:opacity-50 touch-manipulation active:opacity-80"
                style={{ backgroundColor: store?.theme_color || '#2563eb' }}>
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