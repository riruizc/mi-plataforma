'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function StoreDashboard() {
  const [store, setStore] = useState<any>(null)
  const [stats, setStats] = useState({
    todayOrders: 0,
    pendingOrders: 0,
    deliveredOrders: 0,
    todayRevenue: 0,
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { data: storeData } = await supabase
      .from('stores')
      .select('*')
      .eq('email', user.email)
      .single()

    if (!storeData) return
    setStore(storeData)

    const today = new Date().toISOString().split('T')[0]
    const { data: orders } = await supabase
      .from('orders')
      .select('status, total_amount')
      .eq('store_id', storeData.id)
      .gte('created_at', today)

    if (orders) {
      setStats({
        todayOrders: orders.length,
        pendingOrders: orders.filter((o) => o.status === 'pending').length,
        deliveredOrders: orders.filter((o) => o.status === 'delivered').length,
        todayRevenue: orders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
      })
    }
  }

  const cards = [
    { label: 'Pedidos hoy', value: stats.todayOrders, icon: '📦', color: 'bg-blue-500' },
    { label: 'Pendientes', value: stats.pendingOrders, icon: '⏳', color: 'bg-yellow-500' },
    { label: 'Entregados', value: stats.deliveredOrders, icon: '✅', color: 'bg-green-500' },
    { label: 'Ingresos hoy', value: `S/ ${stats.todayRevenue.toFixed(2)}`, icon: '💰', color: 'bg-purple-500' },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {store ? `Bienvenido, ${store.name}` : 'Dashboard'}
        </h1>
        <p className="text-gray-500 mt-1">Resumen de tu tienda hoy</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl">{card.icon}</span>
              <span className={`${card.color} text-white text-xs font-semibold px-2 py-1 rounded-full`}>
                HOY
              </span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{card.value}</p>
            <p className="text-gray-500 text-sm mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Accesos rápidos</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Ver pedidos', href: '/store/orders', icon: '📦' },
            { label: 'Inventario', href: '/store/inventory', icon: '🗃️' },
            { label: 'Generar ruta', href: '/store/routes', icon: '🗺️' },
            { label: 'Resumen', href: '/store/summary', icon: '📈' },
            { label: 'Herramientas', href: '/store/tools', icon: '🔧' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-center"
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-sm font-medium text-gray-700">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}