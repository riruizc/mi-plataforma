'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { IconGift, IconPlus, IconClose, IconEdit, IconSearch } from '@/lib/icons'

type Variant = { id: string; color: string; stock: number }
type Product = { id: string; name: string; category: string; sale_price: number; variants: Variant[] }
type ComboItem = { product_id: string; variant_id: string | null; product_name: string; variant_name: string | null; quantity: number; unit_price: number }
type Combo = { id: string; name: string; description: string; price: number; is_active: boolean; created_at: string; items: ComboItem[] }

export default function CombosPage() {
  const [combos, setCombos] = useState<Combo[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null)
  const [form, setForm] = useState({ name: '', description: '', price: '' })
  const [selectedItems, setSelectedItems] = useState<ComboItem[]>([])
  const [saving, setSaving] = useState(false)
  const [searchProduct, setSearchProduct] = useState('')
  const [variantModal, setVariantModal] = useState<Product | null>(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: store } = await supabase.from('stores').select('id').eq('email', user.email).single()
      if (!store) return
      setStoreId(store.id)

      const { data: prods } = await supabase
        .from('products').select('id, name, category, sale_price, product_variants(id, color, stock)')
        .eq('store_id', store.id).eq('is_active', true).order('name')
      setProducts((prods || []).map((p: any) => ({ ...p, variants: p.product_variants || [] })))

      const { data: combosData } = await supabase
        .from('combos')
        .select('*, combo_items(*, products(name, sale_price), product_variants(color))')
        .eq('store_id', store.id).order('created_at', { ascending: false })

      const mapped = (combosData || []).map((c: any) => ({
        ...c,
        items: (c.combo_items || []).map((ci: any) => ({
          product_id: ci.product_id,
          variant_id: ci.variant_id || null,
          product_name: ci.products?.name || 'Producto',
          variant_name: ci.product_variants?.color || null,
          quantity: ci.quantity,
          unit_price: ci.products?.sale_price || 0,
        }))
      }))
      setCombos(mapped)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const openNew = () => {
    setEditingCombo(null)
    setForm({ name: '', description: '', price: '' })
    setSelectedItems([])
    setSearchProduct('')
    setShowForm(true)
  }

  const openEdit = (combo: Combo) => {
    setEditingCombo(combo)
    setForm({ name: combo.name, description: combo.description || '', price: String(combo.price) })
    setSelectedItems(combo.items.map(i => ({ ...i })))
    setSearchProduct('')
    setShowForm(true)
  }

  const handleAddProduct = (product: Product) => {
    if (product.variants.length > 0) {
      setVariantModal(product)
    } else {
      addItem(product.id, null, product.name, null, product.sale_price)
    }
  }

  const addItem = (productId: string, variantId: string | null, productName: string, variantName: string | null, price: number) => {
    const existing = selectedItems.find(i => i.product_id === productId && i.variant_id === variantId)
    if (existing) {
      setSelectedItems(selectedItems.map(i =>
        i.product_id === productId && i.variant_id === variantId ? { ...i, quantity: i.quantity + 1 } : i
      ))
    } else {
      setSelectedItems([...selectedItems, { product_id: productId, variant_id: variantId, product_name: productName, variant_name: variantName, quantity: 1, unit_price: price }])
    }
    setVariantModal(null)
  }

  const removeItem = (productId: string, variantId: string | null) => {
    setSelectedItems(selectedItems.filter(i => !(i.product_id === productId && i.variant_id === variantId)))
  }

  const updateQty = (productId: string, variantId: string | null, qty: number) => {
    if (qty <= 0) { removeItem(productId, variantId); return }
    setSelectedItems(selectedItems.map(i =>
      i.product_id === productId && i.variant_id === variantId ? { ...i, quantity: qty } : i
    ))
  }

  const valorNormal = selectedItems.reduce((s, i) => s + i.unit_price * i.quantity, 0)

  const handleSave = async () => {
    if (!form.name || !form.price) { alert('Nombre y precio son obligatorios'); return }
    if (selectedItems.length === 0) { alert('Agrega al menos un producto al combo'); return }
    if (!storeId) return
    setSaving(true)
    try {
      const supabase = createClient()
      let comboId = editingCombo?.id
      if (editingCombo) {
        const { data: updatedCombo } = await supabase.from('combos').update({ name: form.name, description: form.description, price: parseFloat(form.price) }).eq('id', editingCombo.id).eq('store_id', storeId).select('id').maybeSingle()
        if (!updatedCombo) { alert('No se pudo guardar el combo'); setSaving(false); return }
        await supabase.from('combo_items').delete().eq('combo_id', editingCombo.id)
      } else {
        const { data: newCombo } = await supabase.from('combos').insert({ store_id: storeId, name: form.name, description: form.description, price: parseFloat(form.price), is_active: true }).select('id').single()
        comboId = newCombo?.id
      }
      if (comboId) {
        await supabase.from('combo_items').insert(
          selectedItems.map(i => ({ combo_id: comboId, product_id: i.product_id, variant_id: i.variant_id || null, quantity: i.quantity }))
        )
      }
      setShowForm(false)
      loadData()
    } catch (e: any) { alert('Error: ' + e.message) }
    finally { setSaving(false) }
  }

  const toggleActive = async (combo: Combo) => {
    const supabase = createClient()
    await supabase.from('combos').update({ is_active: !combo.is_active }).eq('id', combo.id).eq('store_id', storeId)
    loadData()
  }

  const deleteCombo = async (combo: Combo) => {
    if (!confirm(`¿Eliminar el combo "${combo.name}"?`)) return
    const supabase = createClient()
    const { data: deletedCombo } = await supabase.from('combos').delete().eq('id', combo.id).eq('store_id', storeId).select('id').maybeSingle()
    if (!deletedCombo) return
    await supabase.from('combo_items').delete().eq('combo_id', combo.id)
    loadData()
  }

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
          <h1 className="text-xl lg:text-2xl font-bold text-db-ink">Combos</h1>
          <p className="text-db-ink-soft text-sm mt-0.5">{combos.length} combos creados</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-1.5 bg-db-brand text-white font-semibold px-4 py-2.5 rounded-full text-sm shadow-[0_4px_14px_-4px_rgba(36,81,232,0.55)]">
          <IconPlus className="w-4 h-4" />Nuevo combo
        </button>
      </div>

      {combos.length === 0 ? (
        <div className="bg-db-surface rounded-2xl shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] p-12 text-center">
          <IconGift className="w-8 h-8 mx-auto mb-3 text-db-ink-soft opacity-50" />
          <p className="text-db-ink font-semibold">No hay combos aún</p>
          <p className="text-db-ink-soft text-sm mt-1">Crea combos de productos con precio especial</p>
        </div>
      ) : (
        <div className="space-y-3">
          {combos.map(combo => {
            const valorNorm = combo.items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
            const ahorro = valorNorm - combo.price
            return (
              <div key={combo.id} className={`bg-db-surface rounded-2xl shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] p-4 lg:p-5 ${!combo.is_active ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-db-ink">{combo.name}</h3>
                      <span className={`text-[10.5px] px-2 py-0.5 rounded-full font-semibold ${combo.is_active ? 'bg-db-delivered-bg text-db-delivered' : 'bg-db-paper text-db-ink-soft'}`}>
                        {combo.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    {combo.description && <p className="text-sm text-db-ink-soft">{combo.description}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-bold text-db-brand font-data tabular-nums">S/ {Number(combo.price).toFixed(2)}</p>
                    {ahorro > 0 && <p className="text-xs text-db-delivered font-semibold font-data">Ahorro: S/ {ahorro.toFixed(2)}</p>}
                    {valorNorm > 0 && <p className="text-xs text-db-ink-soft line-through font-data">S/ {valorNorm.toFixed(2)}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {combo.items.map((item, i) => (
                    <span key={i} className="text-[11px] font-semibold bg-db-brand-tint text-db-brand px-2.5 py-1 rounded-full">
                      {item.product_name}{item.variant_name ? ` (${item.variant_name})` : ''} x{item.quantity}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => openEdit(combo)} className="flex items-center gap-1.5 px-3 py-1.5 bg-db-brand-tint text-db-brand rounded-full text-xs font-semibold"><IconEdit className="w-3.5 h-3.5" />Editar</button>
                  <button onClick={() => toggleActive(combo)} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${combo.is_active ? 'bg-db-paper text-db-ink-soft' : 'bg-db-delivered-bg text-db-delivered'}`}>
                    {combo.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => deleteCombo(combo)} className="px-3 py-1.5 bg-db-cancelled-bg text-db-cancelled rounded-full text-xs font-semibold">Eliminar</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL ELEGIR VARIANTE */}
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
              {variantModal.variants.map(variant => (
                <button key={variant.id}
                  onClick={() => addItem(variantModal.id, variant.id, variantModal.name, variant.color, variantModal.sale_price)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-db-paper hover:bg-db-brand-tint rounded-xl transition-colors">
                  <span className="font-semibold text-db-ink text-sm">{variant.color}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-db-ink-soft font-data">{variant.stock} en stock</span>
                    <span className="text-db-brand font-bold text-lg">+</span>
                  </div>
                </button>
              ))}
              <button onClick={() => addItem(variantModal.id, null, variantModal.name, null, variantModal.sale_price)}
                className="w-full px-4 py-2.5 bg-db-paper text-db-ink-soft rounded-xl text-sm font-semibold">
                Sin variante específica
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-db-surface rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-db-line flex-shrink-0">
              <h2 className="font-bold text-db-ink">{editingCombo ? 'Editar combo' : 'Nuevo combo'}</h2>
              <button onClick={() => setShowForm(false)} className="text-db-ink-soft"><IconClose className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-db-ink mb-1">Nombre del combo *</label>
                  <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand"
                    placeholder="Ej: Combo Audífono + Celular" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-db-ink mb-1">Descripción <span className="text-db-ink-soft font-normal">(opcional)</span></label>
                  <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand"
                    placeholder="Ej: Oferta especial de temporada" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-db-ink mb-1">Precio del combo *</label>
                  <input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand font-data"
                    placeholder="0.00" />
                  {valorNormal > 0 && form.price && (
                    <p className="text-xs mt-1 font-data">
                      Valor normal: <span className="line-through text-db-ink-soft">S/ {valorNormal.toFixed(2)}</span>
                      {parseFloat(form.price) < valorNormal && (
                        <span className="text-db-delivered font-semibold ml-1">· Ahorro: S/ {(valorNormal - parseFloat(form.price)).toFixed(2)}</span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-db-ink mb-2">Productos del combo</h3>
                {selectedItems.length === 0 ? (
                  <div className="bg-db-paper rounded-xl p-4 text-center">
                    <p className="text-db-ink-soft text-sm">Agrega productos desde abajo</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedItems.map(item => (
                      <div key={item.product_id + (item.variant_id || '')} className="flex items-center gap-3 bg-db-brand-tint rounded-xl px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-db-brand truncate">{item.product_name}</p>
                          {item.variant_name && <p className="text-xs text-db-brand/70">{item.variant_name}</p>}
                        </div>
                        <span className="text-xs text-db-brand flex-shrink-0 font-data">S/ {item.unit_price.toFixed(2)}</span>
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
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-bold text-db-ink mb-2">Agregar productos</h3>
                {products.length === 0 ? (
                  <p className="text-db-ink-soft text-sm">No hay productos activos en el inventario</p>
                ) : (
                  <>
                    <div className="relative mb-2">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-db-ink-soft"><IconSearch className="w-3.5 h-3.5" /></span>
                      <input type="text" value={searchProduct} onChange={e => setSearchProduct(e.target.value)}
                        placeholder="Buscar producto..."
                        className="w-full pl-8 pr-3 py-2 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand" />
                      {searchProduct && <button onClick={() => setSearchProduct('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-db-ink-soft">×</button>}
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto border border-db-line rounded-xl p-2">
                      {filteredProducts.map(product => {
                        const totalQty = selectedItems.filter(i => i.product_id === product.id).reduce((s, i) => s + i.quantity, 0)
                        return (
                          <button key={product.id} onClick={() => handleAddProduct(product)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${totalQty > 0 ? 'bg-db-brand-tint text-db-brand' : 'hover:bg-db-paper text-db-ink'}`}>
                            <div className="text-left">
                              <span className="font-semibold">{product.name}</span>
                              {product.variants.length > 0 && (
                                <span className="ml-2 text-xs text-db-ink-soft">{product.variants.length} variantes</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-db-ink-soft font-data">S/ {Number(product.sale_price).toFixed(2)}</span>
                              {totalQty > 0
                                ? <span className="text-xs bg-db-brand text-white px-1.5 py-0.5 rounded-full font-bold font-data">x{totalQty}</span>
                                : <span className="text-db-brand font-bold">+</span>
                              }
                            </div>
                          </button>
                        )
                      })}
                      {filteredProducts.length === 0 && <p className="text-center text-db-ink-soft text-sm py-3">Sin resultados</p>}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-db-line flex-shrink-0">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-3 border border-db-line text-db-ink-soft rounded-full text-sm font-semibold">Cancelar</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-3 bg-db-brand text-white rounded-full text-sm font-bold disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar combo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
