'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'

type Variant = { id?: string; color: string; stock: number }
type Product = {
  id: string; name: string; category: string
  cost_price: number; sale_price: number
  is_active: boolean; barcode: string
  image_url: string | null
  show_in_form: boolean; show_in_catalog: boolean; show_in_wholesale: boolean
  variants: Variant[]
}

async function compressImage(file: File, maxKB = 200): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX_SIZE = 600
      let w = img.width, h = img.height
      if (w > MAX_SIZE || h > MAX_SIZE) {
        if (w > h) { h = Math.round(h * MAX_SIZE / w); w = MAX_SIZE }
        else { w = Math.round(w * MAX_SIZE / h); h = MAX_SIZE }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url)
        if (blob) resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
        else resolve(file)
      }, 'image/jpeg', 0.82)
    }
    img.src = url
  })
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState({ name: '', category: '', cost_price: '', sale_price: '', barcode: '', image_url: '', show_in_form: true, show_in_catalog: true, show_in_wholesale: false })
  const [variants, setVariants] = useState<Variant[]>([{ color: '', stock: 0 }])
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'productos' | 'finanzas'>('productos')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const [showScanner, setShowScanner] = useState(false)
  const [scannerMode, setScannerMode] = useState<'inventory' | 'form'>('inventory')
  const [scannerError, setScannerError] = useState('')
  const [scanning, setScanning] = useState(false)
  const [showStockModal, setShowStockModal] = useState(false)
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null)
  const [stockAdjustments, setStockAdjustments] = useState<{ variantId: string; color: string; stock: number; adjust: number }[]>([])
  const [savingStock, setSavingStock] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<any>(null)
  const hasScannedRef = useRef(false)
  const imageFileRef = useRef<any>(null)

  useEffect(() => { loadProducts() }, [])

  const loadProducts = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: store } = await supabase.from('stores').select('id').eq('email', user.email).single()
      if (!store) return
      setStoreId(store.id)
      const { data } = await supabase.from('products').select('*, product_variants(*)').eq('store_id', store.id).order('created_at', { ascending: false })
      setProducts((data || []).map((p: any) => ({
        ...p,
        variants: p.product_variants || [],
        show_in_form: p.show_in_form !== false,
        show_in_catalog: p.show_in_catalog !== false,
        show_in_wholesale: p.show_in_wholesale || false,
      })))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const uploadProductImage = async (file: File) => {
    if (!storeId) return
    setUploadingImage(true)
    try {
      const supabase = createClient()
      const compressed = await compressImage(file)
      const path = `product-${storeId}-${Date.now()}.jpg`
      const { error } = await supabase.storage.from('logos').upload(path, compressed, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('logos').getPublicUrl(path)
      setForm(p => ({ ...p, image_url: data.publicUrl }))
    } catch (e) { alert('Error al subir imagen') }
    finally { setUploadingImage(false) }
  }

  const startScanner = async (mode: 'inventory' | 'form') => {
    hasScannedRef.current = false
    setScannerMode(mode); setScannerError(''); setShowScanner(true); setScanning(false)
  }

  useEffect(() => {
    if (!showScanner) return
    const initScanner = async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const codeReader = new BrowserMultiFormatReader()
        scannerRef.current = codeReader
        const devices = await BrowserMultiFormatReader.listVideoInputDevices()
        if (devices.length === 0) { setScannerError('No se encontró cámara'); return }
        const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear') || d.label.toLowerCase().includes('trasera'))
        const deviceId = backCamera?.deviceId || devices[devices.length - 1].deviceId
        setScanning(true)
        await codeReader.decodeFromVideoDevice(deviceId, videoRef.current!, (result: any) => {
          if (result) handleBarcodeDetected(result.getText())
        })
      } catch (e: any) { setScannerError('Error al iniciar la cámara: ' + e.message) }
    }
    initScanner()
    return () => { try { scannerRef.current?.reset() } catch (_) {} }
  }, [showScanner])

  const handleBarcodeDetected = (code: string) => {
    if (hasScannedRef.current) return
    hasScannedRef.current = true
    try { scannerRef.current?.reset() } catch (_) {}
    setShowScanner(false); setScanning(false)
    if (scannerMode === 'form') { setForm(f => ({ ...f, barcode: code })); return }
    const found = products.find(p => p.barcode === code)
    if (found) {
      setScannedProduct(found)
      setStockAdjustments(found.variants.length > 0
        ? found.variants.map(v => ({ variantId: v.id || '', color: v.color, stock: v.stock, adjust: 0 }))
        : [{ variantId: '', color: 'Sin variante', stock: 0, adjust: 0 }])
      setShowStockModal(true)
    } else {
      setEditingProduct(null)
      setForm({ name: '', category: '', cost_price: '', sale_price: '', barcode: code, image_url: '', show_in_form: true, show_in_catalog: true, show_in_wholesale: false })
      setVariants([{ color: '', stock: 0 }])
      setShowForm(true)
    }
  }

  const closeScanner = () => { try { scannerRef.current?.reset() } catch (_) {}; setShowScanner(false); setScanning(false); setScannerError('') }

  const handleSaveStock = async () => {
    if (!scannedProduct) return
    setSavingStock(true)
    try {
      const supabase = createClient()
      for (const adj of stockAdjustments) {
        if (adj.adjust === 0 || !adj.variantId) continue
        await supabase.from('product_variants').update({ stock: Math.max(0, adj.stock + adj.adjust) }).eq('id', adj.variantId)
      }
      setShowStockModal(false); setScannedProduct(null); loadProducts()
    } catch (e: any) { alert('Error: ' + e.message) }
    finally { setSavingStock(false) }
  }

  const openNew = () => {
    setEditingProduct(null)
    setForm({ name: '', category: '', cost_price: '', sale_price: '', barcode: '', image_url: '', show_in_form: true, show_in_catalog: true, show_in_wholesale: false })
    setVariants([{ color: '', stock: 0 }])
    setShowForm(true)
  }

  const openEdit = (product: Product) => {
    setEditingProduct(product)
    setForm({
      name: product.name, category: product.category,
      cost_price: String(product.cost_price), sale_price: String(product.sale_price),
      barcode: product.barcode || '', image_url: product.image_url || '',
      show_in_form: product.show_in_form !== false,
      show_in_catalog: product.show_in_catalog !== false,
      show_in_wholesale: product.show_in_wholesale || false,
    })
    setVariants(product.variants.length > 0 ? product.variants : [{ color: '', stock: 0 }])
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.sale_price) { alert('Nombre y precio de venta son obligatorios'); return }
    if (saving) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: store } = await supabase.from('stores').select('id').eq('email', user.email).single()
      if (!store) return

      const productData = {
        store_id: store.id,
        name: form.name, category: form.category,
        cost_price: parseFloat(form.cost_price) || 0,
        sale_price: parseFloat(form.sale_price) || 0,
        barcode: form.barcode.trim() || null,
        image_url: form.image_url || null,
        show_in_form: form.show_in_form,
        show_in_catalog: form.show_in_catalog,
        show_in_wholesale: form.show_in_wholesale,
        is_active: true,
      }

      let productId = editingProduct?.id
      if (editingProduct) {
        await supabase.from('products').update(productData).eq('id', editingProduct.id)
        await supabase.from('product_variants').delete().eq('product_id', editingProduct.id)
      } else {
        const { data: newProduct, error } = await supabase.from('products').insert(productData).select('id').single()
        if (error) { alert('Error: ' + error.message); return }
        productId = newProduct?.id
      }

      const validVariants = variants.filter(v => v.color.trim())
      if (validVariants.length > 0 && productId) {
        await supabase.from('product_variants').insert(
          validVariants.map(v => ({ product_id: productId, store_id: store.id, color: v.color, stock: Number(v.stock) || 0 }))
        )
      }
      setShowForm(false); loadProducts()
    } catch (e: any) { alert('Error: ' + e.message) }
    finally { setSaving(false) }
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

  const filteredProducts = searchQuery
    ? products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.category || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : products

  const ChannelBadge = ({ active, label }: { active: boolean; label: string }) => (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
      {active ? '✓' : '✗'} {label}
    </span>
  )

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-500">Cargando inventario...</p>
    </div>
  )

  return (
    <div>
      {/* SCANNER */}
      {showScanner && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 bg-black">
            <h3 className="text-white font-semibold text-lg">{scannerMode === 'form' ? 'Escanear código' : '📷 Pistolear'}</h3>
            <button onClick={closeScanner} className="text-white text-3xl leading-none">×</button>
          </div>
          {scannerError ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <p className="text-4xl mb-4">📷</p>
              <p className="text-white text-lg font-semibold mb-2">Sin acceso a la cámara</p>
              <p className="text-gray-400 text-sm mb-6">{scannerError}</p>
              <button onClick={closeScanner} className="bg-white text-black px-6 py-3 rounded-xl font-semibold">Cerrar</button>
            </div>
          ) : (
            <div className="flex-1 relative flex flex-col items-center justify-center">
              <video ref={videoRef} className="w-full max-w-lg" style={{ maxHeight: '70vh', objectFit: 'cover' }} />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-32 border-2 border-yellow-400 rounded-lg relative">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-yellow-400 rounded-tl" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-yellow-400 rounded-tr" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-yellow-400 rounded-bl" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-yellow-400 rounded-br" />
                  {scanning && <div className="absolute top-0 left-0 right-0 h-0.5 bg-yellow-400 animate-bounce" style={{ animationDuration: '1s' }} />}
                </div>
              </div>
              <p className="text-white text-sm mt-4 text-center px-6">{scanning ? 'Apunta el código al recuadro amarillo' : 'Iniciando cámara...'}</p>
            </div>
          )}
        </div>
      )}

      {/* STOCK MODAL */}
      {showStockModal && scannedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              {scannedProduct.image_url
                ? <img src={scannedProduct.image_url} alt={scannedProduct.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                : <span className="text-2xl">📦</span>}
              <div>
                <h3 className="font-bold text-gray-900">{scannedProduct.name}</h3>
                <p className="text-xs text-gray-400">{scannedProduct.category}</p>
              </div>
            </div>
            <div className="space-y-3 mb-5">
              {stockAdjustments.map((adj, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{adj.color}</span>
                    <span className="text-xs text-gray-400">Actual: <strong>{adj.stock}</strong></span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setStockAdjustments(prev => prev.map((a, idx) => idx === i ? { ...a, adjust: a.adjust - 1 } : a))}
                      className="w-9 h-9 bg-red-100 text-red-600 rounded-lg font-bold text-lg flex items-center justify-center touch-manipulation">−</button>
                    <div className="flex-1 text-center">
                      <span className={`text-xl font-bold ${adj.adjust > 0 ? 'text-green-600' : adj.adjust < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {adj.adjust > 0 ? '+' : ''}{adj.adjust}
                      </span>
                      <p className="text-xs text-gray-400">Nuevo: {Math.max(0, adj.stock + adj.adjust)}</p>
                    </div>
                    <button onClick={() => setStockAdjustments(prev => prev.map((a, idx) => idx === i ? { ...a, adjust: a.adjust + 1 } : a))}
                      className="w-9 h-9 bg-green-100 text-green-600 rounded-lg font-bold text-lg flex items-center justify-center touch-manipulation">+</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={handleSaveStock} disabled={savingStock}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50 touch-manipulation">
                {savingStock ? 'Guardando...' : 'Guardar stock'}
              </button>
              <button onClick={() => { setShowStockModal(false); setScannedProduct(null) }}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm touch-manipulation">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="text-gray-500 mt-0.5">{products.length} productos</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            <button onClick={() => setTab('productos')}
              className={'px-3 py-1.5 rounded-lg text-sm font-medium ' + (tab === 'productos' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500')}>
              📦 Productos
            </button>
            <button onClick={() => setTab('finanzas')}
              className={'px-3 py-1.5 rounded-lg text-sm font-medium ' + (tab === 'finanzas' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500')}>
              💰 Finanzas
            </button>
          </div>
          {tab === 'productos' && (
            <>
              <button onClick={() => startScanner('inventory')}
                className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-semibold px-3 py-2 rounded-lg text-sm flex items-center gap-1.5 touch-manipulation">
                📷 Pistolear
              </button>
              <button onClick={openNew}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-2 rounded-lg text-sm touch-manipulation">
                + Nuevo
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      {tab === 'productos' && (
        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o categoría..."
            className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg touch-manipulation">×</button>}
        </div>
      )}

      {/* PRODUCTOS */}
      {tab === 'productos' && (
        <>
          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
              <p className="text-4xl mb-3">🗃️</p>
              <p className="text-gray-500">{searchQuery ? 'No se encontraron productos' : 'No hay productos aún'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProducts.map(product => (
                <div key={product.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex gap-3">
                    {/* Image */}
                    <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-gray-100 bg-gray-50 flex items-center justify-center">
                      {product.image_url
                        ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                        : <span className="text-2xl">📦</span>}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{product.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${product.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {product.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                        {product.barcode && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-mono">🔖 {product.barcode}</span>}
                      </div>
                      <p className="text-xs text-gray-500 mb-1">{product.category}</p>
                      <div className="flex gap-3 text-xs mb-2">
                        <span className="text-gray-500">Costo: <strong>S/ {Number(product.cost_price).toFixed(2)}</strong></span>
                        <span className="text-gray-900">Venta: <strong>S/ {Number(product.sale_price).toFixed(2)}</strong></span>
                      </div>
                      {/* Channel visibility */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        <ChannelBadge active={product.show_in_form} label="Formulario" />
                        <ChannelBadge active={product.show_in_catalog} label="Catálogo" />
                        <ChannelBadge active={product.show_in_wholesale} label="Mayorista" />
                      </div>
                      {product.variants.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {product.variants.map((v, i) => (
                            <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {v.color} — {v.stock} und.
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <button onClick={() => openEdit(product)} className="px-3 py-1.5 rounded-lg text-xs bg-blue-50 text-blue-600 touch-manipulation">✏️ Editar</button>
                    <button onClick={() => toggleActive(product)} className={`px-3 py-1.5 rounded-lg text-xs touch-manipulation ${product.is_active ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-green-600'}`}>
                      {product.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                    <button onClick={() => handleDelete(product.id)} className="px-3 py-1.5 rounded-lg text-xs bg-red-50 text-red-600 touch-manipulation">Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* FINANZAS */}
      {tab === 'finanzas' && (() => {
        const activos = products.filter(p => p.is_active).length
        const totalStock = products.reduce((sum, p) => sum + p.variants.reduce((s, v) => s + v.stock, 0), 0)
        const valorCosto = products.reduce((sum, p) => sum + p.variants.reduce((s, v) => s + v.stock * Number(p.cost_price), 0), 0)
        const valorVenta = products.reduce((sum, p) => sum + p.variants.reduce((s, v) => s + v.stock * Number(p.sale_price), 0), 0)
        const ganancia = valorVenta - valorCosto
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Productos activos', val: activos, sub: `de ${products.length} en total`, color: 'text-gray-900' },
                { label: 'Stock total', val: totalStock, sub: 'unidades', color: 'text-blue-600' },
                { label: 'Valor en costo', val: `S/ ${valorCosto.toFixed(2)}`, sub: 'inversión', color: 'text-orange-500' },
                { label: 'Ganancia estimada', val: `S/ ${ganancia.toFixed(2)}`, sub: 'si vendes todo', color: 'text-green-600' },
              ].map(m => (
                <div key={m.label} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                  <p className={`text-2xl font-bold ${m.color}`}>{m.val}</p>
                  <p className="text-xs text-gray-400 mt-1">{m.sub}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 overflow-x-auto">
              <h2 className="font-semibold text-gray-900 mb-4">Detalle por producto</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-gray-500 font-medium">Producto</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Stock</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Costo</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Venta</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Margen</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Ganancia</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => {
                    const stock = p.variants.reduce((s, v) => s + v.stock, 0)
                    const margen = Number(p.sale_price) - Number(p.cost_price)
                    const margenPct = Number(p.cost_price) > 0 ? (margen / Number(p.cost_price) * 100).toFixed(0) : '-'
                    return (
                      <tr key={p.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-2.5"><p className="font-medium text-gray-900">{p.name}</p><p className="text-xs text-gray-400">{p.category}</p></td>
                        <td className="py-2.5 text-right font-medium">{stock}</td>
                        <td className="py-2.5 text-right text-gray-600">S/ {Number(p.cost_price).toFixed(2)}</td>
                        <td className="py-2.5 text-right text-gray-600">S/ {Number(p.sale_price).toFixed(2)}</td>
                        <td className="py-2.5 text-right"><span className={margen >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>{margenPct}%</span></td>
                        <td className="py-2.5 text-right font-bold text-green-600">S/ {(stock * margen).toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td className="py-2.5 font-bold text-gray-900">TOTAL</td>
                    <td className="py-2.5 text-right font-bold">{totalStock}</td>
                    <td /><td /><td />
                    <td className="py-2.5 text-right font-bold text-green-600">S/ {ganancia.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      })()}

      {/* FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
              <h3 className="text-lg font-semibold text-gray-900">{editingProduct ? 'Editar producto' : 'Nuevo producto'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 text-2xl touch-manipulation">×</button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Image upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Imagen del producto
                  <span className="ml-1 text-xs text-gray-400 font-normal">(se comprime automáticamente a máx. 200KB)</span>
                </label>
                <input ref={imageFileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) uploadProductImage(e.target.files[0]) }} />
                {form.image_url ? (
                  <div className="relative w-24 h-24">
                    <img src={form.image_url} alt="Preview" className="w-24 h-24 rounded-xl object-cover border border-gray-200" />
                    <button onClick={() => setForm(p => ({ ...p, image_url: '' }))}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs touch-manipulation">×</button>
                  </div>
                ) : (
                  <button onClick={() => imageFileRef.current?.click()} disabled={uploadingImage}
                    className="w-full py-6 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors touch-manipulation">
                    {uploadingImage ? '⏳ Comprimiendo y subiendo...' : '📷 Subir imagen · Recomendado: 500×500px'}
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Polo básico" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <input type="text" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Ropa, Tecnología" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio costo</label>
                  <input type="number" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio venta *</label>
                  <input type="number" value={form.sale_price} onChange={e => setForm({ ...form, sale_price: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
                </div>
              </div>

              {/* Barcode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código de barras</label>
                <div className="flex gap-2">
                  <input type="text" value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })}
                    className="flex-1 px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    placeholder="Escanea o escribe el código" />
                  <button type="button" onClick={() => startScanner('form')}
                    className="px-3 py-2 bg-yellow-100 text-yellow-700 rounded-xl text-sm font-medium hover:bg-yellow-200 touch-manipulation">📷</button>
                </div>
              </div>

              {/* Visibility toggles */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">¿Dónde se muestra este producto?</label>
                <div className="space-y-2">
                  {[
                    { key: 'show_in_form', label: '🔗 Formulario de pedidos', desc: 'Afecta el stock al comprar' },
                    { key: 'show_in_catalog', label: '🛍️ Catálogo público', desc: 'Solo muestra, no descuenta stock' },
                    { key: 'show_in_wholesale', label: '🏭 Catálogo Mayorista', desc: 'Aparece en la sección mayorista' },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{label}</p>
                        <p className="text-xs text-gray-400">{desc}</p>
                      </div>
                      <button onClick={() => setForm(p => ({ ...p, [key]: !(p as any)[key] }))}
                        className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 touch-manipulation ${(form as any)[key] ? 'bg-green-500' : 'bg-gray-300'}`}>
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${(form as any)[key] ? 'translate-x-7' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Variants */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Variantes de color</label>
                  <button onClick={() => setVariants([...variants, { color: '', stock: 0 }])} className="text-xs text-blue-600 font-medium touch-manipulation">+ Agregar color</button>
                </div>
                <div className="space-y-2">
                  {variants.map((v, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input type="text" value={v.color} onChange={e => setVariants(variants.map((vv, idx) => idx === i ? { ...vv, color: e.target.value } : vv))}
                        className="flex-1 px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Color (ej: Rojo, Azul)" />
                      <input type="number" value={v.stock} onChange={e => setVariants(variants.map((vv, idx) => idx === i ? { ...vv, stock: parseInt(e.target.value) || 0 } : vv))}
                        className="w-20 px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                        placeholder="Stock" />
                      {variants.length > 1 && (
                        <button onClick={() => setVariants(variants.filter((_, idx) => idx !== i))} className="text-red-400 text-xl touch-manipulation">×</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-blue-600 text-white font-medium py-3 rounded-xl text-sm disabled:opacity-50 touch-manipulation">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="flex-1 bg-gray-100 text-gray-700 font-medium py-3 rounded-xl text-sm touch-manipulation">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}