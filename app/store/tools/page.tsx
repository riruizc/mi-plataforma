'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import jsPDF from 'jspdf'

type Agency = {
  id: string
  agency_name: string
  destinations: string[]
  is_active: boolean
}

type Order = {
  id: string
  order_code: string
  destination: string
  pending_amount: number
  customers?: { name?: string; phone?: string; dni?: string }
}

export default function ToolsPage() {
  const [storeId, setStoreId] = useState<string | null>(null)
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'agencias' | 'etiquetas'>('agencias')

  const [newAgency, setNewAgency] = useState({ name: '', destinations: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('email', user.email)
        .single()
      if (!store) return
      setStoreId(store.id)

      const { data: agencyData } = await supabase
        .from('delivery_agencies')
        .select('*')
        .eq('store_id', store.id)
        .order('agency_name')
      setAgencies(agencyData || [])

      const { data: orderData } = await supabase
        .from('orders')
        .select('*, customers(name, phone, dni)')
        .eq('store_id', store.id)
        .in('status', ['pending', 'in_route'])
        .order('created_at', { ascending: false })
      setOrders(orderData || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const agregarAgencia = async () => {
    if (!newAgency.name.trim()) { alert('Ingresa el nombre de la agencia'); return }
    if (!storeId) return
    setSaving(true)
    try {
      const supabase = createClient()
      const destinations = newAgency.destinations
        ? newAgency.destinations.split(',').map(d => d.trim()).filter(d => d)
        : []
      const { data } = await supabase
        .from('delivery_agencies')
        .insert({ store_id: storeId, agency_name: newAgency.name.trim(), destinations, is_active: true })
        .select()
        .single()
      if (data) {
        setAgencies(prev => [...prev, data])
        setNewAgency({ name: '', destinations: '' })
      }
    } catch (e) {
      alert('Error al guardar la agencia')
    } finally {
      setSaving(false)
    }
  }

  const toggleAgencia = async (agency: Agency) => {
    try {
      const supabase = createClient()
      await supabase
        .from('delivery_agencies')
        .update({ is_active: !agency.is_active })
        .eq('id', agency.id)
      setAgencies(prev => prev.map(a => a.id === agency.id ? { ...a, is_active: !a.is_active } : a))
    } catch (e) {
      alert('Error al actualizar')
    }
  }

  const eliminarAgencia = async (id: string) => {
    if (!confirm('¿Eliminar esta agencia?')) return
    try {
      const supabase = createClient()
      await supabase.from('delivery_agencies').delete().eq('id', id)
      setAgencies(prev => prev.filter(a => a.id !== id))
    } catch (e) {
      alert('Error al eliminar')
    }
  }

  const toggleOrderSelect = (id: string) => {
    setSelectedOrders(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const generarEtiquetas = () => {
    const selected = orders.filter(o => selectedOrders.includes(o.id))
    if (selected.length === 0) { alert('Selecciona al menos un pedido'); return }

    const doc = new jsPDF()
    const cols = 2
    const rows = 4
    const perPage = cols * rows
    const labelW = 90
    const labelH = 65
    const marginX = 10
    const marginY = 10
    const gapX = 10
    const gapY = 5

    selected.forEach((order, index) => {
      if (index > 0 && index % perPage === 0) doc.addPage()
      const pos = index % perPage
      const col = pos % cols
      const row = Math.floor(pos / cols)
      const x = marginX + col * (labelW + gapX)
      const y = marginY + row * (labelH + gapY)

      doc.setDrawColor(180, 180, 180)
      doc.setLineWidth(0.3)
      doc.rect(x, y, labelW, labelH)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(order.order_code, x + 4, y + 8)

      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text('Cliente: ' + (order.customers?.name || '-'), x + 4, y + 16)
      doc.text('Celular: ' + (order.customers?.phone || '-'), x + 4, y + 23)
      doc.text('DNI: ' + (order.customers?.dni || '-'), x + 4, y + 30)

      const dest = order.destination ? order.destination.substring(0, 40) : '-'
      const destLines = doc.splitTextToSize('Destino: ' + dest, labelW - 8)
      doc.text(destLines, x + 4, y + 37)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('Por cobrar: S/ ' + Number(order.pending_amount).toFixed(2), x + 4, y + 58)
    })

    doc.save('etiquetas.pdf')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-500">Cargando...</p>
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Herramientas</h1>
        <p className="text-gray-500 mt-1">Agencias de delivery y etiquetas PDF</p>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('agencias')}
          className={'px-4 py-2 rounded-xl text-sm font-medium ' + (tab === 'agencias' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600')}
        >
          🚚 Agencias
        </button>
        <button
          onClick={() => setTab('etiquetas')}
          className={'px-4 py-2 rounded-xl text-sm font-medium ' + (tab === 'etiquetas' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600')}
        >
          🏷️ Etiquetas PDF
        </button>
      </div>

      {tab === 'agencias' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Agregar agencia</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la agencia *</label>
                <input
                  type="text"
                  value={newAgency.name}
                  onChange={e => setNewAgency(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Shalom, Olva, Flores"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Destinos predefinidos <span className="text-gray-400">(opcional, separados por coma)</span>
                </label>
                <input
                  type="text"
                  value={newAgency.destinations}
                  onChange={e => setNewAgency(prev => ({ ...prev, destinations: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Moquegua, Arequipa, Tacna"
                />
                <p className="text-xs text-gray-400 mt-1">Si lo dejas vacío, el cliente podrá escribir el destino libremente</p>
              </div>
              <button
                onClick={agregarAgencia}
                disabled={saving}
                className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {saving ? 'Guardando...' : '+ Agregar agencia'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Agencias configuradas ({agencies.length})</h2>
            {agencies.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-3xl mb-2">🚚</p>
                <p className="text-gray-500 text-sm">No hay agencias configuradas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {agencies.map(agency => (
                  <div key={agency.id} className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{agency.agency_name}</p>
                        <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + (agency.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                          {agency.is_active ? 'Activa' : 'Inactiva'}
                        </span>
                      </div>
                      {agency.destinations?.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          Destinos: {agency.destinations.join(', ')}
                        </p>
                      )}
                      {(!agency.destinations || agency.destinations.length === 0) && (
                        <p className="text-xs text-gray-400 mt-1">Destino libre</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleAgencia(agency)}
                        className={'px-3 py-1.5 rounded-lg text-xs font-medium border ' + (agency.is_active ? 'border-gray-200 text-gray-600' : 'border-green-200 text-green-700')}
                      >
                        {agency.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        onClick={() => eliminarAgencia(agency.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'etiquetas' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">Generar etiquetas</h2>
                <p className="text-xs text-gray-500 mt-0.5">8 etiquetas por hoja A4</p>
              </div>
              {selectedOrders.length > 0 && (
                <button
                  onClick={generarEtiquetas}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold"
                >
                  📄 Generar PDF ({selectedOrders.length})
                </button>
              )}
            </div>

            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setSelectedOrders(orders.map(o => o.id))}
                className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600"
              >
                Seleccionar todos
              </button>
              <button
                onClick={() => setSelectedOrders([])}
                className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600"
              >
                Limpiar
              </button>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-3xl mb-2">📦</p>
                <p className="text-gray-500 text-sm">No hay pedidos activos</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 sm:max-h-96 overflow-y-auto">
                {orders.map(order => (
                  <div
                    key={order.id}
                    onClick={() => toggleOrderSelect(order.id)}
                    className={'flex items-center justify-between p-3 rounded-xl border cursor-pointer ' + (selectedOrders.includes(order.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-300')}
                  >
                    <div>
                      <p className="font-mono font-bold text-sm text-gray-900">{order.order_code}</p>
                      <p className="text-xs text-gray-600">{order.customers?.name || '-'}</p>
                      <p className="text-xs text-gray-400">{order.destination?.substring(0, 40)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-bold text-orange-600">S/ {Number(order.pending_amount).toFixed(2)}</p>
                      <div className={'w-5 h-5 rounded-full border-2 ' + (selectedOrders.includes(order.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300')} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}