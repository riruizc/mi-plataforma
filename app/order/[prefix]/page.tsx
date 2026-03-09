'use client'

import { useEffect, useState } from 'react'
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
}

type Product = {
  id: string
  name: string
  category: string
  sale_price: number
  variants: { id: string; color: string; stock: number }[]
}

type CartItem = {
  product_id: string
  variant_id: string
  product_name: string
  color: string
  quantity: number
  unit_price: number
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
  const [orderCode, setOrderCode] = useState('')

  const [customer, setCustomer] = useState({ dni: '', name: '', phone: '' })
  const [delivery, setDelivery] = useState({ method: 'motorizado', destination: '', reference: '', lat: '', lng: '' })

  useEffect(() => { loadStore() }, [])

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
      setStore(storeData)

      const { data: prods } = await supabase
        .from('products')
        .select('*, product_variants(*)')
        .eq('store_id', storeData.id)
        .eq('is_active', true)

      const mapped = (prods || []).map((p: any) => ({
        ...p,
        variants: p.product_variants || []
      }))
      setProducts(mapped)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const addToCart = (product: Product, variant: { id: string; color: string; stock: number }) => {
    const existing = cart.find(c => c.variant_id === variant.id)
    if (existing) {
      setCart(cart.map(c => c.variant_id === variant.id ? { ...c, quantity: c.quantity + 1 } : c))
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
    setCart(cart.filter(c => c.variant_id !== variantId))
  }

  const updateQty = (variantId: string, qty: number) => {
    if (qty <= 0) { removeFromCart(variantId); return }
    setCart(cart.map(c => c.variant_id === variantId ? { ...c, quantity: qty } : c))
  }

  const total = cart.reduce((sum, c) => sum + c.unit_price * c.quantity, 0)

  const handleSubmit = async () => {
    if (!store) return
    if (cart.length === 0) { alert('Agrega al menos un producto'); return }
    if (!customer.name || !customer.phone) { alert('Completa tu nombre y celular'); return }
    if (!delivery.destination) { alert('Indica tu dirección de entrega'); return }

    setSubmitting(true)
    try {
      const supabase = createClient()

      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('store_id', store.id)
        .eq('phone', customer.phone)
        .single()

      let customerId = existingCustomer?.id
      if (!customerId) {
        const { data: newCustomer } = await supabase
          .from('customers')
          .insert({ store_id: store.id, name: customer.name, phone: customer.phone, dni: customer.dni })
          .select('id')
          .single()
        customerId = newCustomer?.id
      }

      const year = new Date().getFullYear()
      const counter = (store.order_counter || 0) + 1
      const code = store.store_prefix + '-' + year + '-' + String(counter).padStart(3, '0')

      const token = Math.random().toString(36).substring(2, 15)

      const { data: order } = await supabase
        .from('orders')
        .insert({
          store_id: store.id,
          customer_id: customerId,
          order_code: code,
          delivery_method: delivery.method,
          destination: delivery.destination,
          reference: delivery.reference,
          total_amount: total,
          pending_amount: total,
          status: 'pending',
          tracking_token: token,
        })
        .select('id')
        .single()

      if (order) {
        const items = cart.map(c => ({
          order_id: order.id,
          product_id: c.product_id,
          variant_id: c.variant_id,
          product_name: c.product_name,
          color: c.color,
          quantity: c.quantity,
          unit_price: c.unit_price,
          subtotal: c.unit_price * c.quantity,
        }))
        await supabase.from('order_items').insert(items)
        await supabase.from('stores').update({ order_counter: counter }).eq('id', store.id)
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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500">Cargando tienda...</p>
    </div>
  )

  if (!store) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-4xl mb-3">🔍</p>
        <p className="text-gray-700 font-medium">Tienda no encontrada</p>
        <p className="text-gray-500 text-sm mt-1">Verifica el enlace e intenta de nuevo</p>
      </div>
    </div>
  )

  if (step === 4) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Pedido recibido!</h2>
        <p className="text-gray-500 mb-4">Tu código de pedido es:</p>
        <div className="bg-gray-100 rounded-xl px-6 py-4 mb-6">
          <span className="text-2xl font-bold text-gray-900">{orderCode}</span>
        </div>
        <p className="text-gray-500 text-sm">Guarda este código para rastrear tu pedido.</p>
        <button
          onClick={() => { setCart([]); setStep(1); setCustomer({ dni: '', name: '', phone: '' }) }}
          className="mt-6 w-full py-3 rounded-xl text-white font-semibold"
          style={{ backgroundColor: store.theme_color || '#2563eb' }}
        >
          Hacer otro pedido
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 shadow-sm" style={{ backgroundColor: store.theme_color || '#2563eb' }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-white font-bold text-lg">{store.name}</h1>
          {cart.length > 0 && (
            <span className="bg-white text-xs font-bold px-2 py-1 rounded-full" style={{ color: store.theme_color || '#2563eb' }}>
              {cart.length} items
            </span>
          )}
        </div>
        <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-2">
          {['Productos', 'Tus datos', 'Entrega'].map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step > i + 1 ? 'bg-white' : step === i + 1 ? 'bg-white' : 'bg-white bg-opacity-30'}`}
                style={{ color: step >= i + 1 ? (store.theme_color || '#2563eb') : 'white' }}>
                {i + 1}
              </div>
              <span className="text-white text-xs">{s}</span>
              {i < 2 && <span className="text-white text-opacity-50 text-xs mx-1">›</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">

        {step === 1 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Elige tus productos</h2>
            {products.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center">
                <p className="text-gray-500">No hay productos disponibles</p>
              </div>
            ) : (
              <div className="space-y-4">
                {products.map(product => (
                  <div key={product.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{product.name}</h3>
                        <p className="text-sm text-gray-500">{product.category}</p>
                      </div>
                      <span className="font-bold text-gray-900">S/ {Number(product.sale_price).toFixed(2)}</span>
                    </div>
                    {product.variants.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {product.variants.map(v => {
                          const inCart = cart.find(c => c.variant_id === v.id)
                          return (
                            <button
                              key={v.id}
                              onClick={() => addToCart(product, v)}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${inCart ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                            >
                              {v.color} {inCart ? `(${inCart.quantity})` : ''}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(product, { id: product.id, color: 'Único', stock: 99 })}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:border-gray-300"
                      >
                        Agregar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 && (
              <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{cart.reduce((s, c) => s + c.quantity, 0)} productos</p>
                    <p className="font-bold text-gray-900">Total: S/ {total.toFixed(2)}</p>
                  </div>
                  <button
                    onClick={() => setStep(2)}
                    className="px-6 py-3 rounded-xl text-white font-semibold"
                    style={{ backgroundColor: store.theme_color || '#2563eb' }}
                  >
                    Continuar →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Tus datos</h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DNI (opcional)</label>
                <input
                  type="text"
                  value={customer.dni}
                  onChange={e => setCustomer({ ...customer, dni: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="12345678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                <input
                  type="text"
                  value={customer.name}
                  onChange={e => setCustomer({ ...customer, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Juan Pérez"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Celular *</label>
                <input
                  type="text"
                  value={customer.phone}
                  onChange={e => setCustomer({ ...customer, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="999 999 999"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl font-semibold border border-gray-200 text-gray-700">
                ← Atrás
              </button>
              <button
                onClick={() => { if (!customer.name || !customer.phone) { alert('Nombre y celular son obligatorios'); return } setStep(3) }}
                className="flex-1 py-3 rounded-xl text-white font-semibold"
                style={{ backgroundColor: store.theme_color || '#2563eb' }}
              >
                Continuar →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Datos de entrega</h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección *</label>
                <input
                  type="text"
                  value={delivery.destination}
                  onChange={e => setDelivery({ ...delivery, destination: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Av. Principal 123, Urb. Los Pinos"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Referencia</label>
                <input
                  type="text"
                  value={delivery.reference}
                  onChange={e => setDelivery({ ...delivery, reference: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Casa azul, frente al parque"
                />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-4">
              <h3 className="font-semibold text-gray-900 mb-3">Resumen del pedido</h3>
              {cart.map(item => (
                <div key={item.variant_id} className="flex items-center justify-between py-2 border-b border-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.variant_id, item.quantity - 1)} className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-sm font-bold flex items-center justify-center">-</button>
                      <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                      <button onClick={() => updateQty(item.variant_id, item.quantity + 1)} className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-sm font-bold flex items-center justify-center">+</button>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.product_name}</p>
                      <p className="text-xs text-gray-500">{item.color}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">S/ {(item.unit_price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-3">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-gray-900">S/ {total.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl font-semibold border border-gray-200 text-gray-700">
                ← Atrás
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl text-white font-semibold disabled:opacity-50"
                style={{ backgroundColor: store.theme_color || '#2563eb' }}
              >
                {submitting ? 'Enviando...' : 'Confirmar pedido'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}