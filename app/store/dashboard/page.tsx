'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import {
  IconPackage, IconArchive, IconMap, IconTrendingUp, IconWrench, IconSettings,
} from '@/lib/icons'

const IconClock = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>
)
const IconCheck = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20 6 9 17l-5-5" /></svg>
)
const IconWallet = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3" /><path d="M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1h-4.5a2.5 2.5 0 0 0 0 5H21" /></svg>
)

export default function StoreDashboard() {
  const [store, setStore] = useState<any>(null)
  const [stats, setStats] = useState({ todayOrders: 0, pendingOrders: 0, deliveredOrders: 0, todayRevenue: 0 })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: storeData } = await supabase.from('stores').select('*').eq('email', user.email).single()
    if (!storeData) return
    setStore(storeData)
    // Límites del día en hora local (no UTC), para que "hoy" coincida con
    // el calendario del usuario y no cambie ~5 horas antes de medianoche.
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfTomorrow = new Date(startOfToday)
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)
    const { data: orders } = await supabase
      .from('orders').select('status, total_amount')
      .eq('store_id', storeData.id)
      .gte('created_at', startOfToday.toISOString())
      .lt('created_at', startOfTomorrow.toISOString())
    if (orders) {
      setStats({
        todayOrders: orders.length,
        pendingOrders: orders.filter(o => o.status === 'pending').length,
        deliveredOrders: orders.filter(o => o.status === 'delivered').length,
        todayRevenue: orders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
      })
    }
  }

  const cards = [
    { label: 'Pedidos hoy', value: String(stats.todayOrders), icon: IconPackage, text: 'text-db-brand', bg: 'bg-db-brand-tint' },
    { label: 'Pendientes', value: String(stats.pendingOrders), icon: IconClock, text: 'text-db-pending', bg: 'bg-db-pending-bg' },
    { label: 'Entregados', value: String(stats.deliveredOrders), icon: IconCheck, text: 'text-db-delivered', bg: 'bg-db-delivered-bg' },
    { label: 'Ingresos hoy', value: `S/ ${stats.todayRevenue.toFixed(2)}`, icon: IconWallet, text: 'text-db-accent', bg: 'bg-db-accent-tint' },
  ]

  const shortcuts = [
    { label: 'Pedidos', href: '/store/orders', icon: IconPackage },
    { label: 'Inventario', href: '/store/inventory', icon: IconArchive },
    { label: 'Rutas', href: '/store/routes', icon: IconMap },
    { label: 'Resumen', href: '/store/summary', icon: IconTrendingUp },
    { label: 'Herramientas', href: '/store/tools', icon: IconWrench },
    { label: 'Ajustes', href: '/store/settings', icon: IconSettings },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-db-ink">
          {store ? `Bienvenido, ${store.name}` : 'Dashboard'}
        </h1>
        <p className="text-db-ink-soft text-sm mt-1">Resumen de tu tienda hoy</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-db-surface rounded-2xl shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] p-4 lg:p-5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${card.bg} ${card.text}`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <p className="text-2xl lg:text-3xl font-bold text-db-ink font-data tabular-nums">{card.value}</p>
              <p className="text-db-ink-soft text-xs lg:text-sm mt-1">{card.label}</p>
            </div>
          )
        })}
      </div>

      <div className="mt-5 bg-db-surface rounded-2xl shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] p-4 lg:p-6">
        <h2 className="text-base lg:text-lg font-bold text-db-ink mb-4">Accesos rápidos</h2>
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {shortcuts.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-2 p-3 lg:p-4 rounded-2xl border border-db-line hover:border-db-brand hover:bg-db-brand-tint transition-colors text-center touch-manipulation"
              >
                <Icon className="w-5 h-5 text-db-brand" />
                <span className="text-xs lg:text-sm font-semibold text-db-ink">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
