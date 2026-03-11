'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Goal = {
  id: string
  title: string
  description: string
  target_amount: number
  current_amount: number
  is_completed: boolean
  created_at: string
}

export default function GoalsPage() {
  const [storeId, setStoreId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [goals, setGoals] = useState<Goal[]>([])
  const [gananciaReal, setGananciaReal] = useState(0)

  const [showForm, setShowForm] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [form, setForm] = useState({ title: '', description: '', target_amount: '', current_amount: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: store } = await supabase.from('stores').select('id').eq('email', user.email).single()
      if (!store) return
      setStoreId(store.id)

      // Cargar metas
      const { data: goalsData } = await supabase.from('goals').select('*').eq('store_id', store.id).order('created_at', { ascending: false })
      setGoals(goalsData || [])

      // Cargar ganancia real desde finanzas
      const { data: txs } = await supabase.from('finance_transactions').select('type, amount').eq('store_id', store.id)
      const ingresos = (txs || []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      const egresos = (txs || []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
      setGananciaReal(ingresos - egresos)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const openNew = () => {
    setEditingGoal(null)
    setForm({ title: '', description: '', target_amount: '', current_amount: '' })
    setShowForm(true)
  }

  const openEdit = (goal: Goal) => {
    setEditingGoal(goal)
    setForm({
      title: goal.title,
      description: goal.description || '',
      target_amount: String(goal.target_amount),
      current_amount: String(goal.current_amount),
    })
    setShowForm(true)
  }

  const saveGoal = async () => {
    if (!form.title || !form.target_amount) { alert('Nombre y monto objetivo son obligatorios'); return }
    if (!storeId) return
    setSaving(true)
    try {
      const supabase = createClient()
      const target = parseFloat(form.target_amount) || 0
      const current = parseFloat(form.current_amount) || 0
      const is_completed = current >= target

      if (editingGoal) {
        await supabase.from('goals').update({
          title: form.title,
          description: form.description,
          target_amount: target,
          current_amount: current,
          is_completed,
        }).eq('id', editingGoal.id)
      } else {
        await supabase.from('goals').insert({
          store_id: storeId,
          title: form.title,
          description: form.description,
          target_amount: target,
          current_amount: current,
          is_completed,
        })
      }
      setShowForm(false)
      loadData()
    } catch (e: any) { alert('Error: ' + e.message) }
    finally { setSaving(false) }
  }

  const useFinances = async (goal: Goal) => {
    if (!confirm(`¿Usar la ganancia real (S/ ${gananciaReal.toFixed(2)}) como progreso de "${goal.title}"?`)) return
    const supabase = createClient()
    const is_completed = gananciaReal >= goal.target_amount
    await supabase.from('goals').update({ current_amount: gananciaReal, is_completed }).eq('id', goal.id)
    loadData()
  }

  const deleteGoal = async (goal: Goal) => {
    if (!confirm(`¿Eliminar la meta "${goal.title}"?`)) return
    const supabase = createClient()
    await supabase.from('goals').delete().eq('id', goal.id)
    loadData()
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
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Metas</h1>
          <p className="text-gray-500 text-sm mt-0.5">{goals.length} metas creadas</p>
        </div>
        <button onClick={openNew} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-sm">
          + Nueva meta
        </button>
      </div>

      {/* Ganancia real de finanzas */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-5 mb-6 text-white">
        <p className="text-blue-100 text-sm mb-1">Ganancia real (desde Finanzas)</p>
        <p className="text-3xl font-bold">S/ {gananciaReal.toFixed(2)}</p>
        <p className="text-blue-200 text-xs mt-1">Ingresos − egresos acumulados</p>
      </div>

      {goals.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">🎯</p>
          <p className="text-gray-500 font-medium">No hay metas aún</p>
          <p className="text-gray-400 text-sm mt-1">Crea una meta y conecta tu progreso con Finanzas</p>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map(goal => {
            const pct = Math.min((goal.current_amount / goal.target_amount) * 100, 100)
            const remaining = Math.max(goal.target_amount - goal.current_amount, 0)
            return (
              <div key={goal.id} className={`bg-white rounded-xl border p-5 ${goal.is_completed ? 'border-green-200 bg-green-50' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-gray-900">{goal.title}</h3>
                      {goal.is_completed && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✅ Completada</span>
                      )}
                    </div>
                    {goal.description && <p className="text-sm text-gray-500 mt-0.5">{goal.description}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-gray-900">S/ {Number(goal.target_amount).toFixed(2)}</p>
                    <p className="text-xs text-gray-400">objetivo</p>
                  </div>
                </div>

                {/* Barra de progreso */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                    <span>S/ {Number(goal.current_amount).toFixed(2)} ahorrado</span>
                    <span className="font-semibold">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${goal.is_completed ? 'bg-green-500' : pct >= 75 ? 'bg-blue-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-orange-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {!goal.is_completed && (
                    <p className="text-xs text-gray-400 mt-1">Faltan S/ {remaining.toFixed(2)} para completar</p>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => useFinances(goal)}
                    className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium">
                    💰 Usar ganancia de Finanzas
                  </button>
                  <button onClick={() => openEdit(goal)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">✏️ Editar</button>
                  <button onClick={() => deleteGoal(goal)}
                    className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium">Eliminar</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL CREAR / EDITAR */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">{editingGoal ? 'Editar meta' : 'Nueva meta'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 text-2xl font-bold">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre de la meta *</label>
                <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Comprar una moto, Laptop nueva" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Descripción <span className="text-gray-400">(opcional)</span></label>
                <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Para expandir el negocio" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Monto objetivo (S/) *</label>
                <input type="number" value={form.target_amount} onChange={e => setForm(p => ({ ...p, target_amount: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Progreso actual (S/) <span className="text-gray-400">(opcional)</span></label>
                <input type="number" value={form.current_amount} onChange={e => setForm(p => ({ ...p, current_amount: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00" />
                {gananciaReal > 0 && (
                  <button type="button" onClick={() => setForm(p => ({ ...p, current_amount: String(gananciaReal.toFixed(2)) }))}
                    className="mt-1.5 text-xs text-blue-600 font-medium">
                    Usar ganancia actual: S/ {gananciaReal.toFixed(2)}
                  </button>
                )}
              </div>

              {/* Preview barra */}
              {form.target_amount && (
                <div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div className="h-2.5 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${Math.min(((parseFloat(form.current_amount) || 0) / (parseFloat(form.target_amount) || 1)) * 100, 100)}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1 text-right">
                    {Math.min(((parseFloat(form.current_amount) || 0) / (parseFloat(form.target_amount) || 1)) * 100, 100).toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={saveGoal} disabled={saving}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}