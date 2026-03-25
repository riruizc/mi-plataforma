'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'

type Product = { id: string; name: string; category: string; sale_price: number; variants: { id: string; color: string }[] }
type DiscountRange = { id?: string; min_units: number; max_units: number | null; discount_pct: number; sort_order: number }
type WholesaleProduct = { product_id: string; product_name: string; base_price: number; is_active: boolean }
type Package = { id?: string; name: string; description: string; price: number; image_url: string; is_active: boolean; items: PackageItem[] }
type PackageItem = { product_id: string; variant_id: string | null; quantity: number; product_name: string; color: string }
type ClearanceItem = { product_id: string; variant_id: string | null; clearance_price: number; is_active: boolean; product_name: string; color: string }

export default function WholesalePage() {
  const [storeId, setStoreId] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'config' | 'packages' | 'clearance'>('config')
  const [saving, setSaving] = useState(false)
  const [saveOk, setSaveOk] = useState('')

  const [minUnits, setMinUnits] = useState(12)
  const [ranges, setRanges] = useState<DiscountRange[]>([])
  const [wholesaleProducts, setWholesaleProducts] = useState<WholesaleProduct[]>([])
  const [productSearch, setProductSearch] = useState('')

  const [packages, setPackages] = useState<Package[]>([])
  const [showPackageForm, setShowPackageForm] = useState(false)
  const [editingPackage, setEditingPackage] = useState<Package | null>(null)
  const [pkgForm, setPkgForm] = useState<Package>({ name: '', description: '', price: 0, image_url: '', is_active: true, items: [] })
  const [uploadingPkg, setUploadingPkg] = useState(false)
  const [pkgProductSearch, setPkgProductSearch] = useState('')
  const pkgFileRef = useRef<any>(null)

  const [clearanceItems, setClearanceItems] = useState<ClearanceItem[]>([])
  const [clearanceSearch, setClearanceSearch] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: store } = await supabase.from('stores').select('id, phone').eq('email', user.email).single()
      if (!store) return
      setStoreId(store.id)

      const [{ data: prods }, { data: wConfig }, { data: wRanges }, { data: wProds }, { data: wPkgs }, { data: wClear }] = await Promise.all([
        supabase.from('products').select('id, name, category, sale_price, product_variants(id, color)').eq('store_id', store.id).eq('is_active', true).order('name'),
        supabase.from('wholesale_config').select('*').eq('store_id', store.id).maybeSingle(),
        supabase.from('wholesale_discount_ranges').select('*').eq('store_id', store.id).order('sort_order'),
        supabase.from('wholesale_products').select('*').eq('store_id', store.id),
        supabase.from('wholesale_packages').select('*').eq('store_id', store.id).order('created_at'),
        supabase.from('wholesale_clearance').select('*').eq('store_id', store.id),
      ])

      const prodList = (prods || []).map((p: any) => ({ ...p, variants: p.product_variants || [] }))
      setProducts(prodList)
      if (wConfig) setMinUnits(wConfig.min_units || 12)
      setRanges(wRanges || [])

      const prodMap = new Map(prodList.map((p: any) => [p.id, p.name]))
      setWholesaleProducts((wProds || []).map((wp: any) => ({
        product_id: wp.product_id,
        product_name: prodMap.get(wp.product_id) || '',
        base_price: wp.base_price,
        is_active: wp.is_active,
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

      const variantMap = new Map()
      prodList.forEach((p: any) => {
        p.variants.forEach((v: any) => variantMap.set(v.id, { color: v.color, product_name: p.name }))
      })
      setClearanceItems((wClear || []).map((c: any) => {
        const vInfo = variantMap.get(c.variant_id)
        return { product_id: c.product_id, variant_id: c.variant_id, clearance_price: c.clearance_price, is_active: c.is_active, product_name: prodMap.get(c.product_id) || '', color: vInfo?.color || 'Sin variante' }
      }))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const showSuccess = (msg: string) => { setSaveOk(msg); setTimeout(() => setSaveOk(''), 3000) }

  const saveConfig = async () => {
    if (!storeId) return
    setSaving(true)
    try {
      const supabase = createClient()

      // Upsert config
      const { error: e1 } = await supabase.from('wholesale_config').upsert({ store_id: storeId, min_units: minUnits }, { onConflict: 'store_id' })
      if (e1) throw new Error('Config: ' + e1.message)

      // Ranges: delete all then insert fresh
      await supabase.from('wholesale_discount_ranges').delete().eq('store_id', storeId)
      if (ranges.length > 0) {
        const { error: e2 } = await supabase.from('wholesale_discount_ranges').insert(
          ranges.map((r, i) => ({ store_id: storeId, min_units: r.min_units, max_units: r.max_units, discount_pct: r.discount_pct, sort_order: i }))
        )
        if (e2) throw new Error('Rangos: ' + e2.message)
      }

      // Wholesale products: delete all then insert selected
      await supabase.from('wholesale_products').delete().eq('store_id', storeId)
      if (wholesaleProducts.length > 0) {
        const { error: e3 } = await supabase.from('wholesale_products').insert(
          wholesaleProducts.map(wp => ({ store_id: storeId, product_id: wp.product_id, base_price: wp.base_price || 0, is_active: true }))
        )
        if (e3) throw new Error('Productos: ' + e3.message)
      }

      showSuccess('✅ Configuración guardada correctamente')
    } catch (e: any) { alert('Error al guardar: ' + e.message) }
    finally { setSaving(false) }
  }

  const addRange = () => setRanges([...ranges, { min_units: minUnits, max_units: null, discount_pct: 10, sort_order: ranges.length }])
  const removeRange = (i: number) => setRanges(ranges.filter((_, idx) => idx !== i))
  const updateRange = (i: number, field: string, value: any) => setRanges(ranges.map((r, idx) => idx === i ? { ...r, [field]: value } : r))

  const toggleWholesaleProduct = (product: Product) => {
    const existing = wholesaleProducts.find(wp => wp.product_id === product.id)
    if (existing) {
      setWholesaleProducts(wholesaleProducts.filter(wp => wp.product_id !== product.id))
    } else {
      setWholesaleProducts([...wholesaleProducts, { product_id: product.id, product_name: product.name, base_price: product.sale_price, is_active: true }])
    }
  }

  const updateWholesalePrice = (productId: string, price: number) => {
    setWholesaleProducts(wholesaleProducts.map(wp => wp.product_id === productId ? { ...wp, base_price: price } : wp))
  }

  // Packages
  const openNewPackage = () => {
    setEditingPackage(null)
    setPkgForm({ name: '', description: '', price: 0, image_url: '', is_active: true, items: [] })
    setPkgProductSearch('')
    setShowPackageForm(true)
  }

  const openEditPackage = (pkg: Package) => {
    setEditingPackage(pkg)
    setPkgForm({ ...pkg })
    setPkgProductSearch('')
    setShowPackageForm(true)
  }

  const uploadPackageImage = async (file: File) => {
    if (!storeId) return
    setUploadingPkg(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `pkg-${storeId}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('logos').getPublicUrl(path)
      setPkgForm(p => ({ ...p, image_url: data.publicUrl }))
    } catch (e) { alert('Error al subir imagen') }
    finally { setUploadingPkg(false) }
  }

  const addPackageItem = (product: Product) => {
    setPkgForm(prev => ({
      ...prev,
      items: [...prev.items, {
        product_id: product.id,
        variant_id: product.variants[0]?.id || null,
        quantity: 1,
        product_name: product.name,
        color: product.variants[0]?.color || 'Único'
      }]
    }))
    setPkgProductSearch('')
  }

  const updatePackageItem = (i: number, field: string, value: any) => {
    setPkgForm(prev => ({
      ...prev,
      items: prev.items.map((item, idx) => {
        if (idx !== i) return item
        if (field === 'product_id') {
          const prod = products.find(p => p.id === value)
          return { ...item, product_id: value, product_name: prod?.name || '', variant_id: prod?.variants[0]?.id || null, color: prod?.variants[0]?.color || 'Único' }
        }
        if (field === 'variant_id') {
          const prod = products.find(p => p.id === item.product_id)
          const v = prod?.variants.find(v => v.id === value)
          return { ...item, variant_id: value, color: v?.color || 'Único' }
        }
        return { ...item, [field]: value }
      })
    }))
  }

  const savePackage = async () => {
    if (!storeId || !pkgForm.name || pkgForm.price <= 0) { alert('Nombre y precio son obligatorios'); return }
    setSaving(true)
    try {
      const supabase = createClient()
      let pkgId = editingPackage?.id
      if (editingPackage) {
        const { error } = await supabase.from('wholesale_packages').update({
          name: pkgForm.name, description: pkgForm.description, price: pkgForm.price,
          image_url: pkgForm.image_url, is_active: pkgForm.is_active
        }).eq('id', editingPackage.id)
        if (error) throw error
        await supabase.from('wholesale_package_items').delete().eq('package_id', editingPackage.id)
      } else {
        const { data: newPkg, error } = await supabase.from('wholesale_packages').insert({
          store_id: storeId, name: pkgForm.name, description: pkgForm.description,
          price: pkgForm.price, image_url: pkgForm.image_url, is_active: pkgForm.is_active
        }).select('id').single()
        if (error) throw error
        pkgId = newPkg?.id
      }
      if (pkgForm.items.length > 0 && pkgId) {
        const { error } = await supabase.from('wholesale_package_items').insert(
          pkgForm.items.map(item => ({ package_id: pkgId, product_id: item.product_id, variant_id: item.variant_id, quantity: item.quantity, product_name: item.product_name, color: item.color }))
        )
        if (error) throw error
      }
      setShowPackageForm(false)
      await loadData()
    } catch (e: any) { alert('Error al guardar paquete: ' + e.message) }
    finally { setSaving(false) }
  }

  const deletePackage = async (pkgId: string) => {
    if (!confirm('¿Eliminar este paquete?')) return
    const supabase = createClient()
    await supabase.from('wholesale_package_items').delete().eq('package_id', pkgId)
    await supabase.from('wholesale_packages').delete().eq('id', pkgId)
    loadData()
  }

  // Clearance
  const toggleClearanceItem = (productId: string, variantId: string | null, productName: string, color: string) => {
    const key = `${productId}_${variantId}`
    const existing = clearanceItems.find(c => `${c.product_id}_${c.variant_id}` === key)
    if (existing) {
      setClearanceItems(clearanceItems.filter(c => `${c.product_id}_${c.variant_id}` !== key))
    } else {
      setClearanceItems([...clearanceItems, { product_id: productId, variant_id: variantId, clearance_price: 0, is_active: true, product_name: productName, color }])
    }
  }

  const updateClearancePrice = (productId: string, variantId: string | null, price: number) => {
    const key = `${productId}_${variantId}`
    setClearanceItems(clearanceItems.map(c => `${c.product_id}_${c.variant_id}` === key ? { ...c, clearance_price: price } : c))
  }

  const saveClearance = async () => {
    if (!storeId) return
    setSaving(true)
    try {
      const supabase = createClient()
      await supabase.from('wholesale_clearance').delete().eq('store_id', storeId)
      const valid = clearanceItems.filter(c => c.clearance_price > 0)
      if (valid.length > 0) {
        const { error } = await supabase.from('wholesale_clearance').insert(
          valid.map(c => ({ store_id: storeId, product_id: c.product_id, variant_id: c.variant_id, clearance_price: c.clearance_price, is_active: true }))
        )
        if (error) throw error
      }
      showSuccess('✅ Remates guardados correctamente')
    } catch (e: any) { alert('Error al guardar remates: ' + e.message) }
    finally { setSaving(false) }
  }

  const filteredProducts = productSearch
    ? products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.category || '').toLowerCase().includes(productSearch.toLowerCase()))
    : products

  const filteredClearanceProducts = clearanceSearch
    ? products.filter(p => p.name.toLowerCase().includes(clearanceSearch.toLowerCase()))
    : products

  const pkgSearchResults = pkgProductSearch
    ? products.filter(p => p.name.toLowerCase().includes(pkgProductSearch.toLowerCase())).slice(0, 6)
    : []

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">🏭 Mayorista</h1>
        <p className="text-gray-500 text-sm mt-0.5">Configura tu catálogo mayorista público</p>
      </div>

      {saveOk && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-green-700 text-sm font-medium">{saveOk}</p>
        </div>
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key: 'config', label: '⚙️ Productos y descuentos' },
          { key: 'packages', label: '📦 Paquetes' },
          { key: 'clearance', label: '🔥 Remates' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === t.key ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB CONFIG ── */}
      {activeTab === 'config' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-1">Mínimo de unidades para ver precios</h2>
            <p className="text-xs text-gray-400 mb-3">El cliente debe escoger al menos este número de productos para ver el precio total</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setMinUnits(Math.max(1, minUnits - 1))}
                className="w-9 h-9 rounded-full bg-gray-100 text-gray-700 font-bold flex items-center justify-center touch-manipulation">−</button>
              <span className="text-2xl font-bold text-gray-900 w-12 text-center">{minUnits}</span>
              <button onClick={() => setMinUnits(minUnits + 1)}
                className="w-9 h-9 rounded-full bg-gray-100 text-gray-700 font-bold flex items-center justify-center touch-manipulation">+</button>
              <span className="text-sm text-gray-500">unidades mínimas</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-semibold text-gray-900">Rangos de descuento</h2>
                <p className="text-xs text-gray-400 mt-0.5">A mayor cantidad, mayor descuento sobre el precio base</p>
              </div>
              <button onClick={addRange} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium touch-manipulation">+ Agregar</button>
            </div>
            {ranges.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin rangos. Agrega uno para configurar los descuentos.</p>
            ) : (
              <div className="space-y-3">
                {ranges.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 flex-wrap bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">De</span>
                      <input type="number" value={r.min_units} onChange={e => updateRange(i, 'min_units', parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">a</span>
                      <input type="number" value={r.max_units ?? ''} onChange={e => updateRange(i, 'max_units', e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="∞" className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                      <span className="text-xs text-gray-500">pzas</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input type="number" value={r.discount_pct} onChange={e => updateRange(i, 'discount_pct', parseFloat(e.target.value) || 0)}
                        className="w-16 px-2 py-1.5 border border-green-300 rounded-lg text-sm text-center focus:outline-none focus:ring-1 focus:ring-green-500 bg-green-50" />
                      <span className="text-xs text-green-600 font-medium">% OFF</span>
                    </div>
                    <button onClick={() => removeRange(i)} className="text-red-400 text-xl ml-auto">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-1">Productos del catálogo mayorista</h2>
            <p className="text-xs text-gray-400 mb-3">Selecciona qué productos aparecen y define su precio base mayorista</p>
            {/* Search */}
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)}
                placeholder="Buscar producto..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {productSearch && <button onClick={() => setProductSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">×</button>}
            </div>
            {products.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No hay productos activos en el inventario</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {filteredProducts.map(product => {
                  const wp = wholesaleProducts.find(w => w.product_id === product.id)
                  const isSelected = !!wp
                  return (
                    <div key={product.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer touch-manipulation ${isSelected ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:border-gray-300'}`}
                      onClick={() => toggleWholesaleProduct(product)}>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                        {isSelected && <span className="text-white text-xs">✓</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{product.name}</p>
                        <p className="text-xs text-gray-400">
                          {product.category && `${product.category} · `}
                          Precio venta: S/ {Number(product.sale_price).toFixed(2)}
                          {product.variants.length > 0 && ` · ${product.variants.length} variantes`}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                          <span className="text-xs text-gray-500">Base:</span>
                          <input type="number" value={wp.base_price} onChange={e => updateWholesalePrice(product.id, parseFloat(e.target.value) || 0)}
                            className="w-20 px-2 py-1 border border-blue-300 rounded-lg text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                            onClick={e => e.stopPropagation()} />
                        </div>
                      )}
                    </div>
                  )
                })}
                {filteredProducts.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No se encontraron productos</p>}
              </div>
            )}
            {wholesaleProducts.length > 0 && (
              <p className="text-xs text-blue-600 mt-2 font-medium">{wholesaleProducts.length} producto{wholesaleProducts.length !== 1 ? 's' : ''} seleccionado{wholesaleProducts.length !== 1 ? 's' : ''}</p>
            )}
          </div>

          <button onClick={saveConfig} disabled={saving}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50 touch-manipulation">
            {saving ? '⏳ Guardando...' : '💾 Guardar configuración'}
          </button>
        </div>
      )}

      {/* ── TAB PACKAGES ── */}
      {activeTab === 'packages' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{packages.length} paquete{packages.length !== 1 ? 's' : ''}</p>
            <button onClick={openNewPackage} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium touch-manipulation">+ Nuevo paquete</button>
          </div>

          {packages.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <p className="text-4xl mb-3">📦</p>
              <p className="text-gray-500">No hay paquetes. Crea uno para empezar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {packages.map(pkg => (
                <div key={pkg.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  {pkg.image_url
                    ? <img src={pkg.image_url} alt={pkg.name} className="w-full h-36 object-cover" />
                    : <div className="w-full h-36 bg-gray-100 flex items-center justify-center text-4xl">📦</div>}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-bold text-gray-900">{pkg.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${pkg.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {pkg.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    {pkg.description && <p className="text-xs text-gray-500 mb-2">{pkg.description}</p>}
                    <p className="text-lg font-bold text-blue-600 mb-2">S/ {Number(pkg.price).toFixed(2)}</p>
                    {pkg.items.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {pkg.items.map((item, i) => (
                          <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {item.quantity}x {item.product_name}{item.color && item.color !== 'Único' ? ` (${item.color})` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => openEditPackage(pkg)} className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium touch-manipulation">✏️ Editar</button>
                      <button onClick={() => deletePackage(pkg.id!)} className="flex-1 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-medium touch-manipulation">🗑️ Eliminar</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showPackageForm && (
            <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
              <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[95vh] flex flex-col shadow-xl">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
                  <h3 className="font-bold text-gray-900">{editingPackage ? 'Editar paquete' : 'Nuevo paquete'}</h3>
                  <button onClick={() => setShowPackageForm(false)} className="text-gray-400 text-2xl touch-manipulation">×</button>
                </div>
                <div className="overflow-y-auto flex-1 p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
                      <input type="text" value={pkgForm.name} onChange={e => setPkgForm(p => ({ ...p, name: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ej: Pack verano" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
                      <input type="text" value={pkgForm.description} onChange={e => setPkgForm(p => ({ ...p, description: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Breve descripción del paquete" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Precio S/ *</label>
                      <input type="number" value={pkgForm.price} onChange={e => setPkgForm(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Estado</label>
                      <button onClick={() => setPkgForm(p => ({ ...p, is_active: !p.is_active }))}
                        className={`w-full py-2.5 rounded-xl text-sm font-medium border-2 touch-manipulation ${pkgForm.is_active ? 'border-green-400 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'}`}>
                        {pkgForm.is_active ? '✅ Activo' : '⭕ Inactivo'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Imagen del paquete
                      <span className="ml-1 text-gray-400 font-normal">(recomendado: 800×600px, JPG o PNG)</span>
                    </label>
                    <input ref={pkgFileRef} type="file" accept="image/*" className="hidden"
                      onChange={e => { if (e.target.files?.[0]) uploadPackageImage(e.target.files[0]) }} />
                    {pkgForm.image_url ? (
                      <div className="relative">
                        <img src={pkgForm.image_url} alt="Preview" className="w-full h-36 object-cover rounded-xl border border-gray-200" />
                        <button onClick={() => setPkgForm(p => ({ ...p, image_url: '' }))}
                          className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center text-sm touch-manipulation">×</button>
                      </div>
                    ) : (
                      <button onClick={() => pkgFileRef.current?.click()} disabled={uploadingPkg}
                        className="w-full py-8 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors touch-manipulation">
                        {uploadingPkg ? '⏳ Subiendo...' : '📷 Subir imagen (800×600px recomendado)'}
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">Contenido del paquete</label>
                    {/* Search to add products */}
                    <div className="relative mb-2">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                      <input type="text" value={pkgProductSearch} onChange={e => setPkgProductSearch(e.target.value)}
                        placeholder="Buscar producto para agregar..."
                        className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      {pkgProductSearch && <button onClick={() => setPkgProductSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg touch-manipulation">×</button>}
                    </div>
                    {pkgSearchResults.length > 0 && (
                      <div className="border border-gray-200 rounded-xl overflow-hidden mb-3 shadow-sm">
                        {pkgSearchResults.map(p => (
                          <button key={p.id} onClick={() => addPackageItem(p)}
                            className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-blue-50 border-b border-gray-50 last:border-0 flex items-center justify-between touch-manipulation">
                            <span>{p.name}</span>
                            <span className="text-xs text-blue-600 font-medium">+ Agregar</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {pkgForm.items.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-3">Busca productos arriba para agregarlos al paquete</p>
                    ) : (
                      <div className="space-y-2">
                        {pkgForm.items.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">{item.product_name}</p>
                              {products.find(p => p.id === item.product_id)?.variants?.length ? (
                                <select value={item.variant_id || ''} onChange={e => updatePackageItem(i, 'variant_id', e.target.value)}
                                  className="w-full mt-1 px-2 py-1 border border-gray-300 rounded-lg text-xs focus:outline-none bg-white">
                                  {products.find(p => p.id === item.product_id)?.variants.map(v => <option key={v.id} value={v.id}>{v.color}</option>)}
                                </select>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className="text-xs text-gray-500">Cant:</span>
                              <input type="number" value={item.quantity} min={1}
                                onChange={e => updatePackageItem(i, 'quantity', parseInt(e.target.value) || 1)}
                                className="w-14 px-2 py-1.5 border border-gray-300 rounded-lg text-xs text-center focus:outline-none" />
                            </div>
                            <button onClick={() => setPkgForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }))}
                              className="text-red-400 text-xl flex-shrink-0 touch-manipulation">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-5 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white">
                  <button onClick={savePackage} disabled={saving}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50 touch-manipulation">
                    {saving ? '⏳ Guardando...' : 'Guardar paquete'}
                  </button>
                  <button onClick={() => setShowPackageForm(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm touch-manipulation">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB CLEARANCE ── */}
      {activeTab === 'clearance' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-1">Productos en remate</h2>
            <p className="text-xs text-gray-400 mb-3">Selecciona productos y pon el precio de remate — no afecta el inventario ni el formulario</p>
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input type="text" value={clearanceSearch} onChange={e => setClearanceSearch(e.target.value)}
                placeholder="Buscar producto..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              {clearanceSearch && <button onClick={() => setClearanceSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg touch-manipulation">×</button>}
            </div>
            {products.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No hay productos activos</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredClearanceProducts.map(product => {
                  const hasVariants = product.variants.length > 0
                  if (hasVariants) {
                    return product.variants.map(variant => {
                      const key = `${product.id}_${variant.id}`
                      const ci = clearanceItems.find(c => `${c.product_id}_${c.variant_id}` === key)
                      const isSelected = !!ci
                      return (
                        <div key={key}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer touch-manipulation ${isSelected ? 'border-orange-400 bg-orange-50' : 'border-gray-100 hover:border-gray-300'}`}
                          onClick={() => toggleClearanceItem(product.id, variant.id, product.name, variant.color)}>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-orange-500 border-orange-500' : 'border-gray-300'}`}>
                            {isSelected && <span className="text-white text-xs">✓</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{product.name}</p>
                            <p className="text-xs text-gray-400">{variant.color}</p>
                          </div>
                          {isSelected && (
                            <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                              <span className="text-xs text-gray-500">S/</span>
                              <input type="number" value={ci!.clearance_price || ''}
                                onChange={e => updateClearancePrice(product.id, variant.id, parseFloat(e.target.value) || 0)}
                                placeholder="0.00"
                                className="w-20 px-2 py-1 border border-orange-300 rounded-lg text-xs text-center focus:outline-none bg-white"
                                onClick={e => e.stopPropagation()} />
                            </div>
                          )}
                        </div>
                      )
                    })
                  } else {
                    const key = `${product.id}_null`
                    const ci = clearanceItems.find(c => `${c.product_id}_${c.variant_id}` === key)
                    const isSelected = !!ci
                    return (
                      <div key={key}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer touch-manipulation ${isSelected ? 'border-orange-400 bg-orange-50' : 'border-gray-100 hover:border-gray-300'}`}
                        onClick={() => toggleClearanceItem(product.id, null, product.name, 'Único')}>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-orange-500 border-orange-500' : 'border-gray-300'}`}>
                          {isSelected && <span className="text-white text-xs">✓</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{product.name}</p>
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                            <span className="text-xs text-gray-500">S/</span>
                            <input type="number" value={ci!.clearance_price || ''}
                              onChange={e => updateClearancePrice(product.id, null, parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="w-20 px-2 py-1 border border-orange-300 rounded-lg text-xs text-center focus:outline-none bg-white"
                              onClick={e => e.stopPropagation()} />
                          </div>
                        )}
                      </div>
                    )
                  }
                })}
                {filteredClearanceProducts.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No se encontraron productos</p>}
              </div>
            )}
          </div>
          <button onClick={saveClearance} disabled={saving}
            className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold text-sm disabled:opacity-50 touch-manipulation">
            {saving ? '⏳ Guardando...' : '💾 Guardar remates'}
          </button>
        </div>
      )}
    </div>
  )
}