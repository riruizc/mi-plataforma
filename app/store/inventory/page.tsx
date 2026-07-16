'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { IconArchive, IconWallet, IconCamera, IconPlus, IconSearch, IconEdit, IconTrash, IconClose, IconPackage, IconTag } from '@/lib/icons'

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
      const { data: store } = await supabase.from('stores').select('id').eq('email', (user.email ?? '').toLowerCase()).single()
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
        await supabase.from('product_variants').update({ stock: Math.max(0, adj.stock + adj.adjust) }).eq('id', adj.variantId).eq('store_id', storeId)
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
      if (!user) { alert('No hay sesión activa'); setSaving(false); return }
      const { data: store } = await supabase.from('stores').select('id').eq('email', (user.email ?? '').toLowerCase()).single()
      if (!store) { alert('No se encontró la tienda'); setSaving(false); return }

      // Separar datos de producto (sin store_id para el update)
      const productUpdate = {
        name: form.name,
        category: form.category,
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
        // 1. Actualizar datos del producto
        const { error: updateError } = await supabase
          .from('products')
          .update(productUpdate)
          .eq('id', editingProduct.id)
          .eq('store_id', store.id)
        if (updateError) { alert('Error al actualizar: ' + updateError.message); setSaving(false); return }

        // 2. Manejo inteligente de variantes (sin borrar las que tienen pedidos)
        const newVariants = variants.filter(v => v.color.trim())
        const existingVariants = editingProduct.variants || []

        // Actualizar o insertar cada variante del formulario
        for (const v of newVariants) {
          const match = existingVariants.find(e =>
            e.id === (v as any).id ||
            e.color.trim().toLowerCase() === v.color.trim().toLowerCase()
          )
          if (match?.id) {
            // Actualizar variante existente
            await supabase.from('product_variants')
              .update({ color: v.color.trim(), stock: Number(v.stock) || 0 })
              .eq('id', match.id)
              .eq('store_id', store.id)
          } else {
            // Insertar variante nueva
            await supabase.from('product_variants').insert({
              product_id: editingProduct.id,
              store_id: store.id,
              color: v.color.trim(),
              stock: Number(v.stock) || 0
            })
          }
        }

        // Borrar variantes que fueron eliminadas del formulario
        // Una variante se eliminó si su id ya no aparece en el formulario
        let hasLockedVariants = false
        const newVariantIds = newVariants
          .map(v => (v as any).id)
          .filter(Boolean)

        for (const existing of existingVariants) {
          if (!existing.id) continue
          const stillInForm = newVariantIds.includes(existing.id)
          if (!stillInForm) {
            // Verificar si tiene pedidos antes de borrar
            const { data: refs } = await supabase
              .from('order_items')
              .select('id')
              .eq('variant_id', existing.id)
              .limit(1)
            if (!refs || refs.length === 0) {
              // Sin pedidos: borrar completamente
              await supabase.from('product_variants').delete().eq('id', existing.id).eq('store_id', store.id)
            } else {
              // Con pedidos: solo poner stock en 0 (no se puede borrar sin romper historial)
              await supabase.from('product_variants').update({ stock: 0 }).eq('id', existing.id).eq('store_id', store.id)
              hasLockedVariants = true
            }
          }
        }

        if (hasLockedVariants) {
          alert('Algunas variantes eliminadas tienen pedidos en el historial y se han dejado con stock 0 (no se pueden eliminar para conservar el historial de ventas).')
        }

      } else {
        // Insertar nuevo producto
        const { data: newProduct, error } = await supabase
          .from('products')
          .insert({ ...productUpdate, store_id: store.id })
          .select('id')
          .single()
        if (error) { alert('Error al crear: ' + error.message); setSaving(false); return }
        productId = newProduct?.id

        // Insertar variantes del nuevo producto
        const validVariants = variants.filter(v => v.color.trim())
        const uniqueVariants = validVariants.filter((v, i, arr) =>
          arr.findIndex(x => x.color.trim().toLowerCase() === v.color.trim().toLowerCase()) === i
        )
        if (uniqueVariants.length > 0 && productId) {
          const { error: varError } = await supabase.from('product_variants').insert(
            uniqueVariants.map(v => ({
              product_id: productId,
              store_id: store.id,
              color: v.color.trim(),
              stock: Number(v.stock) || 0
            }))
          )
          if (varError) { alert('Error al guardar variantes: ' + varError.message); setSaving(false); return }
        }
      }

      setShowForm(false)
      loadProducts()
    } catch (e: any) {
      alert('Error inesperado: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (product: Product) => {
    const supabase = createClient()
    await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id).eq('store_id', storeId)
    loadProducts()
  }

  const handleDelete = async (productId: string) => {
    if (!confirm('¿Eliminar este producto?')) return
    const supabase = createClient()
    await supabase.from('product_variants').delete().eq('product_id', productId).eq('store_id', storeId)
    await supabase.from('products').delete().eq('id', productId).eq('store_id', storeId)
    loadProducts()
  }

  const filteredProducts = searchQuery
    ? products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.category || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : products

  const ChannelBadge = ({ active, label }: { active: boolean; label: string }) => (
    <span className={`text-[10.5px] px-2 py-0.5 rounded-full font-semibold ${active ? 'bg-db-delivered-bg text-db-delivered' : 'bg-db-paper text-db-ink-soft'}`}>
      {label}
    </span>
  )

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-db-line border-t-db-brand rounded-full animate-spin mx-auto mb-2" />
        <p className="text-db-ink-soft text-sm">Cargando inventario...</p>
      </div>
    </div>
  )

  return (
    <div>
      {/* SCANNER */}
      {showScanner && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 bg-black">
            <h3 className="text-white font-bold text-lg">{scannerMode === 'form' ? 'Escanear código' : 'Pistolear'}</h3>
            <button onClick={closeScanner} className="text-white"><IconClose className="w-7 h-7" /></button>
          </div>
          {scannerError ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <IconCamera className="w-10 h-10 text-white/40 mb-4" />
              <p className="text-white text-lg font-bold mb-2">Sin acceso a la cámara</p>
              <p className="text-white/50 text-sm mb-6">{scannerError}</p>
              <button onClick={closeScanner} className="bg-white text-black px-6 py-3 rounded-full font-semibold">Cerrar</button>
            </div>
          ) : (
            <div className="flex-1 relative flex flex-col items-center justify-center">
              <video ref={videoRef} className="w-full max-w-lg" style={{ maxHeight: '70vh', objectFit: 'cover' }} />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-32 border-2 border-db-accent rounded-2xl relative">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-db-accent rounded-tl-2xl" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-db-accent rounded-tr-2xl" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-db-accent rounded-bl-2xl" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-db-accent rounded-br-2xl" />
                  {scanning && <div className="absolute top-0 left-0 right-0 h-0.5 bg-db-accent animate-bounce" style={{ animationDuration: '1s' }} />}
                </div>
              </div>
              <p className="text-white/70 text-sm mt-4 text-center px-6">{scanning ? 'Apunta el código al recuadro' : 'Iniciando cámara...'}</p>
            </div>
          )}
        </div>
      )}

      {/* STOCK MODAL */}
      {showStockModal && scannedProduct && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-db-surface rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              {scannedProduct.image_url
                ? <img src={scannedProduct.image_url} alt={scannedProduct.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                : <div className="w-12 h-12 rounded-xl bg-db-brand-tint flex items-center justify-center flex-shrink-0"><IconPackage className="w-5 h-5 text-db-brand" /></div>}
              <div>
                <h3 className="font-bold text-db-ink">{scannedProduct.name}</h3>
                <p className="text-xs text-db-ink-soft">{scannedProduct.category}</p>
              </div>
            </div>
            <div className="space-y-3 mb-5">
              {stockAdjustments.map((adj, i) => (
                <div key={i} className="bg-db-paper rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-db-ink">{adj.color}</span>
                    <span className="text-xs text-db-ink-soft">Actual: <strong className="font-data">{adj.stock}</strong></span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setStockAdjustments(prev => prev.map((a, idx) => idx === i ? { ...a, adjust: a.adjust - 1 } : a))}
                      className="w-9 h-9 bg-db-cancelled-bg text-db-cancelled rounded-full font-bold text-lg flex items-center justify-center touch-manipulation">−</button>
                    <div className="flex-1 text-center">
                      <span className={`text-xl font-bold font-data ${adj.adjust > 0 ? 'text-db-delivered' : adj.adjust < 0 ? 'text-db-cancelled' : 'text-db-ink-soft'}`}>
                        {adj.adjust > 0 ? '+' : ''}{adj.adjust}
                      </span>
                      <p className="text-xs text-db-ink-soft">Nuevo: {Math.max(0, adj.stock + adj.adjust)}</p>
                    </div>
                    <button onClick={() => setStockAdjustments(prev => prev.map((a, idx) => idx === i ? { ...a, adjust: a.adjust + 1 } : a))}
                      className="w-9 h-9 bg-db-delivered-bg text-db-delivered rounded-full font-bold text-lg flex items-center justify-center touch-manipulation">+</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={handleSaveStock} disabled={savingStock}
                className="flex-1 py-3 bg-db-brand text-white rounded-full font-semibold text-sm disabled:opacity-50 touch-manipulation">
                {savingStock ? 'Guardando...' : 'Guardar stock'}
              </button>
              <button onClick={() => { setShowStockModal(false); setScannedProduct(null) }}
                className="flex-1 py-3 bg-db-paper text-db-ink-soft rounded-full font-semibold text-sm touch-manipulation">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-db-ink">Inventario</h1>
          <p className="text-db-ink-soft mt-0.5 text-sm">{products.length} productos</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-db-surface border border-db-line rounded-full p-1">
            <button onClick={() => setTab('productos')}
              className={'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ' + (tab === 'productos' ? 'bg-db-brand text-white' : 'text-db-ink-soft')}>
              <IconArchive className="w-4 h-4" />Productos
            </button>
            <button onClick={() => setTab('finanzas')}
              className={'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ' + (tab === 'finanzas' ? 'bg-db-brand text-white' : 'text-db-ink-soft')}>
              <IconWallet className="w-4 h-4" />Finanzas
            </button>
          </div>
          {tab === 'productos' && (
            <>
              <button onClick={() => startScanner('inventory')}
                className="bg-db-accent-tint text-db-accent font-semibold px-3.5 py-2 rounded-full text-sm flex items-center gap-1.5 touch-manipulation">
                <IconCamera className="w-4 h-4" />Pistolear
              </button>
              <button onClick={openNew}
                className="bg-db-brand text-white font-semibold px-3.5 py-2 rounded-full text-sm flex items-center gap-1.5 touch-manipulation shadow-[0_4px_14px_-4px_rgba(36,81,232,0.55)]">
                <IconPlus className="w-4 h-4" />Nuevo
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      {tab === 'productos' && (
        <div className="relative mb-4">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-db-ink-soft"><IconSearch className="w-4 h-4" /></span>
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o categoría..."
            className="w-full pl-10 pr-9 py-2.5 rounded-2xl text-sm bg-db-surface border-0 shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] focus:outline-none focus:ring-2 focus:ring-db-brand" />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-db-ink-soft text-lg touch-manipulation leading-none">×</button>}
        </div>
      )}

      {/* PRODUCTOS */}
      {tab === 'productos' && (
        <>
          {filteredProducts.length === 0 ? (
            <div className="bg-db-surface rounded-2xl shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] p-12 text-center">
              <IconArchive className="w-8 h-8 mx-auto mb-3 text-db-ink-soft opacity-50" />
              <p className="text-db-ink-soft">{searchQuery ? 'No se encontraron productos' : 'No hay productos aún'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProducts.map(product => (
                <div key={product.id} className="bg-db-surface rounded-2xl shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] p-4">
                  <div className="flex gap-3">
                    {/* Image */}
                    <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-db-paper flex items-center justify-center">
                      {product.image_url
                        ? <img src={product.image_url} alt={product.name} className="w-full h-full object-contain p-1" />
                        : <IconPackage className="w-6 h-6 text-db-ink-soft opacity-50" />}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <h3 className="font-bold text-db-ink">{product.name}</h3>
                        <span className={`text-[10.5px] px-2 py-0.5 rounded-full font-semibold ${product.is_active ? 'bg-db-delivered-bg text-db-delivered' : 'bg-db-paper text-db-ink-soft'}`}>
                          {product.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                        {product.barcode && (
                          <span className="inline-flex items-center gap-1 text-[10.5px] px-2 py-0.5 rounded-full bg-db-accent-tint text-db-accent font-data">
                            <IconTag className="w-3 h-3" />{product.barcode}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-db-ink-soft mb-1.5">{product.category}</p>
                      <div className="flex gap-3 text-xs mb-2.5">
                        <span className="text-db-ink-soft">Costo: <strong className="font-data text-db-ink">S/ {Number(product.cost_price).toFixed(2)}</strong></span>
                        <span className="text-db-ink-soft">Venta: <strong className="font-data text-db-ink">S/ {Number(product.sale_price).toFixed(2)}</strong></span>
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
                            <span key={i} className="text-[11px] font-semibold bg-db-brand-tint text-db-brand px-2.5 py-1 rounded-full font-data">
                              {v.color} — {v.stock} und.
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <button onClick={() => openEdit(product)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-db-brand-tint text-db-brand touch-manipulation"><IconEdit className="w-3.5 h-3.5" />Editar</button>
                    <button onClick={() => toggleActive(product)} className={`px-3 py-1.5 rounded-full text-xs font-semibold touch-manipulation ${product.is_active ? 'bg-db-paper text-db-ink-soft' : 'bg-db-delivered-bg text-db-delivered'}`}>
                      {product.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                    <button onClick={() => handleDelete(product.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-db-cancelled-bg text-db-cancelled touch-manipulation"><IconTrash className="w-3.5 h-3.5" />Eliminar</button>
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
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              {[
                { label: 'Productos activos', val: String(activos), sub: `de ${products.length} en total`, color: 'text-db-ink' },
                { label: 'Stock total', val: String(totalStock), sub: 'unidades', color: 'text-db-brand' },
                { label: 'Valor en costo', val: `S/ ${valorCosto.toFixed(2)}`, sub: 'inversión', color: 'text-db-accent' },
                { label: 'Ganancia estimada', val: `S/ ${ganancia.toFixed(2)}`, sub: 'si vendes todo', color: 'text-db-delivered' },
              ].map(m => (
                <div key={m.label} className="bg-db-surface rounded-2xl shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] p-4">
                  <p className="text-xs text-db-ink-soft mb-1">{m.label}</p>
                  <p className={`text-xl lg:text-2xl font-bold font-data tabular-nums ${m.color}`}>{m.val}</p>
                  <p className="text-xs text-db-ink-soft mt-1">{m.sub}</p>
                </div>
              ))}
            </div>
            <div className="bg-db-surface rounded-2xl shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] p-5 overflow-x-auto">
              <h2 className="font-bold text-db-ink mb-4">Detalle por producto</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-db-line">
                    <th className="text-left py-2 text-db-ink-soft font-semibold text-xs uppercase tracking-wide">Producto</th>
                    <th className="text-right py-2 text-db-ink-soft font-semibold text-xs uppercase tracking-wide">Stock</th>
                    <th className="text-right py-2 text-db-ink-soft font-semibold text-xs uppercase tracking-wide">Costo</th>
                    <th className="text-right py-2 text-db-ink-soft font-semibold text-xs uppercase tracking-wide">Venta</th>
                    <th className="text-right py-2 text-db-ink-soft font-semibold text-xs uppercase tracking-wide">Margen</th>
                    <th className="text-right py-2 text-db-ink-soft font-semibold text-xs uppercase tracking-wide">Ganancia</th>
                  </tr>
                </thead>
                <tbody className="font-data tabular-nums">
                  {products.map(p => {
                    const stock = p.variants.reduce((s, v) => s + v.stock, 0)
                    const margen = Number(p.sale_price) - Number(p.cost_price)
                    const margenPct = Number(p.cost_price) > 0 ? (margen / Number(p.cost_price) * 100).toFixed(0) : '-'
                    return (
                      <tr key={p.id} className="border-b border-db-line last:border-0">
                        <td className="py-2.5 font-display"><p className="font-semibold text-db-ink">{p.name}</p><p className="text-xs text-db-ink-soft">{p.category}</p></td>
                        <td className="py-2.5 text-right font-semibold text-db-ink">{stock}</td>
                        <td className="py-2.5 text-right text-db-ink-soft">S/ {Number(p.cost_price).toFixed(2)}</td>
                        <td className="py-2.5 text-right text-db-ink-soft">S/ {Number(p.sale_price).toFixed(2)}</td>
                        <td className="py-2.5 text-right"><span className={margen >= 0 ? 'text-db-delivered font-semibold' : 'text-db-cancelled font-semibold'}>{margenPct}%</span></td>
                        <td className="py-2.5 text-right font-bold text-db-delivered">S/ {(stock * margen).toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="font-data tabular-nums">
                  <tr className="border-t-2 border-db-line">
                    <td className="py-2.5 font-bold text-db-ink font-display">TOTAL</td>
                    <td className="py-2.5 text-right font-bold text-db-ink">{totalStock}</td>
                    <td /><td /><td />
                    <td className="py-2.5 text-right font-bold text-db-delivered">S/ {ganancia.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      })()}

      {/* FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-db-surface rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-db-line sticky top-0 bg-db-surface rounded-t-2xl">
              <h3 className="text-lg font-bold text-db-ink">{editingProduct ? 'Editar producto' : 'Nuevo producto'}</h3>
              <button onClick={() => setShowForm(false)} className="text-db-ink-soft touch-manipulation"><IconClose className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Image upload */}
              <div>
                <label className="block text-sm font-semibold text-db-ink mb-1">
                  Imagen del producto
                  <span className="ml-1 text-xs text-db-ink-soft font-normal">(se comprime automáticamente a máx. 200KB)</span>
                </label>
                <input ref={imageFileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) uploadProductImage(e.target.files[0]) }} />
                {form.image_url ? (
                  <div className="relative w-24 h-24">
                    <img src={form.image_url} alt="Preview" className="w-24 h-24 rounded-xl object-cover border border-db-line" />
                    <button onClick={() => setForm(p => ({ ...p, image_url: '' }))}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-db-cancelled text-white rounded-full flex items-center justify-center touch-manipulation"><IconClose className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <button onClick={() => imageFileRef.current?.click()} disabled={uploadingImage}
                    className="w-full py-6 border-2 border-dashed border-db-line rounded-2xl text-sm text-db-ink-soft hover:border-db-brand hover:text-db-brand transition-colors touch-manipulation flex flex-col items-center gap-2">
                    <IconCamera className="w-6 h-6" />
                    {uploadingImage ? 'Comprimiendo y subiendo...' : 'Subir imagen · Recomendado: 500×500px'}
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-db-ink mb-1">Nombre *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand"
                  placeholder="Ej: Polo básico" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-db-ink mb-1">Categoría</label>
                <input type="text" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand"
                  placeholder="Ej: Ropa, Tecnología" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-db-ink mb-1">Precio costo</label>
                  <input type="number" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })}
                    className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand font-data" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-db-ink mb-1">Precio venta *</label>
                  <input type="number" value={form.sale_price} onChange={e => setForm({ ...form, sale_price: e.target.value })}
                    className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand font-data" placeholder="0.00" />
                </div>
              </div>

              {/* Barcode */}
              <div>
                <label className="block text-sm font-semibold text-db-ink mb-1">Código de barras</label>
                <div className="flex gap-2">
                  <input type="text" value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })}
                    className="flex-1 px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand font-data"
                    placeholder="Escanea o escribe el código" />
                  <button type="button" onClick={() => startScanner('form')}
                    className="px-3.5 py-2 bg-db-accent-tint text-db-accent rounded-xl font-medium hover:opacity-80 touch-manipulation"><IconCamera className="w-4 h-4" /></button>
                </div>
              </div>

              {/* Visibility toggles */}
              <div>
                <label className="block text-sm font-semibold text-db-ink mb-2">¿Dónde se muestra este producto?</label>
                <div className="space-y-2">
                  {[
                    { key: 'show_in_form', label: 'Formulario de pedidos', desc: 'Afecta el stock al comprar' },
                    { key: 'show_in_catalog', label: 'Catálogo público', desc: 'Solo muestra, no descuenta stock' },
                    { key: 'show_in_wholesale', label: 'Catálogo Mayorista', desc: 'Aparece en la sección mayorista' },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between p-3 bg-db-paper rounded-xl">
                      <div>
                        <p className="text-sm font-semibold text-db-ink">{label}</p>
                        <p className="text-xs text-db-ink-soft">{desc}</p>
                      </div>
                      <button onClick={() => setForm(p => ({ ...p, [key]: !(p as any)[key] }))}
                        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 touch-manipulation ${(form as any)[key] ? 'bg-db-delivered' : 'bg-db-line'}`}>
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${(form as any)[key] ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Variants */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-db-ink">Variantes de color</label>
                  <button onClick={() => setVariants([...variants, { color: '', stock: 0 }])} className="text-xs text-db-brand font-semibold touch-manipulation">+ Agregar color</button>
                </div>
                <div className="space-y-2">
                  {variants.map((v, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input type="text" value={v.color} onChange={e => setVariants(variants.map((vv, idx) => idx === i ? { ...vv, color: e.target.value } : vv))}
                        className="flex-1 px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand"
                        placeholder="Color (ej: Rojo, Azul)" />
                      <input type="number" value={v.stock} onChange={e => setVariants(variants.map((vv, idx) => idx === i ? { ...vv, stock: parseInt(e.target.value) || 0 } : vv))}
                        className="w-20 px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand text-center font-data"
                        placeholder="Stock" />
                      {variants.length > 1 && (
                        <button onClick={() => setVariants(variants.filter((_, idx) => idx !== i))} className="text-db-cancelled touch-manipulation"><IconClose className="w-4 h-4" /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-db-line sticky bottom-0 bg-db-surface">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-db-brand text-white font-semibold py-3 rounded-full text-sm disabled:opacity-50 touch-manipulation">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="flex-1 bg-db-paper text-db-ink-soft font-semibold py-3 rounded-full text-sm touch-manipulation">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}