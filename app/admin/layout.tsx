'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => { 
    setMenuOpen(false) 
  }, [pathname])
  
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
  
      if (!user) {
        router.push('/login')
        return
      }
  
      const { data: store } = await supabase
        .from('stores')
        .select('status')
        .eq('email', user.email!)
        .single()
  
      if (store?.status !== 'admin') {
        router.push('/store/dashboard')
      }
    }
  
    checkAdmin()
  }, [])
  
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItems = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
    { label: 'Tiendas', href: '/admin/stores', icon: '🏪' },
    { label: 'Solicitudes', href: '/admin/requests', icon: '📋' },
    { label: 'Motorizados', href: '/admin/riders', icon: '🛵' },
    { label: 'Mapa Global', href: '/admin/map', icon: '🗺️' },
    { label: 'Mapa Tiendas', href: '/admin/stores-map', icon: '🏪' },
  ]

  const NavLinks = () => (
    <>
      <div className="px-6 py-5 border-b border-gray-700">
        <h1 className="text-lg font-bold text-white">Panel Admin</h1>
        <p className="text-gray-400 text-xs mt-1">Super Administrador</p>
      </div>
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link key={item.href} href={item.href}
              className={isActive
                ? 'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium bg-blue-600 text-white'
                : 'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors'
              }>
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

      {/* Sidebar desktop */}
      <aside className="hidden lg:flex w-64 bg-gray-900 text-white flex-col fixed h-full z-30">
        <NavLinks />
      </aside>

      {/* Overlay móvil */}
      {menuOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[999] lg:hidden"
          onClick={() => setMenuOpen(false)} />
      )}

      {/* Drawer móvil */}
      <aside className={`fixed top-0 left-0 h-full w-72 bg-gray-900 text-white flex flex-col z-[1000] transform transition-transform duration-300 lg:hidden ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <button onClick={() => setMenuOpen(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl font-bold">×</button>
        <NavLinks />
      </aside>

      {/* Topbar móvil */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-gray-900 text-white flex items-center justify-between px-4 z-30 shadow-lg">
        <button onClick={() => setMenuOpen(true)}
          className="p-2 rounded-lg hover:bg-gray-800 touch-manipulation">
          <div className="space-y-1.5">
            <span className="block w-6 h-0.5 bg-white rounded" />
            <span className="block w-6 h-0.5 bg-white rounded" />
            <span className="block w-6 h-0.5 bg-white rounded" />
          </div>
        </button>
        <h1 className="text-base font-bold">Panel Admin</h1>
        <div className="w-10" />
      </header>

      {/* Contenido */}
      <main className="flex-1 lg:ml-64 pt-14 lg:pt-0">
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  )
}