'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { IconTruck, IconPlus, IconClose, IconEdit, IconTrash, IconUsers, IconMapPin, IconMail, IconCheck } from '@/lib/icons'

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
        await supabase.from('suppliers').update({ ...form }).eq('id', editingSupplier.id).eq('store_id', storeId)
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
    await supabase.from('suppliers').update({ is_active: !supplier.is_active }).eq('id', supplier.id).eq('store_id', storeId)
    loadData()
  }

  const deleteSupplier = async (supplier: Supplier) => {
    if (!confirm(`¿Eliminar a "${supplier.name}"?\n\nLos productos asociados quedarán sin proveedor.`)) return
    const supabase = createClient()
    const { data: deletedSupplier } = await supabase.from('suppliers').delete().eq('id', supplier.id).eq('store_id', storeId).select('id').maybeSingle()
    if (!deletedSupplier) return
    await supabase.from('products').update({ supplier_id: null }).eq('supplier_id', supplier.id).eq('store_id', storeId)
    setSelected(null)
    loadData()
  }

  const toggleProductSupplier = async (product: Product, supplierId: string) => {
    setAssigningProducts(true)
    const supabase = createClient()
    const newSupplierId = product.supplier_id === supplierId ? null : supplierId
    await supabase.from('products').update({ supplier_id: newSupplierId }).eq('id', product.id).eq('store_id', storeId)
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
      <div className="w-8 h-8 border-4 border-db-line border-t-db-brand rounded-full animate-spin mx-auto" />
    </div>
  )

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-db-ink">Proveedores</h1>
          <p className="text-db-ink-soft text-sm mt-0.5">{suppliers.length} proveedores registrados</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-1.5 bg-db-brand text-white font-semibold px-4 py-2.5 rounded-full text-sm shadow-[0_4px_14px_-4px_rgba(36,81,232,0.55)]">
          <IconPlus className="w-4 h-4" />Agregar
        </button>
      </div>

      {suppliers.length === 0 ? (
        <div className="bg-db-surface rounded-2xl shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] p-12 text-center">
          <IconTruck className="w-8 h-8 mx-auto mb-3 text-db-ink-soft opacity-50" />
          <p className="text-db-ink font-semibold">No hay proveedores aún</p>
          <p className="text-db-ink-soft text-sm mt-1">Registra tus proveedores y asócialos a productos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {suppliers.map(supplier => (
            <div key={supplier.id} className={`bg-db-surface rounded-2xl shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] p-4 lg:p-5 ${!supplier.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-db-ink">{supplier.name}</h3>
                    <span className={`text-[10.5px] px-2 py-0.5 rounded-full font-semibold ${supplier.is_active ? 'bg-db-delivered-bg text-db-delivered' : 'bg-db-paper text-db-ink-soft'}`}>
                      {supplier.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  {supplier.contact_name && <p className="text-sm text-db-ink-soft flex items-center gap-1.5"><IconUsers className="w-3.5 h-3.5" />{supplier.contact_name}</p>}
                  <div className="flex flex-wrap gap-3 mt-1">
                    {supplier.phone && (
                      <a href={`https://wa.me/51${supplier.phone.replace(/\D/g, '')}`} target="_blank"
                        className="text-xs text-db-delivered font-semibold font-data">{supplier.phone}</a>
                    )}
                    {supplier.email && <p className="text-xs text-db-ink-soft flex items-center gap-1"><IconMail className="w-3 h-3" />{supplier.email}</p>}
                  </div>
                  {supplier.address && <p className="text-xs text-db-ink-soft mt-0.5 flex items-center gap-1"><IconMapPin className="w-3 h-3" />{supplier.address}</p>}

                  {/* Productos asociados */}
                  {supplier.products && supplier.products.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {supplier.products.map(p => (
                        <span key={p.id} className="text-[11px] font-semibold bg-db-brand-tint text-db-brand px-2.5 py-1 rounded-full">{p.name}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-db-brand font-data">{supplier.products?.length || 0} productos</p>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap mt-3">
                <button onClick={() => setSelected(supplier)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-db-brand-tint text-db-brand rounded-full text-xs font-semibold"><IconTruck className="w-3.5 h-3.5" />Productos</button>
                <button onClick={() => openEdit(supplier)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-db-paper text-db-ink-soft rounded-full text-xs font-semibold"><IconEdit className="w-3.5 h-3.5" />Editar</button>
                <button onClick={() => toggleActive(supplier)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold ${supplier.is_active ? 'bg-db-accent-tint text-db-accent' : 'bg-db-delivered-bg text-db-delivered'}`}>
                  {supplier.is_active ? 'Desactivar' : 'Activar'}
                </button>
                <button onClick={() => deleteSupplier(supplier)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-db-cancelled-bg text-db-cancelled rounded-full text-xs font-semibold"><IconTrash className="w-3.5 h-3.5" />Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL AGREGAR / EDITAR */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-db-surface rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-db-line flex-shrink-0">
              <h2 className="font-bold text-db-ink">{editingSupplier ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
              <button onClick={() => setShowForm(false)} className="text-db-ink-soft"><IconClose className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-db-ink mb-1">Nombre del proveedor *</label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand"
                  placeholder="Ej: Distribuidora Lima SAC" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-db-ink mb-1">Persona de contacto</label>
                <input type="text" value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand"
                  placeholder="Ej: Juan Pérez" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-db-ink mb-1">Celular / WhatsApp</label>
                  <input type="text" inputMode="numeric" value={form.phone}
                    onChange={e => { const v = e.target.value.replace(/\D/g, ''); if (v.length <= 9) setForm(p => ({ ...p, phone: v })) }}
                    className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand font-data"
                    placeholder="999999999" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-db-ink mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand"
                    placeholder="correo@ejemplo.com" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-db-ink mb-1">Dirección</label>
                <input type="text" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand"
                  placeholder="Av. Principal 123, Lima" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-db-ink mb-1">Notas <span className="text-db-ink-soft font-normal">(opcional)</span></label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand resize-none"
                  rows={3} placeholder="Condiciones de pago, plazos de entrega, etc." />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-db-line flex-shrink-0">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-3 border border-db-line text-db-ink-soft rounded-full text-sm font-semibold">Cancelar</button>
              <button onClick={saveSupplier} disabled={saving}
                className="flex-1 py-3 bg-db-brand text-white rounded-full text-sm font-bold disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ASIGNAR PRODUCTOS */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-db-surface rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-db-line flex-shrink-0">
              <div>
                <h2 className="font-bold text-db-ink">Productos de {selected.name}</h2>
                <p className="text-xs text-db-ink-soft mt-0.5">Toca un producto para asociarlo o desasociarlo</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-db-ink-soft"><IconClose className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {products.length === 0 ? (
                <p className="text-center text-db-ink-soft text-sm py-8">No hay productos en el inventario</p>
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
                          isAssigned ? 'bg-db-brand-tint' :
                          assignedToOther ? 'bg-db-paper opacity-60 cursor-not-allowed' :
                          'bg-db-paper hover:bg-db-brand-tint'
                        }`}>
                        <div>
                          <p className="font-semibold text-db-ink text-sm">{product.name}</p>
                          {otherSupplier && <p className="text-xs text-db-accent mt-0.5">Asignado a: {otherSupplier.name}</p>}
                        </div>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isAssigned ? 'bg-db-brand' : 'bg-db-line'}`}>
                          {isAssigned && <IconCheck className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="p-5 border-t border-db-line flex-shrink-0">
              <button onClick={() => setSelected(null)}
                className="w-full py-3 bg-db-paper text-db-ink-soft rounded-full text-sm font-semibold">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
