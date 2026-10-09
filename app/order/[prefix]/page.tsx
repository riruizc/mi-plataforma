'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { dmSans } from '@/lib/fonts'
import { buildOrderMessage, buildWhatsAppUrl, isValidPeruMobile } from '@/lib/whatsapp'
import { buscarDestinos, claveDestino, textoDestino, type DestinoDetalle } from '@/lib/destinos'

type Store = {
  id: string; name: string; store_prefix: string; theme_color: string
  button_color?: string; text_color?: string
  logo_url: string; form_active: boolean
  // Número de WhatsApp de la tienda, al que el cliente envía su pedido.
  // Es nullable en la BD: el registro no lo exige.
  phone: string | null
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
// El detalle de destinos NO viaja en esta carga: son ~500 sedes por agencia y
// la mayoría de clientes pide por motorizado. Se trae solo al elegir agencia.
type Agency = { id: string; agency_name: string; offers_air: boolean }
/** Clave de sessionStorage donde se rescata el pedido recién enviado. */
const WA_STORAGE_KEY = (prefix: string) => `pedidospe:wa:${prefix}`

type CartItem = {
  product_id: string; variant_id: string; product_name: string; color: string; quantity: number; unit_price: number
}
type ComboCartItem = {
  combo_id: string; combo_name: string; quantity: number; unit_price: number; items: ComboItem[]
}

/**
 * Buscador de sedes de agencia.
 *
 * El cliente SOLO puede elegir una sede de la lista: escribir filtra, pero no
 * permite enviar texto libre. Antes `onChange` se disparaba con cada tecla, así
 * que un destino inventado llegaba al pedido tal cual.
 *
 * Cuando la agencia no tiene sedes configuradas, el formulario usa el input
 * libre de siempre (ver más abajo, fuera de este componente).
 */
function AgencyDestinationSearch({ destinos, offersAir, seleccion, onSelect, onClear, loading, themeColor, textColor }: {
  destinos: DestinoDetalle[]
  offersAir: boolean
  /** Sede elegida y si va por aéreo. `null` mientras no haya elección. */
  seleccion: { destino: DestinoDetalle; aereo: boolean } | null
  onSelect: (destino: DestinoDetalle, aereo: boolean) => void
  onClear: () => void
  loading: boolean
  themeColor: string
  textColor: string
}) {
  const [query, setQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const filtered = buscarDestinos(destinos, query, 20)

  if (loading) return (
    <div className="w-full px-3 py-3 rounded-xl text-sm text-gray-500 flex items-center gap-2"
      style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.1)' }}>
      <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
      Cargando destinos...
    </div>
  )

  // ── Sede ya elegida: tarjeta con su dirección ───────────────────────────
  if (seleccion) {
    const { destino, aereo } = seleccion
    const puedeAereo = offersAir && destino.aereo
    return (
      <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.04)', border: `1.5px solid ${themeColor}` }}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm text-gray-900">{destino.sede}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {destino.distrito}, {destino.provincia} · {destino.departamento}
            </p>
            {destino.direccion && <p className="text-xs text-gray-700 mt-1">{destino.direccion}</p>}
            {destino.referencia && <p className="text-xs text-gray-400 mt-0.5">Ref: {destino.referencia}</p>}
          </div>
          <button type="button" onClick={onClear}
            className="text-gray-400 text-xl leading-none flex-shrink-0 touch-manipulation px-1">×</button>
        </div>

        {/* Solo se ofrece aéreo si la agencia lo activó Y la sede lo acepta. */}
        {puedeAereo && (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
            <p className="text-xs font-medium mb-2 text-gray-600">Tipo de envío</p>
            <div className="flex gap-2">
              {([false, true] as const).map(esAereo => (
                <button key={String(esAereo)} type="button"
                  onClick={() => onSelect(destino, esAereo)}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-all touch-manipulation"
                  style={aereo === esAereo
                    ? { borderColor: themeColor, background: themeColor, color: textColor }
                    : { borderColor: '#e5e7eb', color: '#6b7280', background: '#fff' }}>
                  {esAereo ? 'Aéreo' : 'Terrestre'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Buscador ────────────────────────────────────────────────────────────
  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setShowSuggestions(true) }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        placeholder="Busca por distrito, sede o dirección..."
        className="w-full px-3 py-3 rounded-xl text-base focus:outline-none focus:ring-1 text-gray-900"
        style={{ background: "rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.15)" }}
      />
      {query && (
        <button type="button" onClick={() => setQuery('')}
          className="absolute right-3 top-[22px] -translate-y-1/2 text-gray-400 text-xl">×</button>
      )}

      {showSuggestions && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-64 overflow-y-auto">
          {filtered.map((d, i) => (
            <button key={claveDestino(d) + i} type="button"
              onMouseDown={() => { onSelect(d, false); setQuery(''); setShowSuggestions(false) }}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0 touch-manipulation">
              <p className="text-sm font-semibold text-gray-800">{d.sede}</p>
              <p className="text-xs text-gray-500">{d.distrito}, {d.provincia} · {d.departamento}</p>
              {d.direccion && <p className="text-xs text-gray-400 truncate">{d.direccion}</p>}
            </button>
          ))}
        </div>
      )}

      {showSuggestions && query.trim().length >= 2 && filtered.length === 0 && (
        <div className="absolute z-50 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow mt-1 px-4 py-3">
          <p className="text-sm text-gray-400">No se encontraron destinos</p>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-1">
        Debes elegir una sede de la lista
      </p>
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
    // Lima, Perú como centro por defecto
    const map = L.map(mapRef.current).setView([-12.0464, -77.0428], 13)
    // Tiles de Esri — más actualizados en Lima y Perú
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri'
    }).addTo(map)
    map.on('click', (e: any) => {
      const { lat, lng } = e.latlng
      if (markerRef.current) markerRef.current.remove()
      const icon = L.divIcon({ className: '', html: '<div style="background:' + themeColor + ';width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>', iconSize: [22, 22], iconAnchor: [11, 11] })
      markerRef.current = L.marker([lat, lng], { icon }).addTo(map)
      onSelect(lat, lng)
    })
    mapInstanceRef.current = map
    // Auto-geolocalizar al abrir el mapa
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords
          map.setView([latitude, longitude], 17)
          const icon = L.divIcon({ className: '', html: '<div style="background:' + themeColor + ';width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>', iconSize: [22, 22], iconAnchor: [11, 11] })
          if (markerRef.current) markerRef.current.remove()
          markerRef.current = L.marker([latitude, longitude], { icon }).addTo(map)
          onSelect(latitude, longitude)
        },
        () => { /* Si el usuario no da permisos, queda en Lima */ },
        { timeout: 8000, enableHighAccuracy: true }
      )
    }
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

  // Enlace wa.me del pedido ya registrado. Se guarda también en sessionStorage
  // para que el botón siga disponible si el cliente recarga la pantalla final.
  const [waUrl, setWaUrl] = useState<string | null>(null)
  // true cuando el navegador bloqueó la apertura automática: entonces se
  // resalta el botón manual, que al venir de un toque nunca se bloquea.
  const [waBlocked, setWaBlocked] = useState(false)
  const [phoneError, setPhoneError] = useState('')

  // Destinos de la agencia elegida. Se cargan bajo demanda (ver cargarDestinos).
  const [agencyDestinos, setAgencyDestinos] = useState<DestinoDetalle[]>([])
  const [loadingDestinos, setLoadingDestinos] = useState(false)
  // Sede elegida + si va por aéreo. `delivery.destination` se deriva de aquí.
  const [destinoSel, setDestinoSel] = useState<{ destino: DestinoDetalle; aereo: boolean } | null>(null)
  // true = la agencia no tiene sedes configuradas: se permite texto libre.
  const [destinoLibre, setDestinoLibre] = useState(false)

  // Antes este timer vivía en (window as any)._geocodeTimer: estado global
  // compartido y sin limpieza al desmontar, así que un debounce en vuelo
  // llamaba a setAddressSuggestions sobre un componente ya desmontado.
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { loadStore() }, [prefix])

  useEffect(() => () => { if (geocodeTimer.current) clearTimeout(geocodeTimer.current) }, [])

  // Si el cliente recarga la pantalla final, el estado de React se pierde y con
  // él el botón de WhatsApp — aunque el pedido ya esté guardado. Se rescata de
  // sessionStorage (por pestaña, se borra al cerrarla).
  //
  // El límite de 30 minutos evita que una pestaña vieja resucite el pedido
  // anterior cuando el cliente vuelve a entrar a hacer uno nuevo.
  useEffect(() => {
    if (!prefix) return
    try {
      const guardado = sessionStorage.getItem(WA_STORAGE_KEY(prefix))
      if (!guardado) return
      const { orderCode: code, waUrl: url, ts } = JSON.parse(guardado)
      if (!code || !ts || Date.now() - ts > 30 * 60 * 1000) {
        sessionStorage.removeItem(WA_STORAGE_KEY(prefix))
        return
      }
      setOrderCode(code)
      setWaUrl(url ?? null)
      setStep(4)
    } catch {
      // sessionStorage puede fallar en modo privado o con JSON corrupto.
      // No es crítico: solo se pierde el rescate del botón.
    }
  }, [prefix])

  const loadStore = async () => {
    try {
      const supabase = createClient()
      // Columnas explícitas, nunca '*': esta página es pública y sin auth.
      // Con select('*') se enviaban al navegador de cualquier visitante el
      // email del dueño, origin_lat/lng (la dirección física del negocio),
      // expires_at y order_counter (el volumen de ventas de la tienda).
      // maybeSingle en vez de single: si un prefijo estuviera duplicado,
      // .single() lanza PGRST116 y la tienda aparecía como "no encontrada".
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        // `phone` es el número al que el cliente manda su pedido por WhatsApp.
        // No es un dato privado: ya se expone en /contact y /wholesale, donde
        // cumple exactamente la misma función. No se añade ninguna otra columna.
        .select('id, name, store_prefix, theme_color, button_color, text_color, logo_url, form_active, phone')
        .eq('store_prefix', prefix)
        .eq('status', 'active')
        .maybeSingle()

      if (storeError) { console.error('[order] store:', storeError); setLoading(false); return }
      if (!storeData) { setLoading(false); return }

      if (storeData.form_active === false) {
        setStore(storeData); setFormDisabled(true); setLoading(false); return
      }

      setStore(storeData)

      const [{ data: prods }, { data: agencyData }, { data: combosData }] =
        await Promise.all([
          // Sin '*': traía cost_price, o sea el precio de compra de la tienda,
          // visible para cualquier cliente que abriera las DevTools.
          supabase.from('products').select('id, name, category, sale_price, image_url, product_variants(id, color, stock)').eq('store_id', storeData.id).eq('is_active', true).eq('show_in_form', true),
          // Sin destinations ni destinations_detail: son cientos de filas que
          // la mayoría de clientes (los de motorizado) nunca va a usar.
          supabase.from('delivery_agencies').select('id, agency_name, offers_air').eq('store_id', storeData.id).eq('is_active', true),
          supabase.from('combos').select('*').eq('store_id', storeData.id).eq('is_active', true).order('name'),
        ])

      setAgencies(agencyData || [])
      setProducts((prods || []).map((p: any) => ({ ...p, variants: (p.product_variants || []).filter((v: any) => v.stock > 0) })))

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

  /**
   * Trae los destinos de una agencia la primera vez que el cliente la elige.
   *
   * Mantener esto fuera de la carga inicial evita descargar ~500 sedes a quien
   * pide por motorizado, que es la mayoría.
   */
  const cargarDestinos = async (agencyName: string) => {
    setDestinoSel(null)
    setAgencyDestinos([])
    setDestinoLibre(false)
    setDelivery(prev => ({ ...prev, agency_name: agencyName, destination: '' }))
    if (!agencyName || !store) return

    setLoadingDestinos(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('delivery_agencies')
        .select('destinations, destinations_detail')
        .eq('store_id', store.id)
        .eq('agency_name', agencyName)
        .eq('is_active', true)
        .maybeSingle()

      if (error) { console.error('[order] destinos:', error); setDestinoLibre(true); return }

      const detalle = (data?.destinations_detail || []) as DestinoDetalle[]
      const activos = detalle.filter(d => d?.activo)

      if (activos.length > 0) {
        setAgencyDestinos(activos)
      } else {
        // Agencia aún sin importar su CSV: si tiene la lista de texto antigua
        // no se puede mostrar el detalle, así que se deja escribir libremente,
        // igual que antes de este cambio.
        setDestinoLibre(true)
      }
    } finally {
      setLoadingDestinos(false)
    }
  }

  /** Aplica la sede elegida al pedido, con el texto canónico de siempre. */
  const elegirDestino = (destino: DestinoDetalle, aereo: boolean) => {
    setDestinoSel({ destino, aereo })
    setDelivery(prev => ({ ...prev, destination: textoDestino(destino, aereo) }))
  }

  const limpiarDestino = () => {
    setDestinoSel(null)
    setDelivery(prev => ({ ...prev, destination: '' }))
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
    if (!customer.name) { alert('Completa tu nombre'); return }
    if (!isValidPeruMobile(customer.phone)) {
      alert('Ingresa un número de WhatsApp válido: 9 dígitos que empiecen con 9')
      return
    }
    if (delivery.method === 'agencia' && !delivery.agency_name) { alert('Selecciona una agencia'); return }
    // Si la agencia tiene sedes configuradas hay que elegir una de la lista:
    // escribir solo sirve para filtrar. El servidor valida lo mismo.
    if (delivery.method === 'agencia' && !destinoLibre && !destinoSel) {
      alert('Elige la sede de la agencia donde recogerás tu pedido')
      return
    }
    if (!delivery.destination) { alert('Indica tu dirección o destino de entrega'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storePrefix: prefix,
          customer,
          delivery,
          cart: cart.map(c => ({ product_id: c.product_id, variant_id: c.variant_id || null, quantity: c.quantity })),
          comboCart: comboCart.map(c => ({ combo_id: c.combo_id, quantity: c.quantity })),
        }),
      })
      const data = await res.json()

      // El pedido manda: si no se guardó, NO se abre WhatsApp y el cliente
      // conserva su carrito para reintentar.
      if (!res.ok || !data.order_code) {
        alert(data.error || 'Error al enviar el pedido, intenta de nuevo')
        return
      }

      // ── El pedido YA está guardado. A partir de aquí, WhatsApp es un extra:
      // nada de lo que siga puede hacer fracasar el pedido. ───────────────
      setOrderCode(data.order_code)

      const mensaje = buildOrderMessage({
        orderCode: data.order_code,
        customer,
        cart,
        comboCart,
        delivery,
      })
      const url = buildWhatsAppUrl(store.phone, mensaje)
      setWaUrl(url)
      setStep(4)

      if (url) {
        try {
          sessionStorage.setItem(
            WA_STORAGE_KEY(prefix),
            JSON.stringify({ orderCode: data.order_code, waUrl: url, ts: Date.now() })
          )
        } catch { /* modo privado: solo se pierde el rescate tras recargar */ }

        // Intento de apertura automática. Al venir después de un `await`, el
        // navegador ya no lo considera un gesto directo del usuario y puede
        // bloquearlo. Si pasa, se marca para resaltar el botón manual — ése
        // sí nace de un toque y nunca se bloquea.
        const ventana = window.open(url, '_blank')
        if (!ventana || ventana.closed) setWaBlocked(true)
      }
    } catch (e) { console.error(e); alert('Error al enviar el pedido, intenta de nuevo') }
    finally { setSubmitting(false) }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>Cargando tienda...</p>
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
  const cardBg = '#ffffff'
  const cardBorder = '#e5e7eb'
  const primaryText = '#111827'
  const secondaryText = '#6b7280'

  if (step === 4) return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${dmSans.className}`} style={{ background: '#f9fafb' }}>
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-sm">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <span className="text-3xl">✅</span>
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: primaryText }}>¡Pedido recibido!</h2>
        <p className="text-sm mb-4" style={{ color: secondaryText }}>Tu código de pedido es:</p>
        <div className="bg-gray-100 rounded-2xl px-4 py-4 mb-4">
          <span className="text-xl font-bold tracking-widest font-mono" style={{ color: btnColor }}>{orderCode}</span>
        </div>

        {waUrl ? (
          <>
            <p className="text-sm mb-4" style={{ color: secondaryText }}>
              {waBlocked
                ? 'Toca el botón para enviarnos tu pedido por WhatsApp:'
                : 'Ya casi. Envíanos tu pedido por WhatsApp para confirmarlo:'}
            </p>
            {/* Verde WhatsApp: el mismo que ya usa el catálogo mayorista.
                Es la acción que el cliente debe reconocer al instante. */}
            <a href={waUrl} target="_blank" rel="noopener noreferrer"
              className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-center text-base touch-manipulation text-white mb-3"
              style={{ background: '#25d366', boxShadow: '0 4px 20px rgba(37,211,102,0.35)' }}>
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Enviar mi pedido por WhatsApp
            </a>
            {!waBlocked && (
              <p className="text-xs mb-4" style={{ color: secondaryText }}>
                Si WhatsApp no se abrió solo, toca el botón
              </p>
            )}
            <a href={`/track?code=${orderCode}`}
              className="w-full py-3 rounded-2xl font-semibold block text-center text-sm touch-manipulation"
              style={{ background: cardBg, border: `1px solid ${cardBorder}`, color: secondaryText }}>
              Rastrear mi pedido →
            </a>
          </>
        ) : (
          <>
            <p className="text-xs mb-6" style={{ color: secondaryText }}>Guarda este código para rastrear tu pedido</p>
            <a href={`/track?code=${orderCode}`}
              className="w-full py-4 rounded-2xl font-bold block text-center text-base touch-manipulation"
              style={{ background: btnColor, color: txtColor }}>
              Rastrear mi pedido →
            </a>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className={`min-h-screen ${dmSans.className}`} style={{ background: '#f9fafb' }}>
      {/* HEADER */}
      <div className="sticky top-0 z-10" style={{ backgroundColor: color }}>
        <div className="max-w-lg mx-auto px-4 pt-3 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              {store.logo_url && <img src={store.logo_url} alt="Logo" className="w-8 h-8 rounded-xl object-cover flex-shrink-0" style={{ border: `1.5px solid ${color}40` }} />}
              <h1 className="font-bold text-sm truncate text-white">{store.name}</h1>
            </div>
          </div>
          <div className="flex items-center justify-center gap-1 pb-3">
            {['Productos', 'Tus datos', 'Entrega'].map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all"
                  style={{ background: step >= i + 1 ? btnColor : 'rgba(255,255,255,0.3)', color: step >= i + 1 ? txtColor : secondaryText }}>
                  {step > i + 1 ? '✓' : i + 1}
                </div>
                <span className="text-xs font-medium" style={{ color: step === i + 1 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.6)' }}>{s}</span>
                {i < 2 && <span className="text-xs mx-0.5" style={{ color: secondaryText }}>›</span>}
              </div>
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="sticky z-9 px-4 pb-2" style={{ backgroundColor: color }}>
            <div className="relative mb-2">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">🔍</span>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar producto o combo..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm bg-white bg-opacity-95 text-gray-800 placeholder-gray-400 focus:outline-none border-0" />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-lg leading-none" style={{ color: secondaryText }}>×</button>}
            </div>
            {combos.length > 0 && (
              <div className="flex gap-2 pb-1">
                <button onClick={() => setActiveTab('products')}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={activeTab === 'products' ? { background: 'rgba(255,255,255,0.95)', color: '#1f2937' } : { background: 'rgba(255,255,255,0.15)', color: primaryText }}>
                  📦 Productos ({products.length})
                </button>
                <button onClick={() => setActiveTab('combos')}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={activeTab === 'combos' ? { background: 'rgba(255,255,255,0.95)', color: '#1f2937' } : { background: 'rgba(255,255,255,0.15)', color: primaryText }}>
                  🎁 Combos ({combos.length})
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FILTRO CATEGORÍA */}
      {step === 1 && activeTab === 'products' && categories.length > 2 && (
        <div className="sticky z-9 px-4 py-2 bg-white border-b border-gray-200">
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all touch-manipulation ${activeCategory === cat ? "border-transparent" : ""}`}
                style={activeCategory === cat ? { backgroundColor: btnColor, color: txtColor } : { borderColor: cardBorder, color: secondaryText }}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* El color por defecto es el texto oscuro de la página, no blanco: el
          fondo es #f9fafb y cualquier texto sin `style` propio quedaba
          invisible (blanco sobre blanco). */}
      <div className="max-w-lg mx-auto px-4 py-5 pb-32" style={{ color: primaryText }}>

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
                      <div key={product.id} className="rounded-2xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                        <div className="flex items-start gap-3 mb-3">
                          {product.image_url && (
                            <img src={product.image_url} alt={product.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-gray-100" />
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm leading-snug" style={{ color: primaryText }}>{product.name}</h3>
                            {product.category && <p className="text-xs mt-0.5" style={{ color: secondaryText }}>{product.category}</p>}
                          </div>
                        </div>
                        {product.variants.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {product.variants.map((v) => {
                              const inCart = cart.find((c) => c.variant_id === v.id && c.product_id === product.id)
                              return (
                                <button key={v.id} onClick={() => addToCart(product, v)}
                                  className="px-3 py-2 rounded-lg text-sm font-medium border transition-all touch-manipulation"
                                style={inCart ? { background: btnColor, color: txtColor, borderColor: btnColor } : { background: cardBg, color: secondaryText, borderColor: cardBorder }}>
                                  {v.color} {inCart ? `✓ ${inCart.quantity}` : ''}
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <button onClick={() => addToCart(product, { id: '', color: 'Único', stock: 99 })}
                            className="px-4 py-2 rounded-lg text-sm font-medium touch-manipulation" style={{ background: cardBg, border: `1px solid ${cardBorder}`, color: secondaryText }}>
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
                                <h3 className="font-semibold text-sm leading-snug" style={{ color: primaryText }}>{combo.name}</h3>
                              </div>
                              {combo.description && <p className="text-xs mt-0.5 ml-7" style={{ color: secondaryText }}>{combo.description}</p>}
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
                                  className="w-7 h-7 rounded-full flex items-center justify-center font-bold touch-manipulation" style={{ background: cardBg, color: secondaryText }}>−</button>
                                <span className="w-6 text-center text-sm font-semibold" style={{ color: primaryText }}>{inCart.quantity}</span>
                                <button onClick={() => updateComboQty(combo.id, inCart.quantity + 1)}
                                  className="w-7 h-7 rounded-full flex items-center justify-center font-bold touch-manipulation" style={{ background: cardBg, color: secondaryText }}>+</button>
                              </div>
                              <button onClick={() => removeComboFromCart(combo.id)} className="text-xs font-medium" style={{ color: "rgba(239,68,68,0.7)" }}>✕ Quitar</button>
                
                            </div>
                          ) : (
                            <button onClick={() => addComboToCart(combo)}
                              className="mt-2 px-4 py-2 rounded-lg text-sm font-medium touch-manipulation" style={{ background: cardBg, border: `1px solid ${cardBorder}`, color: secondaryText }}>
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
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
                <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs" style={{ color: secondaryText }}>{totalItems} item{totalItems !== 1 ? 's' : ''}</p>
                    <p className="font-bold text-base" style={{ color: primaryText }}>S/ {total.toFixed(2)}</p>
                  </div>
                  <button onClick={() => setStep(2)}
                    className="px-6 py-3 rounded-xl font-bold text-sm flex-shrink-0 touch-manipulation active:opacity-80"
                    style={{ backgroundColor: btnColor, color: txtColor }}>
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
            <h2 className="text-base font-bold mb-3" style={{ color: primaryText }}>Tus datos</h2>
            <div className="rounded-2xl p-4 space-y-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: secondaryText }}>DNI / CE <span className="text-gray-400 font-normal">(opcional)</span></label>
                <input type="text" inputMode="numeric" value={customer.dni}
                  onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= 12) setCustomer({ ...customer, dni: val }) }}
                  className="w-full px-3 py-3 rounded-xl text-base focus:outline-none focus:ring-1 text-gray-900" style={{ background: "rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.15)" }}
                  placeholder="DNI (8 dígitos) o CE (hasta 12)" maxLength={12} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: secondaryText }}>Nombre completo <span className="text-red-500">*</span></label>
                <input type="text" autoCapitalize="words" value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  className="w-full px-3 py-3 rounded-xl text-base focus:outline-none focus:ring-1 text-gray-900" style={{ background: "rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.15)" }} placeholder="Juan Pérez" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: secondaryText }}>Número de WhatsApp <span className="text-red-500">*</span></label>
                <input type="tel" inputMode="numeric" value={customer.phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '')
                    if (val.length <= 9) {
                      setCustomer({ ...customer, phone: val })
                      // El error se limpia al escribir y se vuelve a evaluar
                      // solo cuando el número ya está completo, para no regañar
                      // al cliente mientras teclea.
                      if (val.length === 0) setPhoneError('')
                      else if (!val.startsWith('9')) setPhoneError('El número debe empezar con 9')
                      else if (val.length === 9) setPhoneError('')
                      else setPhoneError('')
                    }
                  }}
                  onBlur={() => {
                    if (customer.phone && !isValidPeruMobile(customer.phone)) {
                      setPhoneError('Debe tener 9 dígitos y empezar con 9')
                    }
                  }}
                  className="w-full px-3 py-3 rounded-xl text-base focus:outline-none focus:ring-1 text-gray-900"
                  style={{ background: "rgba(0,0,0,0.06)", border: `1px solid ${phoneError ? '#ef4444' : 'rgba(0,0,0,0.15)'}` }}
                  placeholder="999 999 999" maxLength={9} />
                {phoneError
                  ? <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{phoneError}</p>
                  : <p className="text-xs mt-1" style={{ color: secondaryText }}>Ingresa el número de WhatsApp desde el que nos estás escribiendo</p>}
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl font-semibold touch-manipulation" style={{ background: cardBg, border: `1px solid ${cardBorder}`, color: secondaryText }}>← Atrás</button>
              <button onClick={() => {
                  if (!customer.name.trim()) { alert('Tu nombre es obligatorio'); return }
                  if (!isValidPeruMobile(customer.phone)) {
                    setPhoneError('Debe tener 9 dígitos y empezar con 9')
                    alert('Ingresa un número de WhatsApp válido: 9 dígitos que empiecen con 9')
                    return
                  }
                  setPhoneError('')
                  setStep(3)
                }}
                className="flex-1 py-3 rounded-xl font-bold touch-manipulation active:opacity-80"
                style={{ backgroundColor: btnColor, color: txtColor }}>
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* PASO 3 */}
        {step === 3 && (
          <div>
            <h2 className="text-base font-bold mb-3" style={{ color: primaryText }}>Datos de entrega</h2>
            <div className="rounded-2xl p-4 space-y-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: secondaryText }}>Método de entrega</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => {
                      // Al volver a motorizado se descarta la sede elegida: si no,
                      // quedaría un destino de agencia pegado a un pedido a domicilio.
                      setDestinoSel(null); setAgencyDestinos([]); setDestinoLibre(false)
                      setDelivery((prev) => ({ ...prev, method: 'motorizado', agency_name: '', destination: '', lat: '', lng: '' }))
                    }}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all touch-manipulation`}
                    style={delivery.method === 'motorizado' ? { borderColor: btnColor, background: btnColor + '15', color: primaryText } : { borderColor: cardBorder, color: secondaryText }}>
                    🛵 Motorizado
                  </button>
                  {agencies.length > 0 && (
                    <button type="button" onClick={() => {
                        setDestinoSel(null); setAgencyDestinos([]); setDestinoLibre(false)
                        setDelivery((prev) => ({ ...prev, method: 'agencia', destination: '', lat: '', lng: '' }))
                      }}
                      className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all touch-manipulation`}
                    style={delivery.method === 'agencia' ? { borderColor: btnColor, background: btnColor + '15', color: primaryText } : { borderColor: cardBorder, color: secondaryText }}>
                      📦 Agencia
                    </button>
                  )}
                </div>
              </div>

              {delivery.method === 'motorizado' ? (
                <div className="relative">
                  <label className="block text-sm font-medium mb-1" style={{ color: secondaryText }}>Dirección <span className="text-red-500">*</span></label>
                  <input type="text" autoComplete="street-address" value={delivery.destination}
                    onChange={(e) => {
                      const value = e.target.value
                      setDelivery((prev) => ({ ...prev, destination: value }))
                      if (value.length < 8) { setAddressSuggestions([]); return }
                      if (geocodeTimer.current) clearTimeout(geocodeTimer.current)
                      geocodeTimer.current = setTimeout(async () => {
                        try {
                          const res = await fetch('/api/geocode?q=' + encodeURIComponent(value))
                          if (!res.ok) { setAddressSuggestions([]); return }
                          const text = await res.text()
                          if (!text || text.trim() === '') { setAddressSuggestions([]); return }
                          setAddressSuggestions(JSON.parse(text))
                        } catch { setAddressSuggestions([]) }
                      }, 500)
                    }}
                    className="w-full px-3 py-3 rounded-xl text-base focus:outline-none focus:ring-1 text-gray-900" style={{ background: "rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.15)" }}
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
                    <label className="block text-sm font-medium mb-1" style={{ color: secondaryText }}>Agencia <span className="text-red-500">*</span></label>
                    <select value={delivery.agency_name || ''} onChange={(e) => cargarDestinos(e.target.value)}
                      className="w-full px-3 py-3 rounded-xl text-base focus:outline-none focus:ring-1 text-gray-900" style={{ background: "rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.15)" }}>
                      <option value="">Selecciona una agencia</option>
                      {agencies.map((a) => <option key={a.id} value={a.agency_name}>{a.agency_name}</option>)}
                    </select>
                  </div>
                  {delivery.agency_name && (
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: secondaryText }}>Destino <span className="text-red-500">*</span></label>
                      {destinoLibre ? (
                        // Agencia sin sedes configuradas: texto libre, como siempre.
                        <input type="text" value={delivery.destination} onChange={(e) => setDelivery((prev) => ({ ...prev, destination: e.target.value }))}
                          className="w-full px-3 py-3 rounded-xl text-base focus:outline-none focus:ring-1 text-gray-900" style={{ background: "rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.15)" }}
                          placeholder="Ciudad o distrito de destino" />
                      ) : (
                        <AgencyDestinationSearch
                          destinos={agencyDestinos}
                          offersAir={!!agencies.find((a) => a.agency_name === delivery.agency_name)?.offers_air}
                          seleccion={destinoSel}
                          onSelect={elegirDestino}
                          onClear={limpiarDestino}
                          loading={loadingDestinos}
                          themeColor={btnColor}
                          textColor={txtColor}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: secondaryText }}>Referencia <span className="text-gray-400 font-normal">(opcional)</span></label>
                <input type="text" value={delivery.reference} onChange={(e) => setDelivery({ ...delivery, reference: e.target.value })}
                  className="w-full px-3 py-3 rounded-xl text-base focus:outline-none focus:ring-1 text-gray-900" style={{ background: "rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.15)" }}
                  placeholder="Casa azul, frente al parque" />
              </div>

              {delivery.method === 'motorizado' && (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: secondaryText }}>Ubicación en mapa <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <p className="text-xs text-gray-400 mb-2">Toca el mapa para marcar tu ubicación exacta</p>
                  <MapPicker lat={delivery.lat ? parseFloat(delivery.lat) : null} lng={delivery.lng ? parseFloat(delivery.lng) : null}
                    onSelect={(lat, lng) => setDelivery((prev) => ({ ...prev, lat: String(lat), lng: String(lng) }))}
                    themeColor={btnColor} />
                  {delivery.lat && delivery.lng && <p className="text-xs mt-2 font-medium" style={{ color: "#10b981" }}>✅ Ubicación marcada</p>}
                </div>
              )}
            </div>

            {/* Resumen del pedido */}
            <div className="rounded-2xl p-4 mt-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
              <h3 className="font-bold mb-3 text-sm" style={{ color: primaryText }}>Resumen del pedido</h3>
              {cart.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => updateQty(item, item.quantity - 1)} className="w-7 h-7 rounded-full flex items-center justify-center text-base font-bold touch-manipulation" style={{ background: cardBg, color: secondaryText }}>−</button>
                      <span className="w-7 text-center text-sm font-semibold" style={{ color: primaryText }}>{item.quantity}</span>
                      <button onClick={() => updateQty(item, item.quantity + 1)} className="w-7 h-7 rounded-full flex items-center justify-center text-base font-bold touch-manipulation" style={{ background: cardBg, color: secondaryText }}>+</button>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: primaryText }}>{item.product_name}</p>
                      <p className="text-xs" style={{ color: secondaryText }}>{item.color}</p>
                    </div>
                  </div>
                
                </div>
              ))}
              {comboCart.map((item) => (
                <div key={item.combo_id} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => updateComboQty(item.combo_id, item.quantity - 1)} className="w-7 h-7 rounded-full flex items-center justify-center text-base font-bold touch-manipulation" style={{ background: cardBg, color: secondaryText }}>−</button>
                      <span className="w-7 text-center text-sm font-semibold" style={{ color: primaryText }}>{item.quantity}</span>
                      <button onClick={() => updateComboQty(item.combo_id, item.quantity + 1)} className="w-7 h-7 rounded-full flex items-center justify-center text-base font-bold touch-manipulation" style={{ background: cardBg, color: secondaryText }}>+</button>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: primaryText }}>🎁 {item.combo_name}</p>
                      <p className="text-xs" style={{ color: secondaryText }}>Combo</p>
                    </div>
                  </div>
                
                </div>
              ))}
              <div className="flex justify-between pt-3">
                <span className="font-bold" style={{ color: primaryText }}>Total</span>
                <span className="font-bold text-base" style={{ color: primaryText }}>S/ {total.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-3 mt-4 pb-8">
              <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl font-semibold touch-manipulation" style={{ background: cardBg, border: `1px solid ${cardBorder}`, color: secondaryText }}>← Atrás</button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 py-4 rounded-xl font-bold disabled:opacity-50 touch-manipulation active:opacity-80"
                style={{ backgroundColor: btnColor, color: txtColor }}>
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