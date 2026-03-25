'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

type Store = { id: string; name: string; phone: string; theme_color: string; button_color?: string; text_color?: string; logo_url: string; store_prefix: string }
type WholesaleProduct = { product_id: string; base_price: number; product_name: string; image_url?: string | null; variants: { id: string; color: string }[] }
type DiscountRange = { min_units: number; max_units: number | null; discount_pct: number }
type Package = { id: string; name: string; description: string; price: number; image_url: string; items: { product_name: string; color: string; quantity: number }[] }
type ClearanceItem = { product_id: string; variant_id: string | null; clearance_price: number; product_name: string; color: string; image_url?: string | null }

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
  const [showCart, setShowCart] = useState(false)

  useEffect(() => { params.then(({ prefix }) => loadData(prefix)) }, [params])

  const loadData = async (prefix: string) => {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data: storeData } = await supabase.from('stores').select('id, name, phone, theme_color, button_color, text_color, logo_url, store_prefix, wholesale_active').eq('store_prefix', prefix.toUpperCase()).single()
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
    setPackages((wPkgs || []).map((pkg: any) => ({ ...pkg, items: pkgItems.filter((i: any) => i.package_id === pkg.id) })))
    setClearanceItems((wClear || []).map((c: any) => ({
      ...c, product_name: c.products?.name || '', color: c.product_variants?.color || 'Único',
      image_url: c.products?.image_url || null
    })))
    setLoading(false)
  }

  const color = store?.theme_color || '#1a1a2e'
  const btnColor = store?.button_color || '#3b82f6'
  const txtColor = store?.text_color || '#ffffff'
  const isDarkBg = (() => {
    const hex = color.replace('#','')
    if (hex.length < 6) return true
    const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16)
    return (r*299+g*587+b*114)/1000 < 128
  })()
  const cardBg = isDarkBg ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'
  const cardBorder = isDarkBg ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.1)'
  const primaryText = isDarkBg ? '#ffffff' : '#111827'
  const secondaryText = isDarkBg ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'
  const totalUnits = cart.filter(c => c.type === 'unit').reduce((s, c) => s + c.qty, 0)
  const totalItems = cart.reduce((s, c) => s + c.qty, 0)

  const getDiscount = (units: number): number => {
    if (!ranges.length) return 0
    const sorted = [...ranges].sort((a, b) => b.min_units - a.min_units)
    const match = sorted.find(r => units >= r.min_units && (r.max_units === null || r.max_units === 0 || units <= r.max_units))
    return match ? Number(match.discount_pct) : 0
  }

  const getNextDiscount = (units: number): { pct: number; needed: number } | null => {
    if (!ranges.length) return null
    const sorted = [...ranges].sort((a, b) => a.min_units - b.min_units)
    const next = sorted.find(r => r.min_units > units)
    if (!next) return null
    return { pct: Number(next.discount_pct), needed: next.min_units - units }
  }

  const discount = getDiscount(totalUnits)
  const priceVisible = totalUnits >= minUnits
  const unitTotal = cart.filter(c => c.type === 'unit').reduce((s, c) => s + c.base_price * c.qty, 0)
  const pkgTotal = cart.filter(c => c.type === 'package').reduce((s, c) => s + c.base_price * c.qty, 0)
  const clearTotal = cart.filter(c => c.type === 'clearance').reduce((s, c) => s + c.base_price * c.qty, 0)
  const discountedUnitTotal = priceVisible ? unitTotal * (1 - discount / 100) : unitTotal
  const grandTotal = discountedUnitTotal + pkgTotal + clearTotal

  const addToCart = (item: Omit<CartItem, 'qty'>) => {
    setCart(prev => {
      const existing = prev.find(c => c.key === item.key)
      if (existing) return prev.map(c => c.key === item.key ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { ...item, qty: 1 }]
    })
  }
  const changeQty = (key: string, delta: number) => {
    setCart(prev => prev.map(c => c.key === key ? { ...c, qty: Math.max(0, c.qty + delta) } : c).filter(c => c.qty > 0))
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
      lines.push('*PRODUCTOS:*')
      unitItems.forEach(c => { const col = c.color && c.color !== 'Único' ? ` (${c.color})` : ''; lines.push(`• ${c.qty}x ${c.product_name}${col}`) })
    }
    if (pkgItems.length > 0) { lines.push('\n*PAQUETES:*'); pkgItems.forEach(c => lines.push(`• ${c.qty}x ${c.product_name} - S/ ${(c.base_price * c.qty).toFixed(2)}`)) }
    if (clearItems.length > 0) { lines.push('\n*REMATES:*'); clearItems.forEach(c => { const col = c.color && c.color !== 'Único' ? ` (${c.color})` : ''; lines.push(`• ${c.qty}x ${c.product_name}${col} - S/ ${(c.base_price * c.qty).toFixed(2)}`) }) }
    lines.push(`\n*TOTAL: S/ ${grandTotal.toFixed(2)}*`)
    const msg = `Hola! Quiero hacer el siguiente pedido mayorista:\n\n${lines.join('\n')}`
    window.open(`https://wa.me/51${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const filteredProducts = wholesaleProducts.filter(p => search === '' || p.product_name.toLowerCase().includes(search.toLowerCase()))
  const filteredPackages = packages.filter(p => search === '' || p.name.toLowerCase().includes(search.toLowerCase()))
  const filteredClearance = clearanceItems.filter(c => search === '' || c.product_name.toLowerCase().includes(search.toLowerCase()))

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: btnColor, color: txtColor }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: color, borderTopColor: 'transparent' }} />
        <p className="text-sm" style={{ color: secondaryText }}>Cargando catálogo...</p>
      </div>
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: btnColor, color: txtColor }}>
      <p className="text-white/20 text-6xl mb-4">🏭</p>
      <p className="text-white font-bold text-xl">Catálogo no disponible</p>
      <p className="text-white/40 text-sm mt-2">Contacta a la tienda para más información</p>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: color, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap');
        .product-card { transition: transform 0.2s ease; }
        .product-card:active { transform: scale(0.97); }
        .variant-btn { transition: all 0.15s ease; }
        .cart-slide { animation: slideUp 0.3s ease; }
        @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .section-tab { transition: all 0.2s ease; }
        .badge-glow { box-shadow: 0 0 12px currentColor; }
      `}</style>

      {/* HEADER */}
      <div className="sticky top-0 z-30" style={{ background: color + 'ee', backdropFilter: 'blur(20px)', borderBottom: isDarkBg ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)' }}>
        <div className="max-w-lg mx-auto px-4 pt-4 pb-3">
          {/* Store info */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {store?.logo_url
                ? <img src={store.logo_url} alt={store.name} className="w-9 h-9 rounded-xl object-cover" style={{ border: `1.5px solid ${btnColor}40` }} />
                : <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold" style={{ background: btnColor + '20', color: btnColor, border: `1.5px solid ${btnColor}40` }}>{store?.name?.[0]}</div>
              }
              <div>
                <p className="font-semibold text-sm leading-tight" style={{ color: primaryText }}>{store?.name}</p>
                <p className="text-xs font-medium" style={{ color: btnColor }}>Catálogo Mayorista</p>
              </div>
            </div>
            {totalItems > 0 && (
              <button onClick={() => setShowCart(true)}
                className="relative flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: btnColor, color: txtColor }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                {totalItems}
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar productos..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm focus:outline-none"
              style={{ color: primaryText, background: isDarkBg ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', border: `1px solid ${cardBorder}` }} />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-lg">×</button>}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: isDarkBg ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
            {[
              { key: 'units', icon: '◈', label: 'Productos' },
              { key: 'packages', icon: '⬡', label: 'Paquetes' },
              { key: 'clearance', icon: '◉', label: 'Remates' },
            ].map(s => (
              <button key={s.key} onClick={() => setActiveSection(s.key as any)}
                className="section-tab flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                style={activeSection === s.key
                  ? { background: color, color: '#fff' }
                  : { background: 'transparent', color: 'rgba(255,255,255,0.4)' }}>
                <span>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 pb-32">

        {/* Discount progress banner */}
        {activeSection === 'units' && totalUnits > 0 && (
          <div className="mb-5 rounded-2xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: secondaryText }}>{totalUnits} productos seleccionados</span>
              {priceVisible && discount > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: btnColor + '25', color: btnColor }}>−{discount}% aplicado</span>
              )}
            </div>
            {!priceVisible ? (
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-white/40">Progreso al precio mayorista</span>
                  <span className="font-semibold" style={{ color: btnColor }}>{totalUnits}/{minUnits}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: isDarkBg ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, totalUnits/minUnits*100)}%`, background: btnColor }} />
                </div>
                <p className="text-xs text-white/40 mt-2">Agrega {minUnits - totalUnits} más para ver el precio total</p>
              </div>
            ) : (() => {
                const next = getNextDiscount(totalUnits)
                return next ? (
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-white/40">Próximo descuento: {next.pct}%</span>
                      <span className="font-semibold" style={{ color: btnColor }}>{next.needed} más</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: isDarkBg ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, 100 - (next.needed / (next.needed + totalUnits) * 100))}%`, background: btnColor }} />
                    </div>
                  </div>
                ) : <p className="text-xs" style={{ color: btnColor }}>✦ Máximo descuento desbloqueado</p>
              })()
            }
          </div>
        )}

        {/* SECTION: Productos por unidad */}
        {activeSection === 'units' && (
          <div>
            {filteredProducts.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-4xl mb-3" style={{ color: secondaryText }}>◈</p>
                <p className="text-sm" style={{ color: secondaryText }}>Sin productos disponibles</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredProducts.map(product => {
                  const hasVariants = product.variants.length > 0
                  if (hasVariants) {
                    return (
                      <div key={product.product_id} className="product-card rounded-2xl overflow-hidden"
                        style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                        <div className="relative h-32 overflow-hidden">
                          {product.image_url
                            ? <img src={product.image_url} alt={product.product_name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-4xl font-bold" style={{ background: `linear-gradient(135deg, ${color}15, ${color}05)` }}>
                                <span style={{ color: color + '60' }}>{product.product_name[0]}</span>
                              </div>
                          }
                          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)' }} />
                          <p className="absolute bottom-2 left-3 right-3 text-white font-semibold text-xs leading-tight">{product.product_name}</p>
                        </div>
                        <div className="p-3">
                          <div className="flex flex-wrap gap-1.5">
                            {product.variants.map(v => {
                              const cartKey = `unit_${product.product_id}_${v.id}`
                              const inCart = cart.find(c => c.key === cartKey)
                              return (
                                <button key={v.id} onClick={() => inCart ? changeQty(cartKey, 1) : addToCart({ key: cartKey, type: 'unit', product_id: product.product_id, variant_id: v.id, product_name: product.product_name, color: v.color, base_price: product.base_price })}
                                  className="variant-btn px-2.5 py-1.5 rounded-lg text-xs font-medium"
                                  style={inCart
                                    ? { background: color, color: '#fff', border: 'none' }
                                    : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                  {inCart ? `✓ ${v.color} ×${inCart.qty}` : v.color}
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
                      <div key={product.product_id} className="product-card rounded-2xl overflow-hidden"
                        style={{ background: inCart ? btnColor + '15' : cardBg, border: `1px solid ${inCart ? btnColor + '50' : cardBorder}` }}>
                        <div className="relative h-32 overflow-hidden">
                          {product.image_url
                            ? <img src={product.image_url} alt={product.product_name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-4xl font-bold" style={{ background: `linear-gradient(135deg, ${color}15, ${color}05)` }}>
                                <span style={{ color: color + '60' }}>{product.product_name[0]}</span>
                              </div>
                          }
                          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)' }} />
                          <p className="absolute bottom-2 left-3 right-3 text-white font-semibold text-xs leading-tight">{product.product_name}</p>
                          {inCart && <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: btnColor, color: txtColor }}>✓</div>}
                        </div>
                        <div className="p-3">
                          {inCart ? (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <button onClick={() => changeQty(cartKey, -1)} className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm" style={{ background: isDarkBg ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', color: primaryText }}>−</button>
                                <span className="text-white font-bold text-sm w-5 text-center">{inCart.qty}</span>
                                <button onClick={() => changeQty(cartKey, 1)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: btnColor, color: txtColor }}>+</button>
                              </div>
                              <button onClick={() => removeFromCart(cartKey)} className="text-white/30 text-xs">✕</button>
                            </div>
                          ) : (
                            <button onClick={() => addToCart({ key: cartKey, type: 'unit', product_id: product.product_id, variant_id: null, product_name: product.product_name, color: 'Único', base_price: product.base_price })}
                              className="w-full py-2 rounded-xl text-xs font-bold text-white" style={{ background: btnColor + '20', border: `1px solid ${btnColor}40`, color: btnColor }}>
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
          <div className="space-y-4">
            {filteredPackages.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-4xl mb-3" style={{ color: secondaryText }}>⬡</p>
                <p className="text-sm" style={{ color: secondaryText }}>Sin paquetes disponibles</p>
              </div>
            ) : filteredPackages.map(pkg => {
              const cartKey = `pkg_${pkg.id}`
              const inCart = cart.find(c => c.key === cartKey)
              return (
                <div key={pkg.id} className="product-card rounded-2xl overflow-hidden"
                  style={{ background: inCart ? color + '10' : 'rgba(255,255,255,0.04)', border: `1px solid ${inCart ? color + '40' : 'rgba(255,255,255,0.08)'}` }}>
                  {pkg.image_url
                    ? <div className="relative h-48 overflow-hidden">
                        <img src={pkg.image_url} alt={pkg.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)' }} />
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <p className="text-white font-bold text-base leading-tight">{pkg.name}</p>
                          {pkg.description && <p className="text-white/60 text-xs mt-0.5">{pkg.description}</p>}
                        </div>
                        <div className="absolute top-3 right-3 px-3 py-1.5 rounded-xl text-sm font-bold text-white" style={{ background: btnColor, color: txtColor }}>
                          S/ {Number(pkg.price).toFixed(2)}
                        </div>
                      </div>
                    : <div className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-white font-bold text-base">{pkg.name}</p>
                            {pkg.description && <p className="text-white/40 text-xs mt-0.5">{pkg.description}</p>}
                          </div>
                          <span className="text-base font-bold ml-3 flex-shrink-0" style={{ color: btnColor }}>S/ {Number(pkg.price).toFixed(2)}</span>
                        </div>
                      </div>
                  }
                  <div className="p-4">
                    {pkg.items.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {pkg.items.map((item, i) => (
                          <span key={i} className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                            {item.quantity}× {item.product_name}{item.color && item.color !== 'Único' ? ` (${item.color})` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                    {!pkg.image_url && <p className="text-base font-bold mb-3" style={{ color: btnColor }}>S/ {Number(pkg.price).toFixed(2)}</p>}
                    {inCart ? (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => changeQty(cartKey, -1)} className="w-8 h-8 rounded-xl flex items-center justify-center font-bold" style={{ background: isDarkBg ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)', color: primaryText }}>−</button>
                          <span className="text-white font-bold text-sm w-6 text-center">{inCart.qty}</span>
                          <button onClick={() => changeQty(cartKey, 1)} className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white" style={{ background: btnColor, color: txtColor }}>+</button>
                        </div>
                        <button onClick={() => removeFromCart(cartKey)} className="text-white/30 text-sm">✕ Quitar</button>
                      </div>
                    ) : (
                      <button onClick={() => addToCart({ key: cartKey, type: 'package', package_id: pkg.id, product_name: pkg.name, base_price: pkg.price })}
                        className="w-full py-3 rounded-xl text-sm font-bold text-white" style={{ background: btnColor, color: txtColor }}>
                        + Agregar paquete
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* SECTION: Remates */}
        {activeSection === 'clearance' && (
          <div>
            <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}>
              <span className="text-orange-400 text-sm">🔥</span>
              <p className="text-orange-400 text-xs font-medium">Precios especiales de liquidación — stock limitado</p>
            </div>
            {filteredClearance.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-4xl mb-3" style={{ color: secondaryText }}>◉</p>
                <p className="text-sm" style={{ color: secondaryText }}>Sin productos en remate</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredClearance.map((item, i) => {
                  const cartKey = `clear_${item.product_id}_${item.variant_id}`
                  const inCart = cart.find(c => c.key === cartKey)
                  return (
                    <div key={i} className="product-card rounded-2xl overflow-hidden"
                      style={{ background: inCart ? 'rgba(249,115,22,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${inCart ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.08)'}` }}>
                      <div className="relative h-32 overflow-hidden">
                        {item.image_url
                          ? <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-3xl font-bold" style={{ background: 'rgba(249,115,22,0.08)' }}>
                              <span className="text-orange-500/40">{item.product_name[0]}</span>
                            </div>
                        }
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%)' }} />
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg text-xs font-bold text-white" style={{ background: '#f97316' }}>REMATE</div>
                        <p className="absolute bottom-2 left-2.5 right-2.5 text-white font-semibold text-xs leading-tight">{item.product_name}</p>
                      </div>
                      <div className="p-3">
                        {item.color !== 'Único' && <p className="text-white/40 text-xs mb-1">{item.color}</p>}
                        <p className="text-orange-400 font-bold text-base mb-2">S/ {Number(item.clearance_price).toFixed(2)}</p>
                        {inCart ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => changeQty(cartKey, -1)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: isDarkBg ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>−</button>
                              <span className="text-white font-bold text-sm w-5 text-center">{inCart.qty}</span>
                              <button onClick={() => changeQty(cartKey, 1)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: '#f97316' }}>+</button>
                            </div>
                            <button onClick={() => removeFromCart(cartKey)} className="text-white/30 text-xs">✕</button>
                          </div>
                        ) : (
                          <button onClick={() => addToCart({ key: cartKey, type: 'clearance', product_id: item.product_id, variant_id: item.variant_id, product_name: item.product_name, color: item.color, base_price: item.clearance_price })}
                            className="w-full py-2 rounded-xl text-xs font-bold" style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316' }}>
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

      {/* FLOATING CART BUTTON */}
      {totalItems > 0 && !showCart && (
        <div className="fixed bottom-6 left-4 right-4 max-w-lg mx-auto z-40">
          <button onClick={() => setShowCart(true)}
            className="w-full py-4 rounded-2xl text-white font-bold text-sm flex items-center justify-between px-5 shadow-2xl"
            style={{ background: btnColor, color: txtColor, boxShadow: `0 8px 32px ${btnColor}50` }}>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {totalItems} producto{totalItems !== 1 ? 's' : ''}
            </div>
            {priceVisible || pkgTotal > 0 || clearTotal > 0
              ? <span>S/ {grandTotal.toFixed(2)}</span>
              : <span className="text-xs" style={{ color: isDarkBg ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)' }}>Ver selección →</span>
            }
          </button>
        </div>
      )}

      {/* CART MODAL */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCart(false)} />
          <div className="cart-slide relative w-full max-w-lg mx-auto rounded-t-3xl overflow-hidden" style={{ background: color, border: `1px solid ${cardBorder}`, maxHeight: '85vh' }}>
            <div className="flex items-center justify-between px-5 py-4 sticky top-0" style={{ background: color + 'cc', borderBottom: `1px solid ${cardBorder}` }}>
              <p className="font-bold" style={{ color: primaryText }}>Tu selección</p>
              <button onClick={() => setShowCart(false)} className="text-white/40 text-2xl leading-none">×</button>
            </div>

            <div className="overflow-y-auto px-5 py-3 space-y-2" style={{ maxHeight: '50vh' }}>
              {cart.map(c => (
                <div key={c.key} className="flex items-center justify-between py-2.5" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{c.product_name}{c.color && c.color !== 'Único' ? ` · ${c.color}` : ''}</p>
                    {(c.type === 'package' || c.type === 'clearance') && (
                      <p className="text-xs" style={{ color: c.type === 'clearance' ? '#f97316' : color }}>S/ {(c.base_price * c.qty).toFixed(2)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <button onClick={() => changeQty(c.key, -1)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: isDarkBg ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>−</button>
                    <span className="text-white text-sm font-bold w-5 text-center">{c.qty}</span>
                    <button onClick={() => changeQty(c.key, 1)} className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm" style={{ background: isDarkBg ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', color: primaryText }}>+</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 sticky bottom-0" style={{ background: color + 'cc', borderTop: `1px solid ${cardBorder}` }}>
              {priceVisible || pkgTotal > 0 || clearTotal > 0 ? (
                <div className="mb-4 space-y-1.5">
                  {priceVisible && totalUnits > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-white/40">{totalUnits} productos</span>
                      <span className="text-white/40">S/ {unitTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {pkgTotal > 0 && <div className="flex justify-between text-sm"><span className="text-white/40">Paquetes</span><span className="text-white/40">S/ {pkgTotal.toFixed(2)}</span></div>}
                  {clearTotal > 0 && <div className="flex justify-between text-sm"><span className="text-white/40">Remates</span><span className="text-white/40">S/ {clearTotal.toFixed(2)}</span></div>}
                  <div className="flex justify-between text-base font-bold pt-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <span className="text-white">Total</span>
                    <span style={{ color: btnColor }}>S/ {grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              ) : totalUnits > 0 && (
                <div className="mb-4 p-3 rounded-xl text-center" style={{ background: isDarkBg ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                  <p className="text-xs" style={{ color: secondaryText }}>{minUnits - totalUnits} productos más para ver el precio</p>
                </div>
              )}
              <button onClick={sendWhatsApp}
                className="w-full py-4 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2"
                style={{ background: '#25d366', boxShadow: '0 4px 20px rgba(37,211,102,0.3)' }}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Enviar pedido por WhatsApp
              </button>
              <button onClick={() => { setCart([]); setShowCart(false) }} className="w-full mt-2 py-2 text-xs" style={{ color: secondaryText }}>Limpiar todo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}