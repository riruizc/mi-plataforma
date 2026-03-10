'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Store = { id: string; name: string; owner_name: string; email: string; phone: string; status: string; store_prefix: string; expires_at: string; created_at: string }

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto" />
    </div>
  )

  return (
    <div>
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
                <button
                  onClick={() => deleteStore(store)}
                  disabled={deleting === store.id}
                  className="py-2 rounded-lg text-xs font-medium bg-red-600 text-white touch-manipulation disabled:opacity-50 sm:ml-auto"
                >
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