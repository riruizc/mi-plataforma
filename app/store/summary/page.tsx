'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Order = {
  id: string
  order_code: string
  total_amount: number
  status: string
  created_at: string
  order_items?: { product_name: string; color: string; quantity: number; subtotal: number }[]
}

export default function SummaryPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'dia' | 'semana' | 'mes' | 'año'>('dia')

  useEffect(() => { loadOrders() }, [])

  const loadOrders = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: store } = await supabase.from('stores').select('id').eq('email', user.email).single()
      if (!store) return
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })
      setOrders(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const filterByPeriod = (orders: Order[]) => {
    const now = new Date()
    return orders.filter(o => {
      const date = new Date(o.created_at)
      if (period === 'dia') {
        return date.toDateString() === now.toDateString()
      }
      if (period === 'semana') {
        const weekAgo = new Date(now)
        weekAgo.setDate(now.getDate() - 7)
        return date >= weekAgo
      }
      if (period === 'mes') {
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
      }
      if (period === 'año') {
        return date.getFullYear() === now.getFullYear()
      }
      return true
    })
  }

  const filtered = filterByPeriod(orders)
  const delivered = filtered.filter(o => o.status === 'delivered')
  const pending = filtered.filter(o => o.status === 'pending')
  const inRoute = filtered.filter(o => o.status === 'in_route')
  const totalIngresos = delivered.reduce((sum, o) => sum + Number(o.total_amount), 0)
  const totalPedidos = filtered.length

  const productMap: Record<string, { name: string; color: string; qty: number; total: number }> = {}
  filtered.forEach(order => {
    order.order_items?.forEach(item => {
      const key = item.product_name + '|' + item.color
      if (!productMap[key]) productMap[key] = { name: item.product_name, color: item.color, qty: 0, total: 0 }
      productMap[key].qty += item.quantity
      productMap[key].total += Number(item.subtotal)
    })
  })
  const topProducts = Object.values(productMap).sort((a, b) => b.qty - a.qty).slice(0, 5)

  const periodLabel = { dia: 'Hoy', semana: 'Esta semana', mes: 'Este mes', año: 'Este año' }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-500">Cargando resumen...</p>
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Resumen</h1>
        <p className="text-gray-500 mt-1">Estadísticas de tu negocio</p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {(['dia', 'semana', 'mes', 'año'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={'px-3 py-2 rounded-xl text-xs sm:text-sm font-medium' + (period === p ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50')}
          >
            {periodLabel[p]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Total pedidos</p>
          <p className="text-3xl font-bold text-gray-900">{totalPedidos}</p>
          <p className="text-xs text-gray-400 mt-1">{periodLabel[period]}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Ingresos</p>
          <p className="text-3xl font-bold text-green-600">S/ {totalIngresos.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-1">Solo entregados</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Entregados</p>
          <p className="text-3xl font-bold text-blue-600">{delivered.length}</p>
          <p className="text-xs text-gray-400 mt-1">✅ Completados</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Pendientes</p>
          <p className="text-3xl font-bold text-yellow-500">{pending.length + inRoute.length}</p>
          <p className="text-xs text-gray-400 mt-1">⏳ Por entregar</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">📦 Productos más vendidos</h2>
          {topProducts.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-3xl mb-2">📊</p>
              <p className="text-gray-500 text-sm">Sin datos para este período</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.color}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{p.qty} uds</p>
                    <p className="text-xs text-green-600">S/ {p.total.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">📋 Estado de pedidos</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="text-lg">✅</span>
                <span className="text-sm font-medium text-green-800">Entregados</span>
              </div>
              <span className="text-xl font-bold text-green-700">{delivered.length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="text-lg">🛵</span>
                <span className="text-sm font-medium text-blue-800">En ruta</span>
              </div>
              <span className="text-xl font-bold text-blue-700">{inRoute.length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="text-lg">⏳</span>
                <span className="text-sm font-medium text-yellow-800">Pendientes</span>
              </div>
              <span className="text-xl font-bold text-yellow-700">{pending.length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border-t-2 border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-lg">📦</span>
                <span className="text-sm font-bold text-gray-800">Total</span>
              </div>
              <span className="text-xl font-bold text-gray-900">{totalPedidos}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}