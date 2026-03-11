'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Store = { id: string; name: string; owner_name: string; email: string; phone: string; status: string; store_prefix: string; expires_at: string; created_at: string }
type Features = {
  settings: boolean; orders: boolean; customers: boolean; quotes: boolean;
  suppliers: boolean; finances: boolean; goals: boolean;
  inventory: boolean; combos: boolean; routes: boolean; summary: boolean;
  tools: boolean; comprobante: boolean;
}

const FEATURE_LABELS: { key: keyof Features; label: string; icon: string; desc: string }[] = [
  { key: 'settings',    label: 'Ajustes',          icon: '⚙️',  desc: 'Configuración de la tienda, formulario y contacto' },
  { key: 'orders',      label: 'Pedidos',           icon: '📦',  desc: 'Gestión y seguimiento de pedidos' },
  { key: 'customers',   label: 'Clientes',          icon: '👥',  desc: 'Base de datos de clientes con historial' },
  { key: 'quotes',      label: 'Cotizaciones',      icon: '📄',  desc: 'Crear y gestionar cotizaciones' },
  { key: 'suppliers',   label: 'Proveedores',       icon: '🚚',  desc: 'Directorio de proveedores' },
  { key: 'finances',    label: 'Finanzas',          icon: '💰',  desc: 'Capital, ingresos y egresos' },
  { key: 'goals',       label: 'Metas',             icon: '🎯',  desc: 'Seguimiento de objetivos de venta' },
  { key: 'inventory',   label: 'Inventario',        icon: '🗃️',  desc: 'Stock, variantes y código de barras' },
  { key: 'combos',      label: 'Combos',            icon: '🎁',  desc: 'Paquetes de productos con precio especial' },
  { key: 'routes',      label: 'Rutas',             icon: '🗺️',  desc: 'Planificación de rutas de delivery' },
  { key: 'summary',     label: 'Resumen',           icon: '📈',  desc: 'Reportes de ventas por período' },
  { key: 'tools',       label: 'Herramientas',      icon: '🔧',  desc: 'Etiquetas y lector de código de barras' },
  { key: 'comprobante', label: 'Comprobante PDF',   icon: '🧾',  desc: 'Genera y envía PDF de pedidos por WhatsApp' },
]

const DEFAULT_FEATURES: Features = {
  settings: true, orders: true, customers: true, quotes: true,
  suppliers: true, finances: true, goals: true,
  inventory: true, combos: true, routes: true, summary: true,
  tools: true, comprobante: true,
}

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [featuresStore, setFeaturesStore] = useState<Store | null>(null)
  const [features, setFeatures] = useState<Features>(DEFAULT_FEATURES)
  const [savingFeatures, setSavingFeatures] = useState(false)
  const [savedOk, setSavedOk] = useState(false)

  useEffect(() => { loadStores() }, [])

  const loadStores = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('stores').select('*').not('status', 'eq', 'pending').not('status', 'eq', 'admin').order('created_at', { ascending: false })
    setStores(data || [])
    setLoading(false)
  }

  const toggleStatus = async (store: Store) => {
    const newStatus = store.status === 'active' ? 'inactive' : 'active'
    const supabase = createClient()
    await supabase.from('stores').update({ status: newStatus }).eq('id', store.id)
    loadStores()
  }

  const extendPlan = async (storeId: string, days: number) => {
    const supabase = createClient()
    const expires = new Date()
    expires.setDate(expires.getDate() + days)
    await supabase.from('stores').update({ expires_at: expires.toISOString() }).eq('id', storeId)
    loadStores()
  }

  const deleteStore = async (store: Store) => {
    if (!confirm(`⚠️ ¿Estás seguro de eliminar "${store.name}"?\n\nEsto borrará TODOS sus pedidos, productos, clientes y rutas. Esta acción no se puede deshacer.`)) return
    setDeleting(store.id)
    try {
      const res = await fetch('/api/admin/delete-store', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: store.id, email: store.email })
      })
      if (!res.ok) throw new Error('Error al eliminar')
      loadStores()
    } catch (e) {
      alert('Error al eliminar la tienda. Intenta de nuevo.')
    } finally {
      setDeleting(null)
    }
  }

  const openFeatures = async (store: Store) => {
    setSavedOk(false)
    setFeaturesStore(store)
    const supabase = createClient()
    const { data } = await supabase.from('store_features').select('*').eq('store_id', store.id).single()
    if (data) {
      setFeatures({
        settings:    data.settings    ?? true,
        orders:      data.orders      ?? true,
        customers:   data.customers   ?? true,
        quotes:      data.quotes      ?? true,
        suppliers:   data.suppliers   ?? true,
        finances:    data.finances    ?? true,
        goals:       data.goals       ?? true,
        inventory:   data.inventory   ?? true,
        combos:      data.combos      ?? true,
        routes:      data.routes      ?? true,
        summary:     data.summary     ?? true,
        tools:       data.labels      ?? true,
        comprobante: data.comprobante ?? true,
      })
    } else {
      const supabase2 = createClient()
      await supabase2.from('store_features').insert({
        store_id: store.id,
        settings: true, orders: true, customers: true, quotes: true,
        suppliers: true, finances: true, goals: true,
        inventory: true, routes: true, summary: true,
        labels: true, comprobante: true, combos: true,
      })
      setFeatures(DEFAULT_FEATURES)
    }
  }

  const saveFeatures = async () => {
    if (!featuresStore) return
    setSavingFeatures(true)
    setSavedOk(false)
    const supabase = createClient()
    const { error } = await supabase.from('store_features').upsert({
      store_id:    featuresStore.id,
      settings:    features.settings,
      orders:      features.orders,
      customers:   features.customers,
      quotes:      features.quotes,
      suppliers:   features.suppliers,
      finances:    features.finances,
      goals:       features.goals,
      inventory:   features.inventory,
      combos:      features.combos,
      routes:      features.routes,
      summary:     features.summary,
      labels:      features.tools,
      comprobante: features.comprobante,
    }, { onConflict: 'store_id' })

    setSavingFeatures(false)
    if (error) {
      alert('Error al guardar: ' + error.message)
    } else {
      setSavedOk(true)
      setTimeout(() => {
        setSavedOk(false)
        setFeaturesStore(null)
      }, 1200)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto" />
    </div>
  )

  return (
    <div>
      {/* MODAL FEATURES */}
      {featuresStore && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl max-h-[90vh] flex flex-col">
            <div className="mb-4">
              <h3 className="font-bold text-gray-900 text-lg">⚙️ Módulos activos</h3>
              <p className="text-gray-500 text-sm mt-0.5">{featuresStore.name}</p>
              <p className="text-xs text-gray-400 mt-1">Dashboard siempre visible. El resto puedes activarlo o desactivarlo.</p>
            </div>

            <div className="overflow-y-auto flex-1 -mx-1 px-1">
              {FEATURE_LABELS.map(({ key, label, icon, desc }) => (
                <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div className="flex items-start gap-3 flex-1 min-w-0 pr-3">
                    <span className="text-lg mt-0.5">{icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">{label}</p>
                      <p className="text-xs text-gray-400 leading-tight">{desc}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setFeatures(prev => ({ ...prev, [key]: !prev[key] }))}
                    className={`flex-shrink-0 relative w-12 h-6 rounded-full transition-colors duration-200 ${features[key] ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${features[key] ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>

            {savedOk && (
              <div className="mt-3 py-2 bg-green-50 border border-green-200 rounded-xl text-center">
                <p className="text-green-700 text-sm font-medium">✅ Cambios guardados</p>
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button onClick={saveFeatures} disabled={savingFeatures}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50">
                {savingFeatures ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button onClick={() => setFeaturesStore(null)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Gestión de tiendas</h1>
        <p className="text-gray-500 text-sm mt-0.5">{stores.length} tiendas registradas</p>
      </div>

      {stores.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">🏪</p>
          <p className="text-gray-500">No hay tiendas activas aún</p>
        </div>
      ) : (
        <div className="space-y-3">
          {stores.map(store => (
            <div key={store.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 lg:p-6">
              <div className="flex items-start gap-2 mb-3 flex-wrap">
                <h3 className="font-semibold text-gray-900">{store.name}</h3>
                <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{store.store_prefix}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${store.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {store.status === 'active' ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <div className="text-xs text-gray-500 space-y-0.5 mb-3">
                <p>👤 {store.owner_name} · ✉️ {store.email}</p>
                <p>📅 Vence: {store.expires_at ? new Date(store.expires_at).toLocaleDateString('es-PE') : 'Sin fecha'}</p>
              </div>

              <div className="grid grid-cols-2 sm:flex gap-2">
                <button onClick={() => toggleStatus(store)}
                  className={`py-2 rounded-lg text-xs font-medium touch-manipulation ${store.status === 'active' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                  {store.status === 'active' ? '🔴 Desactivar' : '🟢 Activar'}
                </button>
                {[30, 60, 90].map(days => (
                  <button key={days} onClick={() => extendPlan(store.id, days)}
                    className="py-2 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 touch-manipulation">
                    +{days} días
                  </button>
                ))}
                <button onClick={() => openFeatures(store)}
                  className="py-2 rounded-lg text-xs font-medium bg-purple-50 text-purple-600 touch-manipulation">
                  ⚙️ Módulos
                </button>
                <button onClick={() => deleteStore(store)} disabled={deleting === store.id}
                  className="py-2 rounded-lg text-xs font-medium bg-red-600 text-white touch-manipulation disabled:opacity-50 sm:ml-auto">
                  {deleting === store.id ? '⏳ Eliminando...' : '🗑️ Eliminar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}