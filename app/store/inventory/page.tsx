'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Variant = { id?: string; color: string; stock: number }
type Product = {
  id: string
  name: string
  category: string
  cost_price: number
  sale_price: number
  is_active: boolean
  variants: Variant[]
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState({ name: '', category: '', cost_price: '', sale_price: '' })
  const [variants, setVariants] = useState<Variant[]>([{ color: '', stock: 0 }])
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadProducts() }, [])

  const loadProducts = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: store } = await supabase
        .from('stores').select('id').eq('email', user.email).single()
      if (!store) return
      setStoreId(store.id)

      const { data } = await supabase
        .from('products')
        .select('*, product_variants(*)')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })

      const mapped = (data || []).map((p: any) => ({
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

  const openNew = () => {
    setEditingProduct(null)
    setForm({ name: '', category: '', cost_price: '', sale_price: '' })
    setVariants([{ color: '', stock: 0 }])
    setShowForm(true)
  }

  const openEdit = (product: Product) => {
    setEditingProduct(product)
    setForm({
      name: product.name,
      category: product.category,
      cost_price: String(product.cost_price),
      sale_price: String(product.sale_price),
    })
    setVariants(product.variants.length > 0 ? product.variants : [{ color: '', stock: 0 }])
    setShowForm(true)
  }

  const addVariant = () => setVariants([...variants, { color: '', stock: 0 }])
  const removeVariant = (i: number) => setVariants(variants.filter((_, idx) => idx !== i))
  const updateVariant = (i: number, field: string, value: string | number) => {
    setVariants(variants.map((v, idx) => idx === i ? { ...v, [field]: value } : v))
  }

  const handleSave = async () => {
    if (!form.name || !form.sale_price) { alert('Nombre y precio de venta son obligatorios'); return }
    
    setSaving(true)
    try {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { alert('No hay sesión activa'); return }
  
      const { data: store } = await supabase
        .from('stores').select('id').eq('email', user.email).single()
      if (!store) { alert('No se encontró la tienda'); return }
  
      const productData = {
        store_id: store.id,
        name: form.name,
        category: form.category,
        cost_price: parseFloat(form.cost_price) || 0,
        sale_price: parseFloat(form.sale_price) || 0,
        is_active: true,
      }
  
      let productId = editingProduct?.id
  
      if (editingProduct) {
        await supabase.from('products').update(productData).eq('id', editingProduct.id)
        await supabase.from('product_variants').delete().eq('product_id', editingProduct.id)
      } else {
        const { data: newProduct, error } = await supabase
          .from('products').insert(productData).select('id').single()
        if (error) { alert('Error: ' + error.message); return }
        productId = newProduct?.id
      }
  
      const validVariants = variants.filter(v => v.color.trim())
      if (validVariants.length > 0 && productId) {
        await supabase.from('product_variants').insert(
          validVariants.map(v => ({
            product_id: productId,
            store_id: store.id,
            color: v.color,
            stock: Number(v.stock) || 0,
          }))
        )
      }
  
      setShowForm(false)
      loadProducts()
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (product: Product) => {
    const supabase = createClient()
    await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id)
    loadProducts()
  }

  const handleDelete = async (productId: string) => {
    if (!confirm('¿Eliminar este producto?')) return
    const supabase = createClient()
    await supabase.from('product_variants').delete().eq('product_id', productId)
    await supabase.from('products').delete().eq('id', productId)
    loadProducts()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-500">Cargando inventario...</p>
    </div>
  )

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="text-gray-500 mt-1">{products.length} productos</p>
        </div>
        <button
          onClick={openNew}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm"
        >
          + Nuevo producto
        </button>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">🗃️</p>
          <p className="text-gray-500">No hay productos aún</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map(product => (
            <div key={product.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-gray-900">{product.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${product.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {product.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{product.category}</p>
                  <div className="flex gap-4 mt-1 text-sm">
                    <span className="text-gray-500">Costo: <strong>S/ {Number(product.cost_price).toFixed(2)}</strong></span>
                    <span className="text-gray-900">Venta: <strong>S/ {Number(product.sale_price).toFixed(2)}</strong></span>
                  </div>
                  {product.variants.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {product.variants.map((v, i) => (
                        <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                          {v.color} — {v.stock} und.
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(product)} className="px-3 py-1.5 rounded-lg text-sm bg-blue-50 text-blue-600 hover:bg-blue-100">
                    ✏️ Editar
                  </button>
                  <button onClick={() => toggleActive(product)} className={`px-3 py-1.5 rounded-lg text-sm ${product.is_active ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                    {product.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => handleDelete(product.id)} className="px-3 py-1.5 rounded-lg text-sm bg-red-50 text-red-600 hover:bg-red-100">
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-screen overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingProduct ? 'Editar producto' : 'Nuevo producto'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input type="text" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Polo básico" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <input type="text" value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Ropa, Comida, Bebidas" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio costo</label>
                  <input type="number" value={form.cost_price}
                    onChange={e => setForm({ ...form, cost_price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio venta *</label>
                  <input type="number" value={form.sale_price}
                    onChange={e => setForm({ ...form, sale_price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Variantes de color</label>
                  <button onClick={addVariant} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                    + Agregar color
                  </button>
                </div>
                <div className="space-y-2">
                  {variants.map((v, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input type="text" value={v.color}
                        onChange={e => updateVariant(i, 'color', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Color (ej: Rojo, Azul)" />
                      <input type="number" value={v.stock}
                        onChange={e => updateVariant(i, 'stock', parseInt(e.target.value) || 0)}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Stock" />
                      {variants.length > 1 && (
                        <button onClick={() => removeVariant(i)} className="text-red-400 hover:text-red-600 text-lg">×</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded-lg text-sm">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}