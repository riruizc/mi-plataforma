'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Store = {
  id: string
  name: string
  owner_name: string
  email: string
  phone: string
  created_at: string
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [prefix, setPrefix] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    loadRequests()
  }, [])

  const loadRequests = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('stores')
      .select('id, name, owner_name, email, phone, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }

  const handleApprove = async (store: Store) => {
    const storePrefix = prefix[store.id]?.toUpperCase()
    if (!storePrefix || storePrefix.length < 2) {
      alert('Ingresa un prefijo de al menos 2 letras para esta tienda')
      return
    }
    setProcessing(store.id)
    const supabase = createClient()
    const expires = new Date()
    expires.setDate(expires.getDate() + 30)
    const { error } = await supabase
      .from('stores')
      .update({
        status: 'active',
        store_prefix: storePrefix,
        expires_at: expires.toISOString(),
      })
      .eq('id', store.id)
    if (error) {
      alert('Error al aprobar: ' + error.message)
    } else {
      await supabase.from('store_features').insert({ store_id: store.id })
      loadRequests()
    }
    setProcessing(null)
  }

  const handleReject = async (storeId: string) => {
    if (!confirm('¿Seguro que quieres rechazar esta solicitud?')) return
    setProcessing(storeId)
    const supabase = createClient()
    await supabase.from('stores').update({ status: 'inactive' }).eq('id', storeId)
    loadRequests()
    setProcessing(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-500">Cargando solicitudes...</p>
    </div>
  )

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Solicitudes pendientes</h1>
        <p className="text-gray-500 mt-1">Tiendas que esperan aprobación</p>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-gray-500">No hay solicitudes pendientes</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((store) => (
            <div key={store.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{store.name}</h3>
                  <div className="mt-2 space-y-1 text-sm text-gray-500">
                    <p>👤 {store.owner_name}</p>
                    <p>✉️ {store.email}</p>
                    <p>📱 {store.phone || 'No indicado'}</p>
                    <p>📅 {new Date(store.created_at).toLocaleDateString('es-PE')}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 min-w-48">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Prefijo único (ej: SYR, FAR)
                    </label>
                    <input
                      type="text"
                      maxLength={5}
                      value={prefix[store.id] || ''}
                      onChange={(e) => setPrefix({ ...prefix, [store.id]: e.target.value })}
                      placeholder="Ej: SYR"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={() => handleApprove(store)}
                    disabled={processing === store.id}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-50"
                  >
                    ✅ Aprobar
                  </button>
                  <button
                    onClick={() => handleReject(store.id)}
                    disabled={processing === store.id}
                    className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-medium py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-50"
                  >
                    ❌ Rechazar
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