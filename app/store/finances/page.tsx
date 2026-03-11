'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Transaction = {
  id: string
  type: 'income' | 'expense'
  source: 'manual' | 'order'
  description: string
  amount: number
  order_id: string | null
  created_at: string
}

export default function FinancesPage() {
  const [storeId, setStoreId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Capital
  const [capital, setCapital] = useState(0)
  const [capitalInput, setCapitalInput] = useState('')
  const [savingCapital, setSavingCapital] = useState(false)
  const [capitalChanged, setCapitalChanged] = useState(false)

  // Transacciones
  const [transactions, setTransactions] = useState<Transaction[]>([])

  // Filtro
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all')

  // Modal nueva transacción
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState<'income' | 'expense'>('income')
  const [form, setForm] = useState({ description: '', amount: '' })
  const [saving, setSaving] = useState(false)

  // Modal editar
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [editForm, setEditForm] = useState({ description: '', amount: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: store } = await supabase.from('stores').select('id').eq('email', user.email).single()
      if (!store) return
      setStoreId(store.id)

      // Cargar capital
      const { data: fin } = await supabase.from('finances').select('capital').eq('store_id', store.id).single()
      const cap = fin?.capital || 0
      setCapital(cap)
      setCapitalInput(String(cap))

      // Cargar transacciones
      const { data: txs } = await supabase
        .from('finance_transactions')
        .select('*')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })
      setTransactions(txs || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const saveCapital = async () => {
    if (!storeId) return
    setSavingCapital(true)
    const supabase = createClient()
    await supabase.from('finances').upsert({ store_id: storeId, capital: parseFloat(capitalInput) || 0, updated_at: new Date().toISOString() }, { onConflict: 'store_id' })
    setCapital(parseFloat(capitalInput) || 0)
    setCapitalChanged(false)
    setSavingCapital(false)
  }

  const addTransaction = async () => {
    if (!form.description || !form.amount) { alert('Completa todos los campos'); return }
    if (!storeId) return
    setSaving(true)
    try {
      const supabase = createClient()
      await supabase.from('finance_transactions').insert({
        store_id: storeId,
        type: formType,
        source: 'manual',
        description: form.description,
        amount: parseFloat(form.amount),
      })
      setShowForm(false)
      setForm({ description: '', amount: '' })
      loadData()
    } catch (e: any) { alert('Error: ' + e.message) }
    finally { setSaving(false) }
  }

  const openEdit = (tx: Transaction) => {
    setEditingTx(tx)
    setEditForm({ description: tx.description, amount: String(tx.amount) })
  }

  const saveEdit = async () => {
    if (!editingTx) return
    setSavingEdit(true)
    const supabase = createClient()
    await supabase.from('finance_transactions').update({
      description: editForm.description,
      amount: parseFloat(editForm.amount) || 0,
    }).eq('id', editingTx.id)
    setEditingTx(null)
    loadData()
    setSavingEdit(false)
  }

  const deleteTx = async (tx: Transaction) => {
    if (!confirm(`¿Eliminar "${tx.description}"?`)) return
    const supabase = createClient()
    await supabase.from('finance_transactions').delete().eq('id', tx.id)
    loadData()
  }

  // Métricas
  const ingresos = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const egresos = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const ingresosOrdenes = transactions.filter(t => t.type === 'income' && t.source === 'order').reduce((s, t) => s + Number(t.amount), 0)
  const saldoActual = capital + ingresos - egresos
  const gananciaReal = ingresos - egresos

  const filtered = transactions.filter(t => filter === 'all' || t.type === filter)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto" />
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Finanzas</h1>
        <p className="text-gray-500 text-sm mt-0.5">Control de capital, ingresos y egresos</p>
      </div>

      {/* CAPITAL INICIAL */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">💰 Capital inicial</h2>
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">S/</span>
            <input
              type="number"
              value={capitalInput}
              onChange={e => { setCapitalInput(e.target.value); setCapitalChanged(true) }}
              className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>
          <button
            onClick={saveCapital}
            disabled={!capitalChanged || savingCapital}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
            {savingCapital ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Este es el dinero con el que arrancaste. No se modifica automáticamente.</p>
      </div>

      {/* MÉTRICAS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Saldo actual</p>
          <p className={`text-xl font-bold ${saldoActual >= 0 ? 'text-gray-900' : 'text-red-600'}`}>S/ {saldoActual.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Capital + ingresos − egresos</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-100 p-4">
          <p className="text-xs text-green-700 mb-1">Total ingresos</p>
          <p className="text-xl font-bold text-green-700">S/ {ingresos.toFixed(2)}</p>
          <p className="text-xs text-green-600 mt-0.5">Pedidos: S/ {ingresosOrdenes.toFixed(2)}</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-100 p-4">
          <p className="text-xs text-red-700 mb-1">Total egresos</p>
          <p className="text-xl font-bold text-red-700">S/ {egresos.toFixed(2)}</p>
          <p className="text-xs text-red-500 mt-0.5">{transactions.filter(t => t.type === 'expense').length} registros</p>
        </div>
        <div className={`rounded-xl border p-4 ${gananciaReal >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
          <p className={`text-xs mb-1 ${gananciaReal >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>Ganancia real</p>
          <p className={`text-xl font-bold ${gananciaReal >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>S/ {gananciaReal.toFixed(2)}</p>
          <p className={`text-xs mt-0.5 ${gananciaReal >= 0 ? 'text-blue-500' : 'text-orange-500'}`}>Ingresos − egresos</p>
        </div>
      </div>

      {/* ACCIONES + FILTRO */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-2">
          {(['all', 'income', 'expense'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
              {f === 'all' ? 'Todos' : f === 'income' ? '📈 Ingresos' : '📉 Egresos'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setFormType('income'); setForm({ description: '', amount: '' }); setShowForm(true) }}
            className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-semibold">+ Ingreso</button>
          <button onClick={() => { setFormType('expense'); setForm({ description: '', amount: '' }); setShowForm(true) }}
            className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-semibold">+ Egreso</button>
        </div>
      </div>

      {/* LISTA TRANSACCIONES */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">💳</p>
          <p className="text-gray-500">No hay movimientos aún</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(tx => (
            <div key={tx.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${tx.type === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                <span className="text-base">{tx.type === 'income' ? '📈' : '📉'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm truncate">{tx.description}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${tx.source === 'order' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                    {tx.source === 'order' ? '📦 Pedido' : '✏️ Manual'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(tx.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <p className={`font-bold text-sm ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.type === 'income' ? '+' : '−'}S/ {Number(tx.amount).toFixed(2)}
                </p>
                {tx.source === 'manual' && (
                  <>
                    <button onClick={() => openEdit(tx)} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs">✏️</button>
                    <button onClick={() => deleteTx(tx)} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs">🗑️</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL NUEVA TRANSACCIÓN */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">
                {formType === 'income' ? '📈 Nuevo ingreso' : '📉 Nuevo egreso'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 text-2xl font-bold">×</button>
            </div>
            {/* Tabs income/expense */}
            <div className="flex gap-2 p-5 pb-0">
              <button onClick={() => setFormType('income')}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${formType === 'income' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                📈 Ingreso
              </button>
              <button onClick={() => setFormType('expense')}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${formType === 'expense' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                📉 Egreso
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Descripción *</label>
                <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={formType === 'income' ? 'Ej: Venta de stock' : 'Ej: Compra de mercadería'} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Monto (S/) *</label>
                <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={addTransaction} disabled={saving}
                className={`flex-1 py-3 text-white rounded-xl text-sm font-bold disabled:opacity-50 ${formType === 'income' ? 'bg-green-500' : 'bg-red-500'}`}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR */}
      {editingTx && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Editar movimiento</h2>
              <button onClick={() => setEditingTx(null)} className="text-gray-400 text-2xl font-bold">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
                <input type="text" value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Monto (S/)</label>
                <input type="number" value={editForm.amount} onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setEditingTx(null)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={saveEdit} disabled={savingEdit}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {savingEdit ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}