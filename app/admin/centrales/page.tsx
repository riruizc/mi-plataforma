'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'

type Central = {
  id: string
  name: string
  address: string
  lat: number | null
  lng: number | null
  is_active: boolean
  created_at: string
}

export default function CentralesPage() {
  const [centrales, setCentrales] = useState<Central[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Central | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', lat: '', lng: '' })

  useEffect(() => { loadCentrales() }, [])

  const loadCentrales = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('centrales').select('*').order('created_at', { ascending: false })
    setCentrales(data || [])
    setLoading(false)
  }

  const openNew = () => {
    setEditing(null)
    setForm({ name: '', address: '', lat: '', lng: '' })
    setShowForm(true)
  }

  const openEdit = (c: Central) => {
    setEditing(c)
    setForm({ name: c.name, address: c.address || '', lat: c.lat?.toString() || '', lng: c.lng?.toString() || '' })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { alert('El nombre es obligatorio'); return }
    setSaving(true)
    const supabase = createClient()
    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      lat: form.lat ? parseFloat(form.lat) : null,
      lng: form.lng ? parseFloat(form.lng) : null,
    }
    if (editing) {
      await supabase.from('centrales').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('centrales').insert({ ...payload, is_active: true })
    }
    setShowForm(false)
    setEditing(null)
    loadCentrales()
    setSaving(false)
  }

  const toggleActive = async (c: Central) => {
    const supabase = createClient()
    await supabase.from('centrales').update({ is_active: !c.is_active }).eq('id', c.id)
    loadCentrales()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este central?')) return
    const supabase = createClient()
    await supabase.from('centrales').delete().eq('id', id)
    loadCentrales()
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
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Centrales</h1>
          <p className="text-gray-500 text-sm mt-0.5">Puntos de concentración de pedidos</p>
        </div>
        <button onClick={openNew}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-2 rounded-lg text-sm">
          + Agregar
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
          <h3 className="font-semibold text-gray-900 mb-4">{editing ? 'Editar central' : 'Nuevo central'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
              <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Ej: Central Lima Norte"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Dirección</label>
              <input type="text" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                placeholder="Ej: Av. Principal 123, Lima"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 mb-4">
            <p className="text-xs font-semibold text-gray-700 mb-1">📍 Coordenadas del central</p>
            <p className="text-xs text-gray-400 mb-3">
              Ve a <a href="https://www.google.com/maps" target="_blank" rel="noreferrer" className="text-blue-500 underline">Google Maps</a>, haz click derecho en tu local y copia las coordenadas.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Latitud</label>
                <input type="text" value={form.lat} onChange={e => setForm(p => ({ ...p, lat: e.target.value }))}
                  placeholder="-12.0464"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Longitud</label>
                <input type="text" value={form.lng} onChange={e => setForm(p => ({ ...p, lng: e.target.value }))}
                  placeholder="-77.0428"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            {form.lat && form.lng && <p className="text-xs text-green-600 mt-2">📍 Coordenadas configuradas</p>}
          </div>

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 bg-blue-600 text-white font-medium py-2.5 rounded-xl text-sm disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={() => { setShowForm(false); setEditing(null) }}
              className="flex-1 bg-gray-100 text-gray-700 font-medium py-2.5 rounded-xl text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {centrales.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">🏢</p>
          <p className="text-gray-500 font-medium">No hay centrales registrados</p>
          <p className="text-gray-400 text-sm mt-1">Crea tu primer central para comenzar a planificar despachos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {centrales.map(c => (
            <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{c.name}</h3>
                  {c.address && <p className="text-xs text-gray-500 mt-0.5">{c.address}</p>}
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {c.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              {c.lat && c.lng ? (
                <p className="text-xs text-green-600 mb-3">📍 Coordenadas configuradas</p>
              ) : (
                <p className="text-xs text-orange-400 mb-3">⚠️ Sin coordenadas — requeridas para rutas</p>
              )}
              <div className="flex gap-2">
                <button onClick={() => openEdit(c)}
                  className="flex-1 py-2 rounded-lg text-xs font-medium bg-blue-50 text-blue-600">Editar</button>
                <button onClick={() => toggleActive(c)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium ${c.is_active ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-green-600'}`}>
                  {c.is_active ? 'Desactivar' : 'Activar'}
                </button>
                <button onClick={() => handleDelete(c.id)}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-red-50 text-red-600">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}