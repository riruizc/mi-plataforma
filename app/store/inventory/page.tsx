'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'

type Variant = { id?: string; color: string; stock: number }
type Product = {
  id: string
  name: string
  category: string
  cost_price: number
  sale_price: number
  is_active: boolean
  barcode: string
  variants: Variant[]
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState({ name: '', category: '', cost_price: '', sale_price: '', barcode: '' })
  const [variants, setVariants] = useState<Variant[]>([{ color: '', stock: 0 }])
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'productos' | 'finanzas'>('productos')

  // Scanner states
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

  useEffect(() => { loadProducts() }, [])

  const loadProducts = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: store } = await supabase.from('stores').select('id').eq('email', user.email).single()
      if (!store) return
      setStoreId(store.id)
      const { data } = await supabase
        .from('products')
        .select('*, product_variants(*)')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })
      const mapped = (data || []).map((p: any) => ({ ...p, variants: p.product_variants || [] }))
      setProducts(mapped)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // ── SCANNER ──────────────────────────────────────────────
  const startScanner = async (mode: 'inventory' | 'form') => {
    hasScannedRef.current = false
    setScannerMode(mode)
    setScannerError('')
    setShowScanner(true)
    setScanning(false)
  }

  useEffect(() => {
    if (!showScanner) return
    let codeReader: any = null

    const initScanner = async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        codeReader = new BrowserMultiFormatReader()
        scannerRef.current = codeReader

        const devices = await BrowserMultiFormatReader.listVideoInputDevices()
        if (devices.length === 0) {
          setScannerError('No se encontró cámara en este dispositivo')
          return
        }

        // Preferir cámara trasera
        const backCamera = devices.find(d =>
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('trasera')
        )
        const deviceId = backCamera?.deviceId || devices[devices.length - 1].deviceId

        setScanning(true)
        await codeReader.decodeFromVideoDevice(deviceId, videoRef.current!, (result: any, err: any) => {
          if (result) {
            const code = result.getText()
            handleBarcodeDetected(code)
          }
        })
      } catch (e: any) {
        setScannerError('Error al iniciar la cámara: ' + e.message)
      }
    }

    initScanner()

    return () => {
      try { scannerRef.current?.reset() } catch (_) {}
    }
  }, [showScanner])

  const handleBarcodeDetected = (code: string) => {
    if (hasScannedRef.current) return
    hasScannedRef.current = true
    try { scannerRef.current?.reset() } catch (_) {}
    setShowScanner(false)
    setScanning(false)

    if (scannerMode === 'form') {
      // Modo formulario: llenar campo barcode
      setForm(f => ({ ...f, barcode: code }))
      return
    }

    // Modo inventario: buscar producto
    const found = products.find(p => p.barcode === code)
    if (found) {
      // Abrir modal de ajuste de stock
      setScannedProduct(found)
      setStockAdjustments(
        found.variants.length > 0
          ? found.variants.map(v => ({ variantId: v.id || '', color: v.color, stock: v.stock, adjust: 0 }))
          : [{ variantId: '', color: 'Sin variante', stock: 0, adjust: 0 }]
      )
      setShowStockModal(true)
    } else {
      // Producto no encontrado → abrir formulario nuevo con código
      setEditingProduct(null)
      setForm({ name: '', category: '', cost_price: '', sale_price: '', barcode: code })
      setVariants([{ color: '', stock: 0 }])
      setShowForm(true)
    }
  }

  const closeScanner = () => {
    try { scannerRef.current?.reset() } catch (_) {}
    setShowScanner(false)
    setScanning(false)
    setScannerError('')
  }

  // ── STOCK MODAL ──────────────────────────────────────────
  const handleSaveStock = async () => {
    if (!scannedProduct) return
    setSavingStock(true)
    try {
      const supabase = createClient()
      for (const adj of stockAdjustments) {
        if (adj.adjust === 0) continue
        if (adj.variantId) {
          const newStock = Math.max(0, adj.stock + adj.adjust)
          await supabase.from('product_variants').update({ stock: newStock }).eq('id', adj.variantId)
        }
      }
      setShowStockModal(false)
      setScannedProduct(null)
      loadProducts()
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setSavingStock(false)
    }
  }

  // ── PRODUCT FORM ─────────────────────────────────────────
  const openNew = () => {
    setEditingProduct(null)
    setForm({ name: '', category: '', cost_price: '', sale_price: '', barcode: '' })
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
      barcode: product.barcode || '',
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
      const { data: store } = await supabase.from('stores').select('id').eq('email', user.email).single()
      if (!store) { alert('No se encontró la tienda'); return }

      const productData = {
        store_id: store.id,
        name: form.name,
        category: form.category,
        cost_price: parseFloat(form.cost_price) || 0,
        sale_price: parseFloat(form.sale_price) || 0,
        barcode: form.barcode.trim() || null,
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
      {/* ── SCANNER MODAL ── */}
      {showScanner && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 bg-black">
            <h3 className="text-white font-semibold text-lg">
              {scannerMode === 'form' ? 'Escanear código' : '📷 Pistolear producto'}
            </h3>
            <button onClick={closeScanner} className="text-white text-3xl leading-none">×</button>
          </div>

          {scannerError ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <p className="text-4xl mb-4">📷</p>
              <p className="text-white text-lg font-semibold mb-2">Sin acceso a la cámara</p>
              <p className="text-gray-400 text-sm mb-6">{scannerError}</p>
              <button onClick={closeScanner} className="bg-white text-black px-6 py-3 rounded-xl font-semibold">
                Cerrar
              </button>
            </div>
          ) : (
            <div className="flex-1 relative flex flex-col items-center justify-center">
              <video ref={videoRef} className="w-full max-w-lg" style={{ maxHeight: '70vh', objectFit: 'cover' }} />
              {/* Visor */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-32 border-2 border-yellow-400 rounded-lg relative">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-yellow-400 rounded-tl" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-yellow-400 rounded-tr" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-yellow-400 rounded-bl" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-yellow-400 rounded-br" />
                  {scanning && <div className="absolute top-0 left-0 right-0 h-0.5 bg-yellow-400 animate-bounce" style={{ animationDuration: '1s' }} />}
                </div>
              </div>
              <p className="text-white text-sm mt-4 text-center px-6">
                {scanning ? 'Apunta el código de barras al recuadro amarillo' : 'Iniciando cámara...'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── STOCK ADJUSTMENT MODAL ── */}
      {showStockModal && scannedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">📦</span>
              <div>
                <h3 className="font-bold text-gray-900">{scannedProduct.name}</h3>
                <p className="text-xs text-gray-400">{scannedProduct.category} · Cód: {scannedProduct.barcode}</p>
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-4 mt-3">Ajusta el stock por variante:</p>

            <div className="space-y-3 mb-5">
              {stockAdjustments.map((adj, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{adj.color}</span>
                    <span className="text-xs text-gray-400">Stock actual: <strong>{adj.stock}</strong></span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setStockAdjustments(prev => prev.map((a, idx) => idx === i ? { ...a, adjust: a.adjust - 1 } : a))}
                      className="w-9 h-9 bg-red-100 text-red-600 rounded-lg font-bold text-lg flex items-center justify-center">−</button>
                    <div className="flex-1 text-center">
                      <span className={`text-xl font-bold ${adj.adjust > 0 ? 'text-green-600' : adj.adjust < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {adj.adjust > 0 ? '+' : ''}{adj.adjust}
                      </span>
                      <p className="text-xs text-gray-400">Nuevo: {Math.max(0, adj.stock + adj.adjust)}</p>
                    </div>
                    <button
                      onClick={() => setStockAdjustments(prev => prev.map((a, idx) => idx === i ? { ...a, adjust: a.adjust + 1 } : a))}
                      className="w-9 h-9 bg-green-100 text-green-600 rounded-lg font-bold text-lg flex items-center justify-center">+</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={handleSaveStock} disabled={savingStock}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50">
                {savingStock ? 'Guardando...' : 'Guardar stock'}
              </button>
              <button onClick={() => { setShowStockModal(false); setScannedProduct(null) }}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="text-gray-500 mt-1">{products.length} productos</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
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
                className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                📷 Pistolear
              </button>
              <button onClick={openNew}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm">
                + Nuevo
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── TAB PRODUCTOS ── */}
      {tab === 'productos' && (
        <>
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
                        {product.barcode && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-mono">
                            🔖 {product.barcode}
                          </span>
                        )}
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
                    <div className="flex gap-2 flex-wrap">
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
        </>
      )}

      {/* ── TAB FINANZAS ── */}
      {tab === 'finanzas' && (() => {
        const totalProductos = products.length
        const activos = products.filter(p => p.is_active).length
        const totalStock = products.reduce((sum, p) => sum + p.variants.reduce((s, v) => s + v.stock, 0), 0)
        const valorCosto = products.reduce((sum, p) => sum + p.variants.reduce((s, v) => s + v.stock * Number(p.cost_price), 0), 0)
        const valorVenta = products.reduce((sum, p) => sum + p.variants.reduce((s, v) => s + v.stock * Number(p.sale_price), 0), 0)
        const gananciaEstimada = valorVenta - valorCosto
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500 mb-1">Productos activos</p>
                <p className="text-3xl font-bold text-gray-900">{activos}</p>
                <p className="text-xs text-gray-400 mt-1">de {totalProductos} en total</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500 mb-1">Stock total</p>
                <p className="text-3xl font-bold text-blue-600">{totalStock}</p>
                <p className="text-xs text-gray-400 mt-1">unidades disponibles</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500 mb-1">Valor en costo</p>
                <p className="text-3xl font-bold text-orange-500">S/ {valorCosto.toFixed(2)}</p>
                <p className="text-xs text-gray-400 mt-1">inversión en stock</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500 mb-1">Ganancia estimada</p>
                <p className="text-3xl font-bold text-green-600">S/ {gananciaEstimada.toFixed(2)}</p>
                <p className="text-xs text-gray-400 mt-1">si vendes todo el stock</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Detalle por producto</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 text-gray-500 font-medium">Producto</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Stock</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Costo unit.</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Venta unit.</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Margen</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Ganancia est.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => {
                      const stock = p.variants.reduce((s, v) => s + v.stock, 0)
                      const margen = Number(p.sale_price) - Number(p.cost_price)
                      const margenPct = Number(p.cost_price) > 0 ? (margen / Number(p.cost_price) * 100).toFixed(0) : '-'
                      const ganancia = stock * margen
                      return (
                        <tr key={p.id} className="border-b border-gray-50 last:border-0">
                          <td className="py-3">
                            <p className="font-medium text-gray-900">{p.name}</p>
                            <p className="text-xs text-gray-400">{p.category}</p>
                          </td>
                          <td className="py-3 text-right font-medium text-gray-900">{stock}</td>
                          <td className="py-3 text-right text-gray-600">S/ {Number(p.cost_price).toFixed(2)}</td>
                          <td className="py-3 text-right text-gray-600">S/ {Number(p.sale_price).toFixed(2)}</td>
                          <td className="py-3 text-right">
                            <span className={'font-medium ' + (margen >= 0 ? 'text-green-600' : 'text-red-500')}>{margenPct}%</span>
                          </td>
                          <td className="py-3 text-right font-bold text-green-600">S/ {ganancia.toFixed(2)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200">
                      <td className="py-3 font-bold text-gray-900">TOTAL</td>
                      <td className="py-3 text-right font-bold text-gray-900">{totalStock}</td>
                      <td /><td /><td />
                      <td className="py-3 text-right font-bold text-green-600">S/ {gananciaEstimada.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── PRODUCT FORM MODAL ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-screen overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingProduct ? 'Editar producto' : 'Nuevo producto'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Polo básico" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <input type="text" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Ropa, Comida, Bebidas" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio costo</label>
                  <input type="number" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio venta *</label>
                  <input type="number" value={form.sale_price} onChange={e => setForm({ ...form, sale_price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00" />
                </div>
              </div>

              {/* Código de barras */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código de barras</label>
                <div className="flex gap-2">
                  <input type="text" value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    placeholder="Escanea o escribe el código" />
                  <button type="button" onClick={() => startScanner('form')}
                    className="px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg text-sm font-medium hover:bg-yellow-200">
                    📷
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Variantes de color</label>
                  <button onClick={addVariant} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Agregar color</button>
                </div>
                <div className="space-y-2">
                  {variants.map((v, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input type="text" value={v.color} onChange={e => updateVariant(i, 'color', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Color (ej: Rojo, Azul)" />
                      <input type="number" value={v.stock} onChange={e => updateVariant(i, 'stock', parseInt(e.target.value) || 0)}
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