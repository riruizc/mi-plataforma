'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Store = {
  id: string
  name: string
  owner_name: string
  email: string
  phone: string
  status: string
  store_prefix: string
  expires_at: string
  created_at: string
}

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStores()
  }, [])

  const loadStores = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('stores')
      .select('*')
      .not('status', 'eq', 'pending')
      .not('status', 'eq', 'admin')
      .order('created_at', { ascending: false })
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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-500">Cargando tiendas...</p>
    </div>
  )

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Gestión de tiendas</h1>
        <p className="text-gray-500 mt-1">{stores.length} tiendas registradas</p>
      </div>

      {stores.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">🏪</p>
          <p className="text-gray-500">No hay tiendas activas aún</p>
        </div>
      ) : (
        <div className="space-y-4">
          {stores.map((store) => (
            <div key={store.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{store.name}</h3>
                    <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {store.store_prefix}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      store.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {store.status === 'active' ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 space-y-1">
                    <p>👤 {store.owner_name} — ✉️ {store.email}</p>
                    <p>📅 Vence: {store.expires_at
                      ? new Date(store.expires_at).toLocaleDateString('es-PE')
                      : 'Sin fecha'
                    }</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => toggleStatus(store)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      store.status === 'active'
                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                        : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}
                  >
                    {store.status === 'active' ? '🔴 Desactivar' : '🟢 Activar'}
                  </button>
                  <button
                    onClick={() => extendPlan(store.id, 30)}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                  >
                    +30 días
                  </button>
                  <button
                    onClick={() => extendPlan(store.id, 60)}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                  >
                    +60 días
                  </button>
                  <button
                    onClick={() => extendPlan(store.id, 90)}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                  >
                    +90 días
                  </button>
                </div>

              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}