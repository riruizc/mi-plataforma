'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

type Variant = { id: string; color: string; stock: number }

type Store = {
  id: string; name: string; phone: string; theme_color: string
  button_color?: string; text_color?: string
  logo_url: string; store_prefix: string; contact_whatsapp_msg: string
}

type Product = {
  id: string; name: string; category: string; sale_price: number
  is_active: boolean; image_url?: string | null; variants: Variant[]
}

type ComboItem = { product_name: string; quantity: number }

type Combo = {
  id: string; name: string; description: string; price: number
  is_active: boolean; items: ComboItem[]
}

type Selected = {
  id: string; name: string; price: number
  type: 'product' | 'combo'; qty: number
  variantId?: string; variantColor?: string
}

export default function CatalogPage({ params }: { params: Promise<{ prefix: string }> }) {
  const [store, setStore] = useState<Store | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [combos, setCombos] = useState<Combo[]>([])
  const [selected, setSelected] = useState<Selected[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState<'products' | 'combos'>('products')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    params.then(({ prefix }) => loadData(prefix))
  }, [params])

  const loadData = async (prefix: string) => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: storeData } = await supabase
      .from('stores')
      .select('id, name, phone, theme_color, button_color, text_color, logo_url, store_prefix, contact_whatsapp_msg, catalog_active')
      .eq('store_prefix', prefix.toUpperCase())
      .single()

    if (!storeData || !storeData.catalog_active) {
      setNotFound(true); setLoading(false); return
    }

    setStore(storeData)

    const [{ data: prods }, { data: combosData }] = await Promise.all([
      supabase
        .from('products')
        .select('id, name, category, sale_price, is_active, image_url, product_variants(id, color, stock)')
        .eq('store_id', storeData.id)
        .eq('is_active', true)
        .eq('show_in_catalog', true)
        .order('category')
        .order('name'),
      supabase
        .from('combos')
        .select('id, name, description, price, is_active')
        .eq('store_id', storeData.id)
        .eq('is_active', true)
        .order('name'),
    ])

    setProducts((prods || []).map((p: any) => ({ ...p, variants: p.product_variants || [] })))

    const comboIds = (combosData || []).map((c: any) => c.id)
    let mappedCombos: Combo[] = (combosData || []).map((c: any) => ({ ...c, items: [] }))

    if (comboIds.length > 0) {
      const { data: comboItems } = await supabase
        .from('combo_items')
        .select('combo_id, quantity, products(name)')
        .in('combo_id', comboIds) as any

      mappedCombos = (combosData || []).map((c: any) => ({
        ...c,
        items: (comboItems || [])
          .filter((ci: any) => ci.combo_id === c.id)
          .map((ci: any) => ({ product_name: ci.products?.name || '', quantity: ci.quantity })),
      }))
    }

    setCombos(mappedCombos)
    setLoading(false)
  }

  const getKey = (type: string, id: string) => `${type}_${id}`

  const toggleVariant = (product: Product, variant: Variant) => {
    const key = getKey('product', variant.id)
    setSelected(prev => {
      const exists = prev.find(s => s.id === key)
      if (exists) return prev.filter(s => s.id !== key)
      return [...prev, { id: key, name: product.name, price: product.sale_price, type: 'product', qty: 1, variantId: variant.id, variantColor: variant.color }]
    })
  }

  const toggleProductNoVariant = (product: Product) => {
    const key = getKey('product', product.id)
    setSelected(prev => {
      const exists = prev.find(s => s.id === key)
      if (exists) return prev.filter(s => s.id !== key)
      return [...prev, { id: key, name: product.name, price: product.sale_price, type: 'product', qty: 1 }]
    })
  }

  const toggleCombo = (combo: Combo) => {
    const key = getKey('combo', combo.id)
    setSelected(prev => {
      const exists = prev.find(s => s.id === key)
      if (exists) return prev.filter(s => s.id !== key)
      return [...prev, { id: key, name: combo.name, price: combo.price, type: 'combo', qty: 1 }]
    })
  }

  const changeQty = (id: string, delta: number) => {
    setSelected(prev => prev.map(s => {
      if (s.id !== id) return s
      const newQty = s.qty + delta
      return newQty < 1 ? s : { ...s, qty: newQty }
    }))
  }

  const sendWhatsApp = () => {
    if (!store || selected.length === 0) return
    const phone = store.phone.replace(/\D/g, '')
    const total = selected.reduce((sum, s) => sum + s.price * s.qty, 0)
    const lines = selected
      .map(s => {
        const variantStr = s.variantColor ? ` (${s.variantColor})` : ''
        return `• ${s.qty}x ${s.name}${variantStr} - S/ ${(s.price * s.qty).toFixed(2)}`
      })
      .join('\n')
    const msg = `¡Hola! Me interesa lo siguiente del catálogo:\n\n${lines}\n\n*Total: S/ ${total.toFixed(2)}*\n\n¿Tienen disponibilidad?`
    window.open(`https://wa.me/51${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const color = store?.theme_color || '#3b82f6'
  const btnColor = store?.button_color || color
  const txtColor = store?.text_color || '#ffffff'
  const totalSelected = selected.reduce((sum, s) => sum + s.qty, 0)
  const totalPrice = selected.reduce((sum, s) => sum + s.price * s.qty, 0)

  const filteredProducts = searchQuery
    ? products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.category || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : products

  const filteredCombos = searchQuery
    ? combos.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : combos

  const filteredCategories = [...new Set(filteredProducts.map(p => p.category || 'Sin categoría'))]

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f9fafb' }}>
      <div className="w-8 h-8 border-4 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: color }} />
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      <p className="text-4xl mb-3">🏪</p>
      <p className="text-gray-700 font-semibold text-lg">Catálogo no disponible</p>
      <p className="text-gray-400 text-sm mt-1">Catálogo en actualización, vuelve pronto</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="sticky top-0 z-20 shadow-sm" style={{ backgroundColor: color }}>
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            {store?.logo_url ? (
              <img src={store.logo_url} alt={store?.name} className="w-10 h-10 rounded-full object-cover border-2 border-white/30" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">
                {store?.name?.[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">{store?.name}</h1>
              <p className="text-white/70 text-xs">Catálogo de productos</p>
            </div>
          </div>

          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar producto o combo..."
              className="w-full pl-8 pr-4 py-2.5 rounded-xl text-sm bg-white/95 text-gray-800 placeholder-gray-400 focus:outline-none" />
          </div>

          <div className="flex gap-2 mt-3">
            <button onClick={() => setActiveTab('products')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'products' ? 'bg-white text-gray-800' : 'bg-white/20 text-white'}`}>
              📦 Productos ({products.length})
            </button>
            <button onClick={() => setActiveTab('combos')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'combos' ? 'bg-white text-gray-800' : 'bg-white/20 text-white'}`}>
              🎁 Combos ({combos.length})
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {activeTab === 'products' && (
          <div>
            {filteredProducts.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-3xl mb-2">📦</p>
                <p className="text-gray-500">No se encontraron productos</p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredCategories.map(category => (
                  <div key={category}>
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <span className="flex-1 h-px bg-gray-200" />
                      {category}
                      <span className="flex-1 h-px bg-gray-200" />
                    </h2>

                    <div className="grid grid-cols-2 gap-3">
                      {filteredProducts
                        .filter(p => (p.category || 'Sin categoría') === category)
                        .map(product => {
                          const initial = product.name[0]?.toUpperCase()
                          const hasVariants = product.variants && product.variants.length > 0

                          if (hasVariants) {
                            return (
                              <div key={product.id} className="bg-white rounded-2xl overflow-hidden border-2 border-gray-100 transition-all">
                                {product.image_url
                                  ? <img src={product.image_url} alt={product.name} className="w-full h-20 object-cover" />
                                  : <div className="h-20 flex items-center justify-center text-3xl font-bold"
                                      style={{ backgroundColor: color + '22' }}>
                                      <span style={{ color }}>{initial}</span>
                                    </div>
                                }
                                <div className="p-3">
                                  <p className="font-semibold text-gray-900 text-sm leading-tight mb-2">{product.name}</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {product.variants.map(v => {
                                      const key = getKey('product', v.id)
                                      const sel = selected.find(s => s.id === key)
                                      return (
                                        <button key={v.id}
                                          onClick={() => toggleVariant(product, v)}
                                          className="px-2 py-1 rounded-lg text-xs font-medium border transition-colors touch-manipulation"
                                          style={sel
                                            ? { backgroundColor: btnColor, color: txtColor, borderColor: btnColor }
                                            : { backgroundColor: 'white', color: '#374151', borderColor: '#e5e7eb' }
                                          }>
                                          {sel ? `✓ ${v.color} (${sel.qty})` : v.color}
                                        </button>
                                      )
                                    })}
                                  </div>
                                  {product.variants.some(v => selected.find(s => s.id === getKey('product', v.id))) && (
                                    <div className="mt-2 space-y-1">
                                      {product.variants
                                        .filter(v => selected.find(s => s.id === getKey('product', v.id)))
                                        .map(v => {
                                          const key = getKey('product', v.id)
                                          const sel = selected.find(s => s.id === key)!
                                          return (
                                            <div key={v.id} className="flex items-center justify-between">
                                              <span className="text-xs text-gray-500">{v.color}</span>
                                              <div className="flex items-center gap-1.5">
                                                <button onClick={() => changeQty(key, -1)}
                                                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                                  style={{ backgroundColor: btnColor, color: txtColor }}>−</button>
                                                <span className="text-xs font-bold w-4 text-center">{sel.qty}</span>
                                                <button onClick={() => changeQty(key, 1)}
                                                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                                  style={{ backgroundColor: btnColor, color: txtColor }}>+</button>
                                              </div>
                                            </div>
                                          )
                                        })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          } else {
                            const key = getKey('product', product.id)
                            const isSelected = !!selected.find(s => s.id === key)
                            const selectedItem = selected.find(s => s.id === key)

                            return (
                              <div key={product.id}
                                className="bg-white rounded-2xl overflow-hidden border-2 transition-all"
                                style={{ borderColor: isSelected ? btnColor : '#f3f4f6' }}>
                                {product.image_url
                                  ? <img src={product.image_url} alt={product.name} className="w-full h-24 object-cover" />
                                  : <div className="h-24 flex items-center justify-center text-3xl font-bold"
                                      style={{ backgroundColor: isSelected ? btnColor : btnColor + '22' }}>
                                      <span style={{ color: isSelected ? txtColor : btnColor }}>{initial}</span>
                                    </div>
                                }
                                <div className="p-3">
                                  <p className="font-semibold text-gray-900 text-sm leading-tight">{product.name}</p>
                                  <p className="text-xs font-bold mt-1" style={{ color: btnColor }}>
                                    S/ {product.sale_price.toFixed(2)}
                                  </p>
                                  {isSelected ? (
                                    <div className="flex items-center justify-between mt-2">
                                      <div className="flex items-center gap-2">
                                        <button onClick={() => changeQty(key, -1)}
                                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold"
                                          style={{ backgroundColor: btnColor, color: txtColor }}>−</button>
                                        <span className="text-sm font-bold text-gray-800">{selectedItem?.qty}</span>
                                        <button onClick={() => changeQty(key, 1)}
                                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold"
                                          style={{ backgroundColor: btnColor, color: txtColor }}>+</button>
                                      </div>
                                      <button onClick={() => toggleProductNoVariant(product)} className="text-xs text-red-400 font-medium">✕</button>
                                    </div>
                                  ) : (
                                    <button onClick={() => toggleProductNoVariant(product)}
                                      className="w-full mt-2 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity"
                                      style={{ backgroundColor: btnColor, color: txtColor }}>
                                      + Agregar
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          }
                        })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'combos' && (
          <div>
            {filteredCombos.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-3xl mb-2">🎁</p>
                <p className="text-gray-500">No se encontraron combos</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCombos.map(combo => {
                  const key = getKey('combo', combo.id)
                  const isSelected = !!selected.find(s => s.id === key)
                  const selectedItem = selected.find(s => s.id === key)

                  return (
                    <div key={combo.id}
                      className="bg-white rounded-2xl border-2 overflow-hidden transition-all"
                      style={{ borderColor: isSelected ? btnColor : '#f3f4f6' }}>
                      <div className="flex items-start gap-3 p-4">
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                          style={{ backgroundColor: btnColor + '18' }}>🎁</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-bold text-gray-900 text-sm">{combo.name}</p>
                              {combo.description && <p className="text-xs text-gray-500 mt-0.5">{combo.description}</p>}
                            </div>
                            <p className="font-bold text-sm flex-shrink-0" style={{ color: btnColor }}>
                              S/ {combo.price.toFixed(2)}
                            </p>
                          </div>
                          {combo.items.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {combo.items.map((item, i) => (
                                <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                  {item.quantity}x {item.product_name}
                                </span>
                              ))}
                            </div>
                          )}
                          {isSelected ? (
                            <div className="flex items-center gap-3 mt-3">
                              <div className="flex items-center gap-2">
                                <button onClick={() => changeQty(key, -1)}
                                  className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold"
                                  style={{ backgroundColor: btnColor, color: txtColor }}>−</button>
                                <span className="text-sm font-bold text-gray-800">{selectedItem?.qty}</span>
                                <button onClick={() => changeQty(key, 1)}
                                  className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold"
                                  style={{ backgroundColor: btnColor, color: txtColor }}>+</button>
                              </div>
                              <button onClick={() => toggleCombo(combo)} className="text-xs text-red-400 font-medium">✕ Quitar</button>
                            </div>
                          ) : (
                            <button onClick={() => toggleCombo(combo)}
                              className="mt-3 px-4 py-1.5 rounded-xl text-xs font-semibold text-white"
                              style={{ backgroundColor: color }}>
                              + Agregar combo
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-6 pt-3 bg-gradient-to-t from-gray-100 to-transparent">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-3 mb-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-600">
                  {totalSelected} item{totalSelected > 1 ? 's' : ''} seleccionado{totalSelected > 1 ? 's' : ''}
                </p>
                <button onClick={() => setSelected([])} className="text-xs text-red-400 font-medium">Limpiar todo</button>
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {selected.map(s => (
                  <div key={s.id} className="flex justify-between text-xs text-gray-700">
                    <span>{s.qty}x {s.name}{s.variantColor ? ` (${s.variantColor})` : ''}</span>
                    <span className="font-medium">S/ {(s.price * s.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 mt-2 pt-2 flex justify-between">
                <span className="text-sm font-bold text-gray-800">Total</span>
                <span className="text-sm font-bold" style={{ color: btnColor }}>S/ {totalPrice.toFixed(2)}</span>
              </div>
            </div>
            <button onClick={sendWhatsApp}
              className="w-full py-4 rounded-2xl text-white font-bold text-base shadow-lg flex items-center justify-center gap-2"
              style={{ backgroundColor: '#25d366' }}>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Quiero estos productos
            </button>
          </div>
        </div>
      )}
    </div>
  )
}