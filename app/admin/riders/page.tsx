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
  origin_lat: number | null
  origin_lng: number | null
}

export default function RidersPage() {
  const [riders, setRiders] = useState<Rider[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRider, setEditingRider] = useState<Rider | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', vehicle: '', notes: '', origin_lat: '', origin_lng: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadRiders() }, [])

  const loadRiders = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('riders').select('*').order('created_at', { ascending: false })
    setRiders(data || [])
    setLoading(false)
  }

  const openNew = () => {
    setEditingRider(null)
    setForm({ name: '', phone: '', vehicle: '', notes: '', origin_lat: '', origin_lng: '' })
    setShowForm(true)
  }

  const openEdit = (rider: Rider) => {
    setEditingRider(rider)
    setForm({
      name: rider.name,
      phone: rider.phone || '',
      vehicle: rider.vehicle || '',
      notes: rider.notes || '',
      origin_lat: rider.origin_lat?.toString() || '',
      origin_lng: rider.origin_lng?.toString() || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { alert('El nombre es obligatorio'); return }
    setSaving(true)
    const supabase = createClient()

    const payload = {
      name: form.name,
      phone: form.phone,
      vehicle: form.vehicle,
      notes: form.notes,
      origin_lat: form.origin_lat ? parseFloat(form.origin_lat) : null,
      origin_lng: form.origin_lng ? parseFloat(form.origin_lng) : null,
    }

    if (editingRider) {
      await supabase.from('riders').update(payload).eq('id', editingRider.id)
    } else {
      await supabase.from('riders').insert({ ...payload, is_active: true })
    }

    setForm({ name: '', phone: '', vehicle: '', notes: '', origin_lat: '', origin_lng: '' })
    setShowForm(false)
    setEditingRider(null)
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
      <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto" />
    </div>
  )

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Motorizados</h1>
          <p className="text-gray-500 text-sm mt-0.5">Gestiona tu equipo de delivery</p>
        </div>
        <button onClick={openNew}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-2 rounded-lg text-xs lg:text-sm touch-manipulation">
          + Agregar
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 lg:p-6 mb-4">
          <h3 className="font-semibold text-gray-900 mb-4">
            {editingRider ? 'Editar motorizado' : 'Nuevo motorizado'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'Nombre completo *', key: 'name', placeholder: 'Ej: Juan Pérez' },
              { label: 'Celular', key: 'phone', placeholder: '999 999 999' },
              { label: 'Vehículo', key: 'vehicle', placeholder: 'Ej: Moto, Bicicleta' },
              { label: 'Notas', key: 'notes', placeholder: 'Observaciones opcionales' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                <input type="text" value={(form as any)[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
          </div>

          {/* Punto de salida */}
          <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs font-semibold text-gray-700 mb-1">📍 Punto de salida del motorizado</p>
            <p className="text-xs text-gray-400 mb-3">
              Desde aquí se calcula la ruta. Obtén las coordenadas desde{' '}
              <a href="https://www.google.com/maps" target="_blank" rel="noreferrer" className="text-blue-500 underline">
                Google Maps
              </a>{' '}
              (click derecho → copiar coordenadas).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Latitud</label>
                <input type="text" value={form.origin_lat}
                  onChange={e => setForm({ ...form, origin_lat: e.target.value })}
                  placeholder="-12.0464"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Longitud</label>
                <input type="text" value={form.origin_lng}
                  onChange={e => setForm({ ...form, origin_lng: e.target.value })}
                  placeholder="-77.0428"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            {form.origin_lat && form.origin_lng && (
              <p className="text-xs text-green-600 mt-2">📍 Coordenadas configuradas</p>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 bg-blue-600 text-white font-medium py-2.5 rounded-xl text-sm disabled:opacity-50 touch-manipulation">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={() => { setShowForm(false); setEditingRider(null) }}
              className="flex-1 bg-gray-100 text-gray-700 font-medium py-2.5 rounded-xl text-sm touch-manipulation">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {riders.map(rider => (
            <div key={rider.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{rider.name}</h3>
                  <p className="text-xs text-gray-500">{rider.vehicle || 'Vehículo no especificado'}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rider.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {rider.is_active ? 'Disponible' : 'Inactivo'}
                </span>
              </div>
              {rider.phone && <p className="text-xs text-gray-500 mb-1">📱 {rider.phone}</p>}
              {rider.notes && <p className="text-xs text-gray-400 mb-1">{rider.notes}</p>}
              {rider.origin_lat && rider.origin_lng ? (
                <p className="text-xs text-green-600 mb-2">📍 Punto de salida configurado</p>
              ) : (
                <p className="text-xs text-orange-400 mb-2">⚠️ Sin punto de salida</p>
              )}
              <div className="flex gap-2 mt-2">
                <button onClick={() => openEdit(rider)}
                  className="flex-1 py-2 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 touch-manipulation">
                  Editar
                </button>
                <button onClick={() => toggleActive(rider)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium touch-manipulation ${rider.is_active ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-green-600'}`}>
                  {rider.is_active ? 'Desactivar' : 'Activar'}
                </button>
                <button onClick={() => handleDelete(rider.id)}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-red-50 text-red-600 touch-manipulation">
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}