'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotif, setShowNotif] = useState(false)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [features, setFeatures] = useState<Record<string, boolean>>({
    inventory: true,
    routes: true,
    summary: true,
    tools: true,
    comprobante: true,
    combos: true,
  })

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: store } = await supabase.from('stores').select('id').eq('email', user.email).single()
      if (!store) return
      setStoreId(store.id)

      // Cargar features de la tienda
      const { data: feat } = await supabase.from('store_features').select('*').eq('store_id', store.id).single()
      if (feat) {
        setFeatures({
          inventory: feat.inventory ?? true,
          routes: feat.routes ?? true,
          summary: feat.summary ?? true,
          tools: feat.labels ?? true,
          comprobante: feat.comprobante ?? true,
          combos: feat.combos ?? true,
        })
      }

      const channel = supabase
        .channel('new-orders')
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'orders',
          filter: 'store_id=eq.' + store.id
        }, (payload) => {
          const order = payload.new as any
          setNotifications(prev => [{
            id: order.id, code: order.order_code,
            time: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
            read: false
          }, ...prev].slice(0, 10))
        })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }
    init()
  }, [])

  useEffect(() => { setMenuOpen(false) }, [pathname])

  const unread = notifications.filter(n => !n.read).length
  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login') }

  // Nav items filtrados según features
  const allNavItems = [
    { label: 'Dashboard', href: '/store/dashboard', icon: '📊', feature: null },
    { label: 'Ajustes', href: '/store/settings', icon: '⚙️', feature: null },
    { label: 'Pedidos', href: '/store/orders', icon: '📦', feature: null },
    { label: 'Clientes', href: '/store/customers', icon: '👥', feature: null },
    { label: 'Finanzas', href: '/store/finances', icon: '💰', feature: null },
    { label: 'Inventario', href: '/store/inventory', icon: '🗃️', feature: 'inventory' },
    { label: 'Combos', href: '/store/combos', icon: '🎁', feature: 'combos' },
    { label: 'Rutas', href: '/store/routes', icon: '🗺️', feature: 'routes' },
    { label: 'Resumen', href: '/store/summary', icon: '📈', feature: 'summary' },
    { label: 'Herramientas', href: '/store/tools', icon: '🔧', feature: 'tools' },
  ]

  const navItems = allNavItems.filter(item => item.feature === null || features[item.feature])

  const SidebarContent = () => (
    <>
      <div className="px-6 py-5 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Mi Tienda</h1>
            <p className="text-gray-400 text-xs mt-1">Panel de gestión</p>
          </div>
          <div className="relative">
            <button onClick={() => { setShowNotif(!showNotif); if (!showNotif) markAllRead() }}
              className="relative p-2 rounded-lg hover:bg-gray-800 transition-colors">
              <span className="text-xl">🔔</span>
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {unread}
                </span>
              )}
            </button>

            {showNotif && (
              <div className="absolute left-0 top-12 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="font-semibold text-gray-900 text-sm">Notificaciones</p>
                  <button onClick={() => setShowNotif(false)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
                </div>
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-2xl mb-2">🔔</p>
                    <p className="text-gray-400 text-sm">Sin notificaciones</p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.map((n, i) => (
                      <div key={i} className={'px-4 py-3 border-b border-gray-50 last:border-0 ' + (!n.read ? 'bg-blue-50' : '')}>
                        <div className="flex items-start gap-2">
                          <span className="text-lg">📦</span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">Nuevo pedido</p>
                            <p className="text-xs text-blue-600 font-mono">{n.code}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{n.time}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {notifications.length > 0 && (
                  <div className="px-4 py-3 border-t border-gray-100">
                    <Link href="/store/orders" onClick={() => setShowNotif(false)} className="text-xs text-blue-600 font-medium">
                      Ver todos los pedidos →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link key={item.href} href={item.href}
              className={isActive
                ? 'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium bg-blue-600 text-white'
                : 'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors'}>
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="px-4 py-4 border-t border-gray-700">
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">
          <span>🚪</span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen flex bg-gray-100">
      <aside className="hidden lg:flex w-64 bg-gray-900 text-white flex-col fixed h-full z-30">
        <SidebarContent />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[999] lg:hidden" onClick={() => setMenuOpen(false)} />
      )}

      <aside className={`fixed top-0 left-0 h-full w-72 bg-gray-900 text-white flex flex-col z-[1000] transform transition-transform duration-300 lg:hidden ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <button onClick={() => setMenuOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl font-bold">×</button>
        <SidebarContent />
      </aside>

      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-gray-900 text-white flex items-center justify-between px-4 z-30 shadow-lg">
        <button onClick={() => setMenuOpen(true)} className="p-2 rounded-lg hover:bg-gray-800 touch-manipulation">
          <div className="space-y-1.5">
            <span className="block w-6 h-0.5 bg-white rounded" />
            <span className="block w-6 h-0.5 bg-white rounded" />
            <span className="block w-6 h-0.5 bg-white rounded" />
          </div>
        </button>
        <h1 className="text-base font-bold">Mi Tienda</h1>
        <button onClick={() => { setShowNotif(!showNotif); if (!showNotif) markAllRead() }}
          className="relative p-2 rounded-lg hover:bg-gray-800 touch-manipulation">
          <span className="text-xl">🔔</span>
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>
      </header>

      {showNotif && (
        <div className="lg:hidden fixed top-14 right-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="font-semibold text-gray-900 text-sm">Notificaciones</p>
            <button onClick={() => setShowNotif(false)} className="text-gray-400 text-lg">×</button>
          </div>
          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-2xl mb-2">🔔</p>
              <p className="text-gray-400 text-sm">Sin notificaciones</p>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {notifications.map((n, i) => (
                <div key={i} className={'px-4 py-3 border-b border-gray-50 last:border-0 ' + (!n.read ? 'bg-blue-50' : '')}>
                  <p className="text-sm font-medium text-gray-900">📦 Nuevo pedido</p>
                  <p className="text-xs text-blue-600 font-mono">{n.code}</p>
                  <p className="text-xs text-gray-400">{n.time}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <main className="flex-1 lg:ml-64 pt-14 lg:pt-0">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}