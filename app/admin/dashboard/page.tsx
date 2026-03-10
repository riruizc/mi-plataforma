'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ totalStores: 0, activeStores: 0, pendingStores: 0, todayOrders: 0 })

  useEffect(() => {
    const loadStats = async () => {
      const supabase = createClient()
      const { data: stores } = await supabase.from('stores').select('status')
      const today = new Date().toISOString().split('T')[0]
      const { data: orders } = await supabase.from('orders').select('id').gte('created_at', today)
      if (stores) {
        setStats({
          totalStores: stores.length,
          activeStores: stores.filter(s => s.status === 'active').length,
          pendingStores: stores.filter(s => s.status === 'pending').length,
          todayOrders: orders?.length || 0,
        })
      }
    }
    loadStats()
  }, [])

  const cards = [
    { label: 'Tiendas activas', value: stats.activeStores, icon: '🏪', color: 'bg-green-500' },
    { label: 'Solicitudes pendientes', value: stats.pendingStores, icon: '📋', color: 'bg-yellow-500' },
    { label: 'Total tiendas', value: stats.totalStores, icon: '📦', color: 'bg-blue-500' },
    { label: 'Pedidos hoy', value: stats.todayOrders, icon: '🛒', color: 'bg-purple-500' },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">Resumen general de la plataforma</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        {cards.map(card => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 lg:p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{card.icon}</span>
              <span className={`${card.color} text-white text-xs font-semibold px-2 py-0.5 rounded-full`}>HOY</span>
            </div>
            <p className="text-2xl lg:text-3xl font-bold text-gray-900">{card.value}</p>
            <p className="text-gray-500 text-xs lg:text-sm mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 p-4 lg:p-6">
        <h2 className="text-base lg:text-lg font-semibold text-gray-900 mb-4">Accesos rápidos</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Ver solicitudes', href: '/admin/requests', icon: '📋' },
            { label: 'Gestionar tiendas', href: '/admin/stores', icon: '🏪' },
            { label: 'Motorizados', href: '/admin/riders', icon: '🛵' },
            { label: 'Mapa global', href: '/admin/map', icon: '🗺️' },
          ].map(item => (
            <Link key={item.href} href={item.href}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-center touch-manipulation">
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs lg:text-sm font-medium text-gray-700">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}