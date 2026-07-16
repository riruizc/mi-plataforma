'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { IconPackage, IconCheck, IconClock, IconTrendingUp } from '@/lib/icons'

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
      <div className="w-8 h-8 border-4 border-db-line border-t-db-brand rounded-full animate-spin mx-auto" />
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-db-ink">Resumen</h1>
        <p className="text-db-ink-soft mt-1 text-sm">Estadísticas de tu negocio</p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {(['dia', 'semana', 'mes', 'año'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold border ${period === p ? 'bg-db-brand text-white border-db-brand' : 'bg-db-surface border-db-line text-db-ink-soft'}`}
          >
            {periodLabel[p]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-5">
        <div className="bg-db-surface rounded-2xl shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] p-4">
          <p className="text-xs text-db-ink-soft mb-1">Total pedidos</p>
          <p className="text-2xl lg:text-3xl font-bold text-db-ink font-data tabular-nums">{totalPedidos}</p>
          <p className="text-xs text-db-ink-soft mt-1">{periodLabel[period]}</p>
        </div>
        <div className="bg-db-surface rounded-2xl shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] p-4">
          <p className="text-xs text-db-ink-soft mb-1">Ingresos</p>
          <p className="text-2xl lg:text-3xl font-bold text-db-delivered font-data tabular-nums">S/ {totalIngresos.toFixed(2)}</p>
          <p className="text-xs text-db-ink-soft mt-1">Solo entregados</p>
        </div>
        <div className="bg-db-surface rounded-2xl shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] p-4">
          <p className="text-xs text-db-ink-soft mb-1">Entregados</p>
          <p className="text-2xl lg:text-3xl font-bold text-db-brand font-data tabular-nums">{delivered.length}</p>
          <p className="text-xs text-db-ink-soft mt-1">Completados</p>
        </div>
        <div className="bg-db-surface rounded-2xl shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] p-4">
          <p className="text-xs text-db-ink-soft mb-1">Pendientes</p>
          <p className="text-2xl lg:text-3xl font-bold text-db-pending font-data tabular-nums">{pending.length + inRoute.length}</p>
          <p className="text-xs text-db-ink-soft mt-1">Por entregar</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-db-surface rounded-2xl shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] p-5">
          <h2 className="font-bold text-db-ink mb-4 flex items-center gap-2"><IconTrendingUp className="w-4 h-4 text-db-brand" />Productos más vendidos</h2>
          {topProducts.length === 0 ? (
            <div className="text-center py-6">
              <IconPackage className="w-7 h-7 mx-auto mb-2 text-db-ink-soft opacity-40" />
              <p className="text-db-ink-soft text-sm">Sin datos para este período</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-db-brand-tint text-db-brand text-xs font-bold flex items-center justify-center font-data">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-db-ink">{p.name}</p>
                      <p className="text-xs text-db-ink-soft">{p.color}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-db-ink font-data">{p.qty} uds</p>
                    <p className="text-xs text-db-delivered font-data">S/ {p.total.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-db-surface rounded-2xl shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] p-5">
          <h2 className="font-bold text-db-ink mb-4 flex items-center gap-2"><IconPackage className="w-4 h-4 text-db-brand" />Estado de pedidos</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-db-delivered-bg rounded-xl">
              <div className="flex items-center gap-2">
                <IconCheck className="w-4 h-4 text-db-delivered" />
                <span className="text-sm font-semibold text-db-delivered">Entregados</span>
              </div>
              <span className="text-xl font-bold text-db-delivered font-data">{delivered.length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-db-route-bg rounded-xl">
              <div className="flex items-center gap-2">
                <IconTrendingUp className="w-4 h-4 text-db-route" />
                <span className="text-sm font-semibold text-db-route">En ruta</span>
              </div>
              <span className="text-xl font-bold text-db-route font-data">{inRoute.length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-db-pending-bg rounded-xl">
              <div className="flex items-center gap-2">
                <IconClock className="w-4 h-4 text-db-pending" />
                <span className="text-sm font-semibold text-db-pending">Pendientes</span>
              </div>
              <span className="text-xl font-bold text-db-pending font-data">{pending.length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-db-paper rounded-xl border-t-2 border-db-line">
              <div className="flex items-center gap-2">
                <IconPackage className="w-4 h-4 text-db-ink-soft" />
                <span className="text-sm font-bold text-db-ink">Total</span>
              </div>
              <span className="text-xl font-bold text-db-ink font-data">{totalPedidos}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
