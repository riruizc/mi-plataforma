'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Product = { id: string; name: string; category: string; sale_price: number }
type ComboItem = { product_id: string; product_name: string; quantity: number; unit_price: number }
type Combo = {
  id: string
  name: string
  description: string
  price: number
  is_active: boolean
  created_at: string
  items: ComboItem[]
}

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

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: store } = await supabase.from('stores').select('id').eq('email', user.email).single()
      if (!store) return
      setStoreId(store.id)

      const { data: prods } = await supabase.from('products').select('id, name, category, sale_price').eq('store_id', store.id).eq('is_active', true).order('name')
      setProducts(prods || [])

      const { data: combosData } = await supabase.from('combos').select('*, combo_items(*, products(name, sale_price))').eq('store_id', store.id).order('created_at', { ascending: false })

      const mapped = (combosData || []).map((c: any) => ({
        ...c,
        items: (c.combo_items || []).map((ci: any) => ({
          product_id: ci.product_id,
          product_name: ci.products?.name || 'Producto',
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
    setShowForm(true)
  }

  const openEdit = (combo: Combo) => {
    setEditingCombo(combo)
    setForm({ name: combo.name, description: combo.description || '', price: String(combo.price) })
    setSelectedItems(combo.items.map(i => ({ ...i })))
    setShowForm(true)
  }

  const addProductToCombo = (product: Product) => {
    const existing = selectedItems.find(i => i.product_id === product.id)
    if (existing) {
      setSelectedItems(selectedItems.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i))
    } else {
      setSelectedItems([...selectedItems, { product_id: product.id, product_name: product.name, quantity: 1, unit_price: product.sale_price }])
    }
  }

  const removeItemFromCombo = (productId: string) => {
    setSelectedItems(selectedItems.filter(i => i.product_id !== productId))
  }

  const updateItemQty = (productId: string, qty: number) => {
    if (qty <= 0) { removeItemFromCombo(productId); return }
    setSelectedItems(selectedItems.map(i => i.product_id === productId ? { ...i, quantity: qty } : i))
  }

  const valorNormal = selectedItems.reduce((s, i) => s + i.unit_price * i.quantity, 0)

  const handleSave = async () => {
    if (!form.name || !form.price) { alert('Nombre y precio son obligatorios'); return }
    if (selectedItems.length === 0) { alert('Agrega al menos un producto al combo'); return }
    if (!storeId) return
    setSaving(true)
    try {
      const supabase = createClient()
      const comboData = { store_id: storeId, name: form.name, description: form.description, price: parseFloat(form.price), is_active: true }

      let comboId = editingCombo?.id
      if (editingCombo) {
        await supabase.from('combos').update({ name: form.name, description: form.description, price: parseFloat(form.price) }).eq('id', editingCombo.id)
        await supabase.from('combo_items').delete().eq('combo_id', editingCombo.id)
      } else {
        const { data: newCombo } = await supabase.from('combos').insert(comboData).select('id').single()
        comboId = newCombo?.id
      }

      if (comboId) {
        await supabase.from('combo_items').insert(
          selectedItems.map(i => ({ combo_id: comboId, product_id: i.product_id, quantity: i.quantity }))
        )
      }

      setShowForm(false)
      loadData()
    } catch (e: any) { alert('Error: ' + e.message) }
    finally { setSaving(false) }
  }

  const toggleActive = async (combo: Combo) => {
    const supabase = createClient()
    await supabase.from('combos').update({ is_active: !combo.is_active }).eq('id', combo.id)
    loadData()
  }

  const deleteCombo = async (combo: Combo) => {
    if (!confirm(`¿Eliminar el combo "${combo.name}"?`)) return
    const supabase = createClient()
    await supabase.from('combo_items').delete().eq('combo_id', combo.id)
    await supabase.from('combos').delete().eq('id', combo.id)
    loadData()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto" />
    </div>
  )

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Combos</h1>
          <p className="text-gray-500 text-sm mt-0.5">{combos.length} combos creados</p>
        </div>
        <button onClick={openNew} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-sm">
          + Nuevo combo
        </button>
      </div>

      {combos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">🎁</p>
          <p className="text-gray-500 font-medium">No hay combos aún</p>
          <p className="text-gray-400 text-sm mt-1">Crea combos de productos con precio especial</p>
        </div>
      ) : (
        <div className="space-y-3">
          {combos.map(combo => {
            const valorNorm = combo.items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
            const ahorro = valorNorm - combo.price
            return (
              <div key={combo.id} className={`bg-white rounded-xl shadow-sm border p-4 lg:p-5 ${!combo.is_active ? 'opacity-60' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-gray-900">{combo.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${combo.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {combo.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    {combo.description && <p className="text-sm text-gray-500">{combo.description}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-bold text-blue-600">S/ {Number(combo.price).toFixed(2)}</p>
                    {ahorro > 0 && (
                      <p className="text-xs text-green-600 font-medium">Ahorro: S/ {ahorro.toFixed(2)}</p>
                    )}
                    {valorNorm > 0 && (
                      <p className="text-xs text-gray-400 line-through">S/ {valorNorm.toFixed(2)}</p>
                    )}
                  </div>
                </div>

                {/* Productos del combo */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {combo.items.map((item, i) => (
                    <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg font-medium">
                      {item.product_name} x{item.quantity}
                    </span>
                  ))}
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => openEdit(combo)} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium">✏️ Editar</button>
                  <button onClick={() => toggleActive(combo)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${combo.is_active ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-green-600'}`}>
                    {combo.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => deleteCombo(combo)} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium">Eliminar</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL CREAR / EDITAR */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
              <h2 className="font-bold text-gray-900">{editingCombo ? 'Editar combo' : 'Nuevo combo'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 text-2xl font-bold">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Datos del combo */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nombre del combo *</label>
                  <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder='Ej: Combo Audífono + Celular' />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Descripción <span className="text-gray-400">(opcional)</span></label>
                  <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder='Ej: Oferta especial de temporada' />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Precio del combo *</label>
                  <input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00" />
                  {valorNormal > 0 && form.price && (
                    <p className="text-xs mt-1">
                      Valor normal: <span className="line-through text-gray-400">S/ {valorNormal.toFixed(2)}</span>
                      {parseFloat(form.price) < valorNormal && (
                        <span className="text-green-600 font-medium ml-1">· Ahorro: S/ {(valorNormal - parseFloat(form.price)).toFixed(2)}</span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* Productos seleccionados */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Productos del combo</h3>
                {selectedItems.length === 0 ? (
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-gray-400 text-sm">Agrega productos desde abajo</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedItems.map(item => (
                      <div key={item.product_id} className="flex items-center gap-3 bg-blue-50 rounded-xl px-3 py-2">
                        <span className="flex-1 text-sm font-medium text-blue-900">{item.product_name}</span>
                        <span className="text-xs text-blue-600">S/ {item.unit_price.toFixed(2)}</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateItemQty(item.product_id, item.quantity - 1)}
                            className="w-6 h-6 bg-white rounded-lg text-blue-600 font-bold text-sm flex items-center justify-center">−</button>
                          <span className="w-6 text-center text-sm font-bold text-blue-900">{item.quantity}</span>
                          <button onClick={() => updateItemQty(item.product_id, item.quantity + 1)}
                            className="w-6 h-6 bg-white rounded-lg text-blue-600 font-bold text-sm flex items-center justify-center">+</button>
                        </div>
                        <button onClick={() => removeItemFromCombo(item.product_id)} className="text-red-400 hover:text-red-600 text-lg font-bold">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Lista de productos disponibles */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Agregar productos</h3>
                {products.length === 0 ? (
                  <p className="text-gray-400 text-sm">No hay productos activos en el inventario</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-100 rounded-xl p-2">
                    {products.map(product => {
                      const inCombo = selectedItems.find(i => i.product_id === product.id)
                      return (
                        <button key={product.id} onClick={() => addProductToCombo(product)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${inCombo ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}`}>
                          <span className="font-medium">{product.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">S/ {Number(product.sale_price).toFixed(2)}</span>
                            {inCombo ? <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">x{inCombo.quantity}</span> : <span className="text-blue-500 font-bold">+</span>}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar combo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}