'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

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
  ]

  return (
    <div className="min-h-screen flex bg-gray-100">
      <aside className="w-64 bg-gray-900 text-white flex flex-col fixed h-full">
        <div className="px-6 py-5 border-b border-gray-700">
          <h1 className="text-lg font-bold text-white">Panel Admin</h1>
          <p className="text-gray-400 text-xs mt-1">Super Administrador</p>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  isActive
                    ? 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white'
                    : 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors'
                }
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="px-4 py-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <span>🚪</span>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64 p-8">{children}</main>
    </div>
  )
}