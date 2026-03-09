'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Rider = {
  id: string
  name: string
  phone: string
  vehicle: string
  notes: string
  is_active: boolean
  created_at: string
}

export default function RidersPage() {
  const [riders, setRiders] = useState<Rider[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', vehicle: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadRiders() }, [])

  const loadRiders = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('riders')
      .select('*')
      .order('created_at', { ascending: false })
    setRiders(data || [])
    setLoading(false)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert('El nombre es obligatorio')
      return
    }
    setSaving(true)
    const supabase = createClient()
    await supabase.from('riders').insert({
      name: form.name,
      phone: form.phone,
      vehicle: form.vehicle,
      notes: form.notes,
      is_active: true,
    })
    setForm({ name: '', phone: '', vehicle: '', notes: '' })
    setShowForm(false)
    loadRiders()
    setSaving(false)
  }

  const toggleActive = async (rider: Rider) => {
    const supabase = createClient()
    await supabase.from('riders').update({ is_active: !rider.is_active }).eq('id', rider.id)
    loadRiders()
  }

  const handleDelete = async (riderId: string) => {
    if (!confirm('¿Seguro que quieres eliminar este motorizado?')) return
    const supabase = createClient()
    await supabase.from('riders').delete().eq('id', riderId)
    loadRiders()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-500">Cargando motorizados...</p>
    </div>
  )

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Motorizados</h1>
          <p className="text-gray-500 mt-1">Gestiona tu equipo de delivery</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
        >
          + Agregar motorizado
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Nuevo motorizado</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: Juan Pérez"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Celular</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="999 999 999"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehículo</label>
              <input
                type="text"
                value={form.vehicle}
                onChange={(e) => setForm({ ...form, vehicle: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: Moto, Bicicleta"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Observaciones opcionales"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {riders.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">🛵</p>
          <p className="text-gray-500">No hay motorizados registrados aún</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {riders.map((rider) => (
            <div key={rider.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{rider.name}</h3>
                  <p className="text-sm text-gray-500">{rider.vehicle || 'Vehículo no especificado'}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  rider.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {rider.is_active ? 'Disponible' : 'Inactivo'}
                </span>
              </div>
              {rider.phone && <p className="text-sm text-gray-500 mb-1">📱 {rider.phone}</p>}
              {rider.notes && <p className="text-sm text-gray-400 mb-3">{rider.notes}</p>}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => toggleActive(rider)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    rider.is_active
                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      : 'bg-green-50 text-green-600 hover:bg-green-100'
                  }`}
                >
                  {rider.is_active ? 'Desactivar' : 'Activar'}
                </button>
                <button
                  onClick={() => handleDelete(rider.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}