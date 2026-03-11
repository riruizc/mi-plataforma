'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Supplier = {
  id: string
  name: string
  contact_name: string
  phone: string
  email: string
  address: string
  notes: string
  is_active: boolean
  created_at: string
  products?: { id: string; name: string }[]
}

type Product = { id: string; name: string; supplier_id: string | null }

export default function SuppliersPage() {
  const [storeId, setStoreId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])

  const [showForm, setShowForm] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [form, setForm] = useState({ name: '', contact_name: '', phone: '', email: '', address: '', notes: '' })
  const [saving, setSaving] = useState(false)

  // Modal detalle + productos
  const [selected, setSelected] = useState<Supplier | null>(null)
  const [assigningProducts, setAssigningProducts] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: store } = await supabase.from('stores').select('id').eq('email', user.email).single()
      if (!store) return
      setStoreId(store.id)

      const { data: suppliersData } = await supabase.from('suppliers').select('*').eq('store_id', store.id).order('name')
      const { data: productsData } = await supabase.from('products').select('id, name, supplier_id').eq('store_id', store.id).eq('is_active', true).order('name')

      const prods = productsData || []
      setProducts(prods)

      // Mapear productos a cada proveedor
      const mapped = (suppliersData || []).map((s: any) => ({
        ...s,
        products: prods.filter((p: any) => p.supplier_id === s.id)
      }))
      setSuppliers(mapped)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const openNew = () => {
    setEditingSupplier(null)
    setForm({ name: '', contact_name: '', phone: '', email: '', address: '', notes: '' })
    setShowForm(true)
  }

  const openEdit = (supplier: Supplier) => {
    setSelected(null)
    setEditingSupplier(supplier)
    setForm({
      name: supplier.name || '',
      contact_name: supplier.contact_name || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
    })
    setShowForm(true)
  }

  const saveSupplier = async () => {
    if (!form.name) { alert('El nombre del proveedor es obligatorio'); return }
    if (!storeId) return
    setSaving(true)
    try {
      const supabase = createClient()
      if (editingSupplier) {
        await supabase.from('suppliers').update({ ...form }).eq('id', editingSupplier.id)
      } else {
        await supabase.from('suppliers').insert({ store_id: storeId, ...form })
      }
      setShowForm(false)
      loadData()
    } catch (e: any) { alert('Error: ' + e.message) }
    finally { setSaving(false) }
  }

  const toggleActive = async (supplier: Supplier) => {
    const supabase = createClient()
    await supabase.from('suppliers').update({ is_active: !supplier.is_active }).eq('id', supplier.id)
    loadData()
  }

  const deleteSupplier = async (supplier: Supplier) => {
    if (!confirm(`¿Eliminar a "${supplier.name}"?\n\nLos productos asociados quedarán sin proveedor.`)) return
    const supabase = createClient()
    await supabase.from('products').update({ supplier_id: null }).eq('supplier_id', supplier.id)
    await supabase.from('suppliers').delete().eq('id', supplier.id)
    setSelected(null)
    loadData()
  }

  const toggleProductSupplier = async (product: Product, supplierId: string) => {
    setAssigningProducts(true)
    const supabase = createClient()
    const newSupplierId = product.supplier_id === supplierId ? null : supplierId
    await supabase.from('products').update({ supplier_id: newSupplierId }).eq('id', product.id)
    await loadData()
    // Refrescar selected
    if (selected) {
      const updated = suppliers.find(s => s.id === selected.id)
      if (updated) setSelected({ ...updated, products: products.filter(p => p.supplier_id === selected.id) })
    }
    setAssigningProducts(false)
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
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Proveedores</h1>
          <p className="text-gray-500 text-sm mt-0.5">{suppliers.length} proveedores registrados</p>
        </div>
        <button onClick={openNew} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-sm">
          + Agregar
        </button>
      </div>

      {suppliers.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">🚚</p>
          <p className="text-gray-500 font-medium">No hay proveedores aún</p>
          <p className="text-gray-400 text-sm mt-1">Registra tus proveedores y asócialos a productos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {suppliers.map(supplier => (
            <div key={supplier.id} className={`bg-white rounded-xl border p-4 lg:p-5 ${!supplier.is_active ? 'opacity-60 border-gray-100' : 'border-gray-100'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-gray-900">{supplier.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${supplier.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {supplier.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  {supplier.contact_name && <p className="text-sm text-gray-600">👤 {supplier.contact_name}</p>}
                  <div className="flex flex-wrap gap-3 mt-1">
                    {supplier.phone && (
                      <a href={`https://wa.me/51${supplier.phone.replace(/\D/g, '')}`} target="_blank"
                        className="text-xs text-green-600 font-medium">📱 {supplier.phone}</a>
                    )}
                    {supplier.email && <p className="text-xs text-gray-400">✉️ {supplier.email}</p>}
                  </div>
                  {supplier.address && <p className="text-xs text-gray-400 mt-0.5">📍 {supplier.address}</p>}

                  {/* Productos asociados */}
                  {supplier.products && supplier.products.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {supplier.products.map(p => (
                        <span key={p.id} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{p.name}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-blue-600">{supplier.products?.length || 0} productos</p>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap mt-3">
                <button onClick={() => setSelected(supplier)}
                  className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium">📦 Productos</button>
                <button onClick={() => openEdit(supplier)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">✏️ Editar</button>
                <button onClick={() => toggleActive(supplier)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${supplier.is_active ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>
                  {supplier.is_active ? 'Desactivar' : 'Activar'}
                </button>
                <button onClick={() => deleteSupplier(supplier)}
                  className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL AGREGAR / EDITAR */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
              <h2 className="font-bold text-gray-900">{editingSupplier ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 text-2xl font-bold">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre del proveedor *</label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Distribuidora Lima SAC" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Persona de contacto</label>
                <input type="text" value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Juan Pérez" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Celular / WhatsApp</label>
                  <input type="text" inputMode="numeric" value={form.phone}
                    onChange={e => { const v = e.target.value.replace(/\D/g, ''); if (v.length <= 9) setForm(p => ({ ...p, phone: v })) }}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="999999999" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="correo@ejemplo.com" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Dirección</label>
                <input type="text" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Av. Principal 123, Lima" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notas <span className="text-gray-400">(opcional)</span></label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3} placeholder="Condiciones de pago, plazos de entrega, etc." />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={saveSupplier} disabled={saving}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ASIGNAR PRODUCTOS */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="font-bold text-gray-900">Productos de {selected.name}</h2>
                <p className="text-xs text-gray-400 mt-0.5">Toca un producto para asociarlo o desasociarlo</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 text-2xl font-bold">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {products.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">No hay productos en el inventario</p>
              ) : (
                <div className="space-y-2">
                  {products.map(product => {
                    const isAssigned = product.supplier_id === selected.id
                    const assignedToOther = product.supplier_id && product.supplier_id !== selected.id
                    const otherSupplier = assignedToOther ? suppliers.find(s => s.id === product.supplier_id) : null
                    return (
                      <button key={product.id}
                        onClick={() => !assignedToOther && toggleProductSupplier(product, selected.id)}
                        disabled={assigningProducts || !!assignedToOther}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors text-left ${
                          isAssigned ? 'bg-blue-50 border border-blue-200' :
                          assignedToOther ? 'bg-gray-50 border border-gray-100 opacity-60 cursor-not-allowed' :
                          'bg-gray-50 hover:bg-blue-50 border border-gray-100'
                        }`}>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{product.name}</p>
                          {otherSupplier && <p className="text-xs text-orange-500 mt-0.5">Asignado a: {otherSupplier.name}</p>}
                        </div>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isAssigned ? 'bg-blue-600' : 'bg-gray-200'}`}>
                          {isAssigned && <span className="text-white text-xs font-bold">✓</span>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="p-5 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setSelected(null)}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}