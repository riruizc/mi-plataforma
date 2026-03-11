'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'



type Store = {
  id: string; name: string; phone: string; theme_color: string
  logo_url: string; store_prefix: string; contact_whatsapp_msg: string
}
type Product = { id: string; name: string; category: string; sale_price: number; is_active: boolean }
type ComboItem = { product_name: string; quantity: number }
type Combo = { id: string; name: string; description: string; price: number; is_active: boolean; items: ComboItem[] }
type Selected = { id: string; name: string; price: number; type: 'product' | 'combo'; qty: number }

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
  }, [])

  const loadData = async (prefix: string) => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: storeData } = await supabase
      .from('stores')
      .select('id, name, phone, theme_color, logo_url, store_prefix, contact_whatsapp_msg, catalog_active')
      .eq('store_prefix', prefix)
      .single()
  
    if (!storeData || !storeData.catalog_active) { setNotFound(true); setLoading(false); return }
    setStore(storeData)
  
    const [{ data: prods }, { data: combosData }, { data: comboItems }] = await Promise.all([
      supabase.from('products').select('id, name, category, sale_price, is_active').eq('store_id', storeData.id).eq('is_active', true).order('category').order('name'),
      supabase.from('combos').select('id, name, description, price, is_active').eq('store_id', storeData.id).eq('is_active', true).order('name'),
      supabase.from('combo_items').select('combo_id, quantity, products(name)') as any,
    ])
  
    setProducts(prods || [])
    const mappedCombos = (combosData || []).map((c: any) => ({
      ...c,
      items: (comboItems || [])
        .filter((ci: any) => ci.combo_id === c.id)
        .map((ci: any) => ({ product_name: ci.products?.name || '', quantity: ci.quantity }))
    }))
    setCombos(mappedCombos)
    setLoading(false)
  }

  const toggleProduct = (product: Product) => {
    setSelected(prev => {
      const exists = prev.find(s => s.id === product.id && s.type === 'product')
      if (exists) return prev.filter(s => !(s.id === product.id && s.type === 'product'))
      return [...prev, { id: product.id, name: product.name, price: product.sale_price, type: 'product', qty: 1 }]
    })
  }

  const toggleCombo = (combo: Combo) => {
    setSelected(prev => {
      const exists = prev.find(s => s.id === combo.id && s.type === 'combo')
      if (exists) return prev.filter(s => !(s.id === combo.id && s.type === 'combo'))
      return [...prev, { id: combo.id, name: combo.name, price: combo.price, type: 'combo', qty: 1 }]
    })
  }

  const changeQty = (id: string, type: string, delta: number) => {
    setSelected(prev => prev.map(s => {
      if (s.id === id && s.type === type) {
        const newQty = s.qty + delta
        return newQty < 1 ? s : { ...s, qty: newQty }
      }
      return s
    }))
  }

  const sendWhatsApp = () => {
    if (!store || selected.length === 0) return
    const phone = store.phone.replace(/\D/g, '')
    const total = selected.reduce((sum, s) => sum + s.price * s.qty, 0)
    const lines = selected.map(s => `• ${s.qty}x ${s.name} - S/ ${(s.price * s.qty).toFixed(2)}`).join('\n')
    const msg = `¡Hola! Me interesa lo siguiente del catálogo:\n\n${lines}\n\n*Total: S/ ${total.toFixed(2)}*\n\n¿Tienen disponibilidad?`
    window.open(`https://wa.me/51${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const color = store?.theme_color || '#3b82f6'
  const totalSelected = selected.reduce((sum, s) => sum + s.qty, 0)
  const totalPrice = selected.reduce((sum, s) => sum + s.price * s.qty, 0)

  // Agrupar productos por categoría
  const categories = [...new Set(products.map(p => p.category || 'Sin categoría'))]

  const filteredProducts = searchQuery
    ? products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.category || '').toLowerCase().includes(searchQuery.toLowerCase()))
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
      <p className="text-gray-400 text-sm mt-1">Esta tienda no existe o no tiene catálogo activo</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
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

          {/* Buscador */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar producto o combo..."
              className="w-full pl-8 pr-4 py-2.5 rounded-xl text-sm bg-white/95 text-gray-800 placeholder-gray-400 focus:outline-none"
            />
          </div>

          {/* Tabs */}
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

        {/* PRODUCTOS */}
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
                      {filteredProducts.filter(p => (p.category || 'Sin categoría') === category).map(product => {
                        const isSelected = selected.some(s => s.id === product.id && s.type === 'product')
                        const selectedItem = selected.find(s => s.id === product.id && s.type === 'product')
                        const initial = product.name[0]?.toUpperCase()
                        return (
                          <div key={product.id}
                            className={`bg-white rounded-2xl overflow-hidden border-2 transition-all ${isSelected ? 'shadow-md' : 'border-gray-100'}`}
                            style={{ borderColor: isSelected ? color : undefined }}>
                            {/* Avatar */}
                            <div className="h-24 flex items-center justify-center text-white text-3xl font-bold"
                              style={{ backgroundColor: isSelected ? color : color + '22' }}>
                              <span style={{ color: isSelected ? 'white' : color }}>{initial}</span>
                            </div>
                            <div className="p-3">
                              <p className="font-semibold text-gray-900 text-sm leading-tight">{product.name}</p>
                              <p className="text-xs font-bold mt-1" style={{ color }}>S/ {product.sale_price.toFixed(2)}</p>

                              {isSelected ? (
                                <div className="flex items-center justify-between mt-2">
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => changeQty(product.id, 'product', -1)}
                                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold"
                                      style={{ backgroundColor: color }}>−</button>
                                    <span className="text-sm font-bold text-gray-800">{selectedItem?.qty}</span>
                                    <button onClick={() => changeQty(product.id, 'product', 1)}
                                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold"
                                      style={{ backgroundColor: color }}>+</button>
                                  </div>
                                  <button onClick={() => toggleProduct(product)}
                                    className="text-xs text-red-400 font-medium">✕</button>
                                </div>
                              ) : (
                                <button onClick={() => toggleProduct(product)}
                                  className="w-full mt-2 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity"
                                  style={{ backgroundColor: color }}>
                                  + Agregar
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* COMBOS */}
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
                  const isSelected = selected.some(s => s.id === combo.id && s.type === 'combo')
                  const selectedItem = selected.find(s => s.id === combo.id && s.type === 'combo')
                  return (
                    <div key={combo.id}
                      className={`bg-white rounded-2xl border-2 overflow-hidden transition-all ${isSelected ? 'shadow-md' : 'border-gray-100'}`}
                      style={{ borderColor: isSelected ? color : undefined }}>
                      <div className="flex items-start gap-3 p-4">
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                          style={{ backgroundColor: color + '18' }}>
                          🎁
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-bold text-gray-900 text-sm">{combo.name}</p>
                              {combo.description && <p className="text-xs text-gray-500 mt-0.5">{combo.description}</p>}
                            </div>
                            <p className="font-bold text-sm flex-shrink-0" style={{ color }}>S/ {combo.price.toFixed(2)}</p>
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
                                <button onClick={() => changeQty(combo.id, 'combo', -1)}
                                  className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold"
                                  style={{ backgroundColor: color }}>−</button>
                                <span className="text-sm font-bold text-gray-800">{selectedItem?.qty}</span>
                                <button onClick={() => changeQty(combo.id, 'combo', 1)}
                                  className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold"
                                  style={{ backgroundColor: color }}>+</button>
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

      {/* BARRA INFERIOR - solo si hay seleccionados */}
      {selected.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-6 pt-3 bg-gradient-to-t from-gray-100 to-transparent">
          <div className="max-w-2xl mx-auto">
            {/* Resumen de seleccionados */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-3 mb-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-600">{totalSelected} item{totalSelected > 1 ? 's' : ''} seleccionado{totalSelected > 1 ? 's' : ''}</p>
                <button onClick={() => setSelected([])} className="text-xs text-red-400 font-medium">Limpiar todo</button>
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {selected.map(s => (
                  <div key={s.id + s.type} className="flex justify-between text-xs text-gray-700">
                    <span>{s.qty}x {s.name}</span>
                    <span className="font-medium">S/ {(s.price * s.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 mt-2 pt-2 flex justify-between">
                <span className="text-sm font-bold text-gray-800">Total</span>
                <span className="text-sm font-bold" style={{ color }}>S/ {totalPrice.toFixed(2)}</span>
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