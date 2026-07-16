'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { sora, plexMono } from '@/lib/fonts'
import {
  IconDashboard, IconSettings, IconPackage, IconUsers, IconFileText, IconTruck,
  IconWallet, IconTarget, IconArchive, IconGift, IconFactory, IconMap,
  IconTrendingUp, IconWrench, IconBell, IconLogOut, IconMenu, IconClose,
} from '@/lib/icons'

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotif, setShowNotif] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [features, setFeatures] = useState<Record<string, boolean>>({
    settings: true, orders: true, customers: true, quotes: true,
    suppliers: true, finances: true, goals: true,
    inventory: true, routes: true, summary: true,
    tools: true, comprobante: true, combos: true, wholesale: true,
  })

  useEffect(() => {
    let channelRef: any = null
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: store } = await supabase.from('stores').select('id, status').eq('email', user.email).single()
      if (!store || (store.status !== 'active' && store.status !== 'admin')) { router.push('/pending'); return }

      const { data: feat } = await supabase.from('store_features').select('*').eq('store_id', store.id).single()
      if (feat) {
        setFeatures({
          settings:    feat.settings    ?? true,
          orders:      feat.orders      ?? true,
          customers:   feat.customers   ?? true,
          quotes:      feat.quotes      ?? true,
          suppliers:   feat.suppliers   ?? true,
          finances:    feat.finances    ?? true,
          goals:       feat.goals       ?? true,
          inventory:   feat.inventory   ?? true,
          combos:      feat.combos      ?? true,
          routes:      feat.routes      ?? true,
          summary:     feat.summary     ?? true,
          tools:       feat.labels      ?? true,
          comprobante: feat.comprobante ?? true,
          wholesale:   feat.wholesale   ?? true,
        })
      }

      channelRef = supabase
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
    }
    init()
    return () => { if (channelRef) supabase.removeChannel(channelRef) }
  }, [])

  useEffect(() => { setMenuOpen(false) }, [pathname])

  const unread = notifications.filter(n => !n.read).length
  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login') }

  const allNavItems: { label: string; href: string; icon: (props: { className?: string }) => React.JSX.Element; feature: string | null }[] = [
    { label: 'Dashboard',     href: '/store/dashboard',  icon: IconDashboard,   feature: null },
    { label: 'Ajustes',       href: '/store/settings',   icon: IconSettings,    feature: 'settings' },
    { label: 'Pedidos',       href: '/store/orders',     icon: IconPackage,     feature: 'orders' },
    { label: 'Clientes',      href: '/store/customers',  icon: IconUsers,       feature: 'customers' },
    { label: 'Cotizaciones',  href: '/store/quotes',     icon: IconFileText,    feature: 'quotes' },
    { label: 'Proveedores',   href: '/store/suppliers',  icon: IconTruck,       feature: 'suppliers' },
    { label: 'Finanzas',      href: '/store/finances',   icon: IconWallet,      feature: 'finances' },
    { label: 'Metas',         href: '/store/goals',      icon: IconTarget,      feature: 'goals' },
    { label: 'Inventario',    href: '/store/inventory',  icon: IconArchive,     feature: 'inventory' },
    { label: 'Combos',        href: '/store/combos',     icon: IconGift,        feature: 'combos' },
    { label: 'Mayorista',     href: '/store/wholesale',  icon: IconFactory,     feature: 'wholesale' },
    { label: 'Rutas',         href: '/store/routes',     icon: IconMap,         feature: 'routes' },
    { label: 'Resumen',       href: '/store/summary',    icon: IconTrendingUp,  feature: 'summary' },
    { label: 'Herramientas',  href: '/store/tools',      icon: IconWrench,      feature: 'tools' },
  ]

  const navItems = allNavItems.filter(item => item.feature === null || features[item.feature])

  const SidebarContent = () => (
    <>
      <div className="px-6 py-5 border-b border-db-sidebar-line">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Mi Tienda</h1>
            <p className="text-db-sidebar-ink text-xs mt-1">Panel de gestión</p>
          </div>
          <div className="relative">
            <button onClick={() => { setShowNotif(!showNotif); if (!showNotif) markAllRead() }}
              className="relative p-2 rounded-full hover:bg-db-sidebar-hover transition-colors text-db-sidebar-ink">
              <IconBell className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-db-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unread}
                </span>
              )}
            </button>
            {showNotif && (
              <div className="absolute left-0 top-12 w-72 bg-db-surface rounded-2xl shadow-[0_20px_50px_-15px_rgba(0,0,0,0.4)] border border-db-line z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-db-line flex items-center justify-between">
                  <p className="font-bold text-db-ink text-sm">Notificaciones</p>
                  <button onClick={() => setShowNotif(false)} className="text-db-ink-soft hover:text-db-ink"><IconClose className="w-4 h-4" /></button>
                </div>
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-db-ink-soft">
                    <IconBell className="w-6 h-6 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Sin notificaciones</p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.map((n, i) => (
                      <div key={i} className={'px-4 py-3 border-b border-db-line last:border-0 ' + (!n.read ? 'bg-db-brand-tint' : '')}>
                        <div className="flex items-start gap-2.5">
                          <IconPackage className="w-4 h-4 mt-0.5 text-db-brand flex-shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-db-ink">Nuevo pedido</p>
                            <p className="text-xs text-db-brand font-data">{n.code}</p>
                            <p className="text-xs text-db-ink-soft mt-0.5">{n.time}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {notifications.length > 0 && (
                  <div className="px-4 py-3 border-t border-db-line">
                    <Link href="/store/orders" onClick={() => setShowNotif(false)} className="text-xs text-db-brand font-semibold">
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
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}
              className={isActive
                ? 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold bg-db-brand text-white shadow-[0_4px_14px_-4px_rgba(36,81,232,0.5)]'
                : 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-db-sidebar-ink hover:bg-db-sidebar-hover hover:text-white transition-colors'}>
              <Icon className="w-4.5 h-4.5 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="px-4 py-4 border-t border-db-sidebar-line">
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-db-sidebar-ink hover:bg-db-sidebar-hover hover:text-white transition-colors">
          <IconLogOut className="w-4.5 h-4.5" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </>
  )

  return (
    <div className={`min-h-screen flex bg-db-paper ${sora.variable} ${plexMono.variable} font-display`}>
      <aside className="hidden lg:flex w-64 bg-db-sidebar text-white flex-col fixed h-full z-30">
        <SidebarContent />
      </aside>
      {menuOpen && (
        <div className="fixed inset-0 bg-black/50 z-[999] lg:hidden" onClick={() => setMenuOpen(false)} />
      )}
      <aside className={`fixed top-0 left-0 h-full w-72 bg-db-sidebar text-white flex flex-col z-[1000] transform transition-transform duration-300 lg:hidden ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <button onClick={() => setMenuOpen(false)} className="absolute top-4 right-4 text-db-sidebar-ink hover:text-white"><IconClose className="w-5 h-5" /></button>
        <SidebarContent />
      </aside>
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-db-sidebar text-white flex items-center justify-between px-4 z-30 shadow-lg">
        <button onClick={() => setMenuOpen(true)} className="p-2 rounded-lg hover:bg-db-sidebar-hover touch-manipulation text-db-sidebar-ink">
          <IconMenu className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold">Mi Tienda</h1>
        <button onClick={() => { setShowNotif(!showNotif); if (!showNotif) markAllRead() }}
          className="relative p-2 rounded-lg hover:bg-db-sidebar-hover touch-manipulation text-db-sidebar-ink">
          <IconBell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-db-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>
      </header>
      {showNotif && (
        <div className="lg:hidden fixed top-14 right-2 w-72 bg-db-surface rounded-2xl shadow-[0_20px_50px_-15px_rgba(0,0,0,0.4)] border border-db-line z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-db-line flex items-center justify-between">
            <p className="font-bold text-db-ink text-sm">Notificaciones</p>
            <button onClick={() => setShowNotif(false)} className="text-db-ink-soft"><IconClose className="w-4 h-4" /></button>
          </div>
          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-center text-db-ink-soft">
              <IconBell className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Sin notificaciones</p>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {notifications.map((n, i) => (
                <div key={i} className={'px-4 py-3 border-b border-db-line last:border-0 flex items-start gap-2.5 ' + (!n.read ? 'bg-db-brand-tint' : '')}>
                  <IconPackage className="w-4 h-4 mt-0.5 text-db-brand flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-db-ink">Nuevo pedido</p>
                    <p className="text-xs text-db-brand font-data">{n.code}</p>
                    <p className="text-xs text-db-ink-soft">{n.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <main className="flex-1 lg:ml-64 pt-14 lg:pt-0">
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  )
}