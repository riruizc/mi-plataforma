'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

type Store = { id: string; name: string; phone: string; theme_color: string; logo_url: string; store_prefix: string }
type WholesaleProduct = { product_id: string; base_price: number; product_name: string; image_url?: string | null; variants: { id: string; color: string }[] }
type DiscountRange = { min_units: number; max_units: number | null; discount_pct: number }
type Package = { id: string; name: string; description: string; price: number; image_url: string; items: { product_name: string; color: string; quantity: number }[] }
type ClearanceItem = { product_id: string; variant_id: string | null; clearance_price: number; product_name: string; color: string }

type CartItem = {
  key: string; type: 'unit' | 'package' | 'clearance'
  product_id?: string; variant_id?: string | null
  package_id?: string; product_name: string; color?: string
  base_price: number; qty: number
}

export default function WholesalePage({ params }: { params: Promise<{ prefix: string }> }) {
  const [store, setStore] = useState<Store | null>(null)
  const [minUnits, setMinUnits] = useState(12)
  const [ranges, setRanges] = useState<DiscountRange[]>([])
  const [wholesaleProducts, setWholesaleProducts] = useState<WholesaleProduct[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [clearanceItems, setClearanceItems] = useState<ClearanceItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeSection, setActiveSection] = useState<'units' | 'packages' | 'clearance'>('units')
  const [search, setSearch] = useState('')

  useEffect(() => { params.then(({ prefix }) => loadData(prefix)) }, [params])

  const loadData = async (prefix: string) => {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

    const { data: storeData } = await supabase.from('stores').select('id, name, phone, theme_color, logo_url, store_prefix, wholesale_active').eq('store_prefix', prefix.toUpperCase()).single()
    if (!storeData || !storeData.wholesale_active) { setNotFound(true); setLoading(false); return }
    setStore(storeData)

    const [{ data: wConfig }, { data: wRanges }, { data: wProds }, { data: wPkgs }, { data: wClear }] = await Promise.all([
      supabase.from('wholesale_config').select('*').eq('store_id', storeData.id).single(),
      supabase.from('wholesale_discount_ranges').select('*').eq('store_id', storeData.id).order('sort_order'),
      supabase.from('wholesale_products').select('*, products(name, image_url, product_variants(id, color))').eq('store_id', storeData.id).eq('is_active', true),
      supabase.from('wholesale_packages').select('*').eq('store_id', storeData.id).eq('is_active', true).order('created_at'),
      supabase.from('wholesale_clearance').select('*, products(name, image_url), product_variants(color)').eq('store_id', storeData.id).eq('is_active', true),
    ])

    if (wConfig) setMinUnits(wConfig.min_units || 12)
    setRanges(wRanges || [])
    setWholesaleProducts((wProds || []).map((wp: any) => ({
      product_id: wp.product_id, base_price: wp.base_price,
      product_name: wp.products?.name || '',
      image_url: wp.products?.image_url || null,
      variants: wp.products?.product_variants || []
    })))

    const pkgIds = (wPkgs || []).map((p: any) => p.id)
    let pkgItems: any[] = []
    if (pkgIds.length > 0) {
      const { data: items } = await supabase.from('wholesale_package_items').select('*').in('package_id', pkgIds)
      pkgItems = items || []
    }
    setPackages((wPkgs || []).map((pkg: any) => ({
      ...pkg, items: pkgItems.filter((i: any) => i.package_id === pkg.id)
    })))

    setClearanceItems((wClear || []).map((c: any) => ({
      ...c, product_name: c.products?.name || '', color: c.product_variants?.color || 'Único', image_url: c.products?.image_url || null
    })))

    setLoading(false)
  }

  const color = store?.theme_color || '#3b82f6'

  // Cart logic
  const totalUnits = cart.filter(c => c.type === 'unit').reduce((s, c) => s + c.qty, 0)
  const totalItems = cart.reduce((s, c) => s + c.qty, 0)

  const getDiscount = (units: number): number => {
    const sorted = [...ranges].sort((a, b) => b.min_units - a.min_units)
    const match = sorted.find(r => units >= r.min_units && (r.max_units === null || units <= r.max_units))
    return match ? match.discount_pct : 0
  }

  const discount = getDiscount(totalUnits)
  const unitTotal = cart.filter(c => c.type === 'unit').reduce((s, c) => s + c.base_price * c.qty, 0)
  const pkgTotal = cart.filter(c => c.type === 'package').reduce((s, c) => s + c.base_price * c.qty, 0)
  const clearTotal = cart.filter(c => c.type === 'clearance').reduce((s, c) => s + c.base_price * c.qty, 0)
  const discountedUnitTotal = totalUnits >= minUnits ? unitTotal * (1 - discount / 100) : unitTotal
  const grandTotal = discountedUnitTotal + pkgTotal + clearTotal
  const priceVisible = totalUnits >= minUnits

  const addToCart = (item: Omit<CartItem, 'qty'>) => {
    setCart(prev => {
      const existing = prev.find(c => c.key === item.key)
      if (existing) return prev.map(c => c.key === item.key ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { ...item, qty: 1 }]
    })
  }

  const changeQty = (key: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.key !== key) return c
      const newQty = c.qty + delta
      return newQty < 1 ? c : { ...c, qty: newQty }
    }).filter(c => c.qty > 0))
  }

  const removeFromCart = (key: string) => setCart(prev => prev.filter(c => c.key !== key))

  const sendWhatsApp = () => {
    if (!store || cart.length === 0) return
    const phone = store.phone.replace(/\D/g, '')
    const lines: string[] = []

    const unitItems = cart.filter(c => c.type === 'unit')
    const pkgItems = cart.filter(c => c.type === 'package')
    const clearItems = cart.filter(c => c.type === 'clearance')

    if (unitItems.length > 0) {
      lines.push('*📦 PRODUCTOS:*')
      unitItems.forEach(c => {
        const colorStr = c.color && c.color !== 'Único' ? ` (${c.color})` : ''
        lines.push(`• ${c.qty}x ${c.product_name}${colorStr}`)
      })
      if (priceVisible) {
        lines.push(`Subtotal: S/ ${unitTotal.toFixed(2)}`)
        if (discount > 0) lines.push(`Descuento ${discount}%: -S/ ${(unitTotal * discount / 100).toFixed(2)}`)
        lines.push(`Total productos: S/ ${discountedUnitTotal.toFixed(2)}`)
      }
    }

    if (pkgItems.length > 0) {
      lines.push('\n*📦 PAQUETES:*')
      pkgItems.forEach(c => lines.push(`• ${c.qty}x ${c.product_name} - S/ ${(c.base_price * c.qty).toFixed(2)}`))
    }

    if (clearItems.length > 0) {
      lines.push('\n*🔥 REMATES:*')
      clearItems.forEach(c => {
        const colorStr = c.color && c.color !== 'Único' ? ` (${c.color})` : ''
        lines.push(`• ${c.qty}x ${c.product_name}${colorStr} - S/ ${(c.base_price * c.qty).toFixed(2)}`)
      })
    }

    lines.push(`\n*TOTAL GENERAL: S/ ${grandTotal.toFixed(2)}*`)

    const msg = `¡Hola! Quiero hacer el siguiente pedido mayorista:\n\n${lines.join('\n')}`
    window.open(`https://wa.me/51${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const filteredProducts = wholesaleProducts.filter(p =>
    search === '' || p.product_name.toLowerCase().includes(search.toLowerCase())
  )
  const filteredPackages = packages.filter(p =>
    search === '' || p.name.toLowerCase().includes(search.toLowerCase())
  )
  const filteredClearance = clearanceItems.filter(c =>
    search === '' || c.product_name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: '#3b82f6' }} />
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      <p className="text-4xl mb-3">🏭</p>
      <p className="text-gray-700 font-semibold text-lg">Catálogo mayorista no disponible</p>
      <p className="text-gray-400 text-sm mt-1">Contacta a la tienda para más información</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-48">
      {/* Header */}
      <div className="sticky top-0 z-20 shadow-sm" style={{ backgroundColor: color }}>
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            {store?.logo_url
              ? <img src={store.logo_url} alt={store.name} className="w-10 h-10 rounded-full object-cover border-2 border-white/30" />
              : <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">{store?.name?.[0]}</div>
            }
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">{store?.name}</h1>
              <p className="text-white/70 text-xs">Catálogo Mayorista</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar productos..."
              className="w-full pl-8 pr-4 py-2.5 rounded-xl text-sm bg-white/95 text-gray-800 placeholder-gray-400 focus:outline-none" />
          </div>

          {/* Section tabs */}
          <div className="flex gap-2">
            {[
              { key: 'units', label: `📦 Por unidad${wholesaleProducts.length > 0 ? ` (${wholesaleProducts.length})` : ''}` },
              { key: 'packages', label: `🎁 Paquetes${packages.length > 0 ? ` (${packages.length})` : ''}` },
              { key: 'clearance', label: `🔥 Remates${clearanceItems.length > 0 ? ` (${clearanceItems.length})` : ''}` },
            ].map(s => (
              <button key={s.key} onClick={() => setActiveSection(s.key as any)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeSection === s.key ? 'bg-white text-gray-800' : 'bg-white/20 text-white'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">

        {/* Discount info banner */}
        {activeSection === 'units' && ranges.length > 0 && (
          <div className="bg-white rounded-2xl border-2 p-4 mb-4" style={{ borderColor: color + '40' }}>
            <p className="text-sm font-bold text-gray-800 mb-2">💡 Descuentos por volumen</p>
            <p className="text-xs text-gray-500 mb-3">Selecciona al menos <strong>{minUnits} productos</strong> para ver el precio total</p>
            <div className="flex flex-wrap gap-2">
              {ranges.map((r, i) => (
                <div key={i} className="flex items-center gap-1 bg-gray-50 rounded-lg px-3 py-1.5">
                  <span className="text-xs text-gray-600">{r.min_units}{r.max_units ? `-${r.max_units}` : '+'} pzas</span>
                  <span className="text-xs font-bold text-green-600">{r.discount_pct}% OFF</span>
                </div>
              ))}
            </div>
            {totalUnits > 0 && (
              <div className={`mt-3 rounded-xl px-3 py-2 text-center ${priceVisible ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                {priceVisible
                  ? <p className="text-sm font-bold text-green-700">✅ {totalUnits} unidades — {discount > 0 ? `${discount}% de descuento aplicado` : 'Sin descuento en este rango'}</p>
                  : <p className="text-sm font-medium text-amber-700">Tienes {totalUnits} de {minUnits} unidades mínimas — {minUnits - totalUnits} más para ver el precio</p>
                }
              </div>
            )}
          </div>
        )}

        {/* SECTION: Por unidad */}
        {activeSection === 'units' && (
          <div>
            {filteredProducts.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-3xl mb-2">📦</p>
                <p className="text-gray-500">No hay productos disponibles</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredProducts.map(product => {
                  const hasVariants = product.variants.length > 0
                  if (hasVariants) {
                    return (
                      <div key={product.product_id} className="bg-white rounded-2xl overflow-hidden border-2 border-gray-100">
                        {product.image_url
                          ? <img src={product.image_url} alt={product.product_name} className="w-full h-20 object-cover" />
                          : <div className="h-20 flex items-center justify-center text-3xl font-bold" style={{ backgroundColor: color + '18' }}>
                              <span style={{ color }}>{product.product_name[0]?.toUpperCase()}</span>
                            </div>
                        }
                        <div className="p-3">
                          <p className="font-semibold text-gray-900 text-sm leading-tight mb-1">{product.product_name}</p>
                          <p className="text-xs text-gray-400 mb-2">Precio base: S/ {Number(product.base_price).toFixed(2)}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {product.variants.map(v => {
                              const cartKey = `unit_${product.product_id}_${v.id}`
                              const inCart = cart.find(c => c.key === cartKey)
                              return (
                                <button key={v.id}
                                  onClick={() => inCart ? changeQty(cartKey, 1) : addToCart({ key: cartKey, type: 'unit', product_id: product.product_id, variant_id: v.id, product_name: product.product_name, color: v.color, base_price: product.base_price })}
                                  className="px-2 py-1 rounded-lg text-xs font-medium border transition-colors touch-manipulation"
                                  style={inCart ? { backgroundColor: color, color: 'white', borderColor: color } : { backgroundColor: 'white', color: '#374151', borderColor: '#e5e7eb' }}>
                                  {inCart ? `✓ ${v.color} (${inCart.qty})` : v.color}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  } else {
                    const cartKey = `unit_${product.product_id}_novar`
                    const inCart = cart.find(c => c.key === cartKey)
                    return (
                      <div key={product.product_id} className="bg-white rounded-2xl overflow-hidden border-2 transition-all" style={{ borderColor: inCart ? color : '#f3f4f6' }}>
                        <div className="h-24 flex items-center justify-center text-3xl font-bold" style={{ backgroundColor: inCart ? color : color + '18' }}>
                          <span style={{ color: inCart ? 'white' : color }}>{product.product_name[0]?.toUpperCase()}</span>
                        </div>
                        <div className="p-3">
                          <p className="font-semibold text-gray-900 text-sm leading-tight">{product.product_name}</p>
                          <p className="text-xs text-gray-400 mt-0.5 mb-2">Base: S/ {Number(product.base_price).toFixed(2)}</p>
                          {inCart ? (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => changeQty(cartKey, -1)} className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm" style={{ backgroundColor: color }}>−</button>
                                <span className="text-sm font-bold w-5 text-center">{inCart.qty}</span>
                                <button onClick={() => changeQty(cartKey, 1)} className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm" style={{ backgroundColor: color }}>+</button>
                              </div>
                              <button onClick={() => removeFromCart(cartKey)} className="text-xs text-red-400">✕</button>
                            </div>
                          ) : (
                            <button onClick={() => addToCart({ key: cartKey, type: 'unit', product_id: product.product_id, variant_id: null, product_name: product.product_name, color: 'Único', base_price: product.base_price })}
                              className="w-full py-1.5 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: color }}>
                              + Agregar
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  }
                })}
              </div>
            )}
          </div>
        )}

        {/* SECTION: Paquetes */}
        {activeSection === 'packages' && (
          <div>
            {filteredPackages.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-3xl mb-2">🎁</p>
                <p className="text-gray-500">No hay paquetes disponibles</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPackages.map(pkg => {
                  const cartKey = `pkg_${pkg.id}`
                  const inCart = cart.find(c => c.key === cartKey)
                  return (
                    <div key={pkg.id} className="bg-white rounded-2xl overflow-hidden border-2 transition-all" style={{ borderColor: inCart ? color : '#f3f4f6' }}>
                      {pkg.image_url
                        ? <img src={pkg.image_url} alt={pkg.name} className="w-full h-48 object-cover" />
                        : <div className="w-full h-32 flex items-center justify-center text-5xl" style={{ backgroundColor: color + '15' }}>🎁</div>
                      }
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-1">
                          <p className="font-bold text-gray-900 text-base">{pkg.name}</p>
                          <p className="font-bold text-lg ml-3 flex-shrink-0" style={{ color }}>S/ {Number(pkg.price).toFixed(2)}</p>
                        </div>
                        {pkg.description && <p className="text-sm text-gray-500 mb-2">{pkg.description}</p>}
                        {pkg.items.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {pkg.items.map((item, i) => (
                              <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                {item.quantity}x {item.product_name}{item.color && item.color !== 'Único' ? ` (${item.color})` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                        {inCart ? (
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <button onClick={() => changeQty(cartKey, -1)} className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: color }}>−</button>
                              <span className="text-base font-bold text-gray-800">{inCart.qty}</span>
                              <button onClick={() => changeQty(cartKey, 1)} className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: color }}>+</button>
                            </div>
                            <button onClick={() => removeFromCart(cartKey)} className="text-sm text-red-400 font-medium">✕ Quitar</button>
                          </div>
                        ) : (
                          <button onClick={() => addToCart({ key: cartKey, type: 'package', package_id: pkg.id, product_name: pkg.name, base_price: pkg.price })}
                            className="w-full py-3 rounded-xl text-sm font-bold text-white" style={{ backgroundColor: color }}>
                            + Agregar paquete
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* SECTION: Remates */}
        {activeSection === 'clearance' && (
          <div>
            {filteredClearance.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-3xl mb-2">🔥</p>
                <p className="text-gray-500">No hay productos en remate</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredClearance.map((item, i) => {
                  const cartKey = `clear_${item.product_id}_${item.variant_id}`
                  const inCart = cart.find(c => c.key === cartKey)
                  const isSelected = !!inCart
                  return (
                    <div key={i} className="bg-white rounded-2xl overflow-hidden border-2 transition-all" style={{ borderColor: isSelected ? '#F97316' : '#f3f4f6' }}>
                      {(item as any).image_url
                        ? <img src={(item as any).image_url} alt={item.product_name} className="w-full h-24 object-cover" />
                        : <div className="h-24 flex items-center justify-center text-3xl font-bold" style={{ backgroundColor: isSelected ? '#F97316' : '#FED7AA' }}>
                            <span style={{ color: isSelected ? 'white' : '#C2410C' }}>{item.product_name[0]?.toUpperCase()}</span>
                          </div>
                      }
                      <div className="p-3">
                        <p className="font-semibold text-gray-900 text-sm leading-tight">{item.product_name}</p>
                        {item.color !== 'Único' && <p className="text-xs text-gray-400">{item.color}</p>}
                        <p className="text-base font-bold text-orange-500 mt-1">S/ {Number(item.clearance_price).toFixed(2)}</p>
                        <p className="text-xs text-orange-400 mb-2">🔥 Precio remate</p>
                        {inCart ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => changeQty(cartKey, -1)} className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm">−</button>
                              <span className="text-sm font-bold w-5 text-center">{inCart.qty}</span>
                              <button onClick={() => changeQty(cartKey, 1)} className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm">+</button>
                            </div>
                            <button onClick={() => removeFromCart(cartKey)} className="text-xs text-red-400">✕</button>
                          </div>
                        ) : (
                          <button onClick={() => addToCart({ key: cartKey, type: 'clearance', product_id: item.product_id, variant_id: item.variant_id, product_name: item.product_name, color: item.color, base_price: item.clearance_price })}
                            className="w-full py-1.5 rounded-lg text-xs font-semibold text-white bg-orange-500 touch-manipulation">
                            + Agregar
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating cart */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-6 pt-3 bg-gradient-to-t from-gray-100 to-transparent">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-3 mb-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-600">{totalItems} item{totalItems > 1 ? 's' : ''} en el carrito</p>
                <button onClick={() => setCart([])} className="text-xs text-red-400 font-medium">Limpiar todo</button>
              </div>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {cart.map(c => (
                  <div key={c.key} className="flex justify-between text-xs text-gray-700">
                    <span>{c.qty}x {c.product_name}{c.color && c.color !== 'Único' ? ` (${c.color})` : ''}</span>
                    {(c.type === 'package' || c.type === 'clearance' || priceVisible) && (
                      <span className="font-medium">S/ {(c.base_price * c.qty).toFixed(2)}</span>
                    )}
                  </div>
                ))}
              </div>
              {priceVisible || pkgTotal > 0 || clearTotal > 0 ? (
                <div className="border-t border-gray-100 mt-2 pt-2 space-y-0.5">
                  {priceVisible && discount > 0 && <div className="flex justify-between text-xs text-green-600"><span>Descuento {discount}%</span><span>-S/ {(unitTotal * discount / 100).toFixed(2)}</span></div>}
                  <div className="flex justify-between">
                    <span className="text-sm font-bold text-gray-800">Total</span>
                    <span className="text-sm font-bold" style={{ color }}>S/ {grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              ) : totalUnits > 0 && (
                <div className="border-t border-gray-100 mt-2 pt-2">
                  <p className="text-xs text-center text-amber-600 font-medium">
                    {minUnits - totalUnits} producto{minUnits - totalUnits !== 1 ? 's' : ''} más para ver el precio
                  </p>
                </div>
              )}
            </div>
            <button onClick={sendWhatsApp}
              className="w-full py-4 rounded-2xl text-white font-bold text-base shadow-lg flex items-center justify-center gap-2"
              style={{ backgroundColor: '#25d366' }}>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Enviar pedido por WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  )
}