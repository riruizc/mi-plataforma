'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { IconTarget, IconPlus, IconClose, IconEdit, IconTrash, IconCheck, IconWallet } from '@/lib/icons'

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
        }).eq('id', editingGoal.id).eq('store_id', storeId)
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
    await supabase.from('goals').update({ current_amount: gananciaReal, is_completed }).eq('id', goal.id).eq('store_id', storeId)
    loadData()
  }

  const deleteGoal = async (goal: Goal) => {
    if (!confirm(`¿Eliminar la meta "${goal.title}"?`)) return
    const supabase = createClient()
    await supabase.from('goals').delete().eq('id', goal.id).eq('store_id', storeId)
    loadData()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-db-line border-t-db-brand rounded-full animate-spin mx-auto" />
    </div>
  )

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-db-ink">Metas</h1>
          <p className="text-db-ink-soft text-sm mt-0.5">{goals.length} metas creadas</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-1.5 bg-db-brand text-white font-semibold px-4 py-2.5 rounded-full text-sm shadow-[0_4px_14px_-4px_rgba(36,81,232,0.55)]">
          <IconPlus className="w-4 h-4" />Nueva meta
        </button>
      </div>

      {/* Ganancia real de finanzas */}
      <div className="bg-gradient-to-r from-db-brand to-db-brand-dark rounded-2xl p-5 mb-6 text-white shadow-[0_8px_24px_-10px_rgba(36,81,232,0.5)]">
        <p className="text-white/70 text-sm mb-1 flex items-center gap-1.5"><IconWallet className="w-4 h-4" />Ganancia real (desde Finanzas)</p>
        <p className="text-3xl font-bold font-data tabular-nums">S/ {gananciaReal.toFixed(2)}</p>
        <p className="text-white/60 text-xs mt-1">Ingresos − egresos acumulados</p>
      </div>

      {goals.length === 0 ? (
        <div className="bg-db-surface rounded-2xl shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] p-12 text-center">
          <IconTarget className="w-8 h-8 mx-auto mb-3 text-db-ink-soft opacity-50" />
          <p className="text-db-ink font-semibold">No hay metas aún</p>
          <p className="text-db-ink-soft text-sm mt-1">Crea una meta y conecta tu progreso con Finanzas</p>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map(goal => {
            const pct = Math.min((goal.current_amount / goal.target_amount) * 100, 100)
            const remaining = Math.max(goal.target_amount - goal.current_amount, 0)
            return (
              <div key={goal.id} className={`rounded-2xl shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] p-5 ${goal.is_completed ? 'bg-db-delivered-bg' : 'bg-db-surface'}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-db-ink">{goal.title}</h3>
                      {goal.is_completed && (
                        <span className="inline-flex items-center gap-1 text-[10.5px] bg-db-delivered text-white px-2 py-0.5 rounded-full font-semibold">
                          <IconCheck className="w-2.5 h-2.5" />Completada
                        </span>
                      )}
                    </div>
                    {goal.description && <p className="text-sm text-db-ink-soft mt-0.5">{goal.description}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-db-ink font-data tabular-nums">S/ {Number(goal.target_amount).toFixed(2)}</p>
                    <p className="text-xs text-db-ink-soft">objetivo</p>
                  </div>
                </div>

                {/* Barra de progreso */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-db-ink-soft mb-1.5">
                    <span className="font-data">S/ {Number(goal.current_amount).toFixed(2)} ahorrado</span>
                    <span className="font-bold font-data">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-db-paper rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${goal.is_completed ? 'bg-db-delivered' : pct >= 75 ? 'bg-db-brand' : pct >= 40 ? 'bg-db-pending' : 'bg-db-accent'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {!goal.is_completed && (
                    <p className="text-xs text-db-ink-soft mt-1">Faltan S/ {remaining.toFixed(2)} para completar</p>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => useFinances(goal)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-db-brand-tint text-db-brand rounded-full text-xs font-semibold">
                    <IconWallet className="w-3.5 h-3.5" />Usar ganancia de Finanzas
                  </button>
                  <button onClick={() => openEdit(goal)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-db-paper text-db-ink-soft rounded-full text-xs font-semibold"><IconEdit className="w-3.5 h-3.5" />Editar</button>
                  <button onClick={() => deleteGoal(goal)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-db-cancelled-bg text-db-cancelled rounded-full text-xs font-semibold"><IconTrash className="w-3.5 h-3.5" />Eliminar</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL CREAR / EDITAR */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-db-surface rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-db-line">
              <h2 className="font-bold text-db-ink">{editingGoal ? 'Editar meta' : 'Nueva meta'}</h2>
              <button onClick={() => setShowForm(false)} className="text-db-ink-soft"><IconClose className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-db-ink mb-1">Nombre de la meta *</label>
                <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand"
                  placeholder="Ej: Comprar una moto, Laptop nueva" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-db-ink mb-1">Descripción <span className="text-db-ink-soft font-normal">(opcional)</span></label>
                <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand"
                  placeholder="Ej: Para expandir el negocio" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-db-ink mb-1">Monto objetivo (S/) *</label>
                <input type="number" value={form.target_amount} onChange={e => setForm(p => ({ ...p, target_amount: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand font-data"
                  placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-db-ink mb-1">Progreso actual (S/) <span className="text-db-ink-soft font-normal">(opcional)</span></label>
                <input type="number" value={form.current_amount} onChange={e => setForm(p => ({ ...p, current_amount: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand font-data"
                  placeholder="0.00" />
                {gananciaReal > 0 && (
                  <button type="button" onClick={() => setForm(p => ({ ...p, current_amount: String(gananciaReal.toFixed(2)) }))}
                    className="mt-1.5 text-xs text-db-brand font-semibold">
                    Usar ganancia actual: S/ {gananciaReal.toFixed(2)}
                  </button>
                )}
              </div>

              {/* Preview barra */}
              {form.target_amount && (
                <div>
                  <div className="w-full bg-db-paper rounded-full h-2.5">
                    <div className="h-2.5 rounded-full bg-db-brand transition-all"
                      style={{ width: `${Math.min(((parseFloat(form.current_amount) || 0) / (parseFloat(form.target_amount) || 1)) * 100, 100)}%` }} />
                  </div>
                  <p className="text-xs text-db-ink-soft mt-1 text-right font-data">
                    {Math.min(((parseFloat(form.current_amount) || 0) / (parseFloat(form.target_amount) || 1)) * 100, 100).toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3 p-5 border-t border-db-line">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-3 border border-db-line text-db-ink-soft rounded-full text-sm font-semibold">Cancelar</button>
              <button onClick={saveGoal} disabled={saving}
                className="flex-1 py-3 bg-db-brand text-white rounded-full text-sm font-bold disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
