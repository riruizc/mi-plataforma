'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({ email: email.toLowerCase().trim(), password })

    if (error) {
      setError('Correo o contraseña incorrectos')
      setLoading(false)
      return
    }

    // Verificar rol del usuario
    const { data: store } = await supabase
      .from('stores')
      .select('id, status')
      .eq('email', email.toLowerCase().trim())
      .single()

      if (!store || store.status === 'admin') {
        router.push('/admin/dashboard')
      } else if (store.status === 'pending') {
        router.push('/pending')
      } else if (store.status === 'active') {
        router.push('/store/dashboard')
      } else {
        setError('Tu cuenta está inactiva. Contacta al administrador.')
        setLoading(false)
      }
  }

  return (
    <div className="min-h-screen flex">

      {/* IZQUIERDA — Formulario */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white px-8 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Bienvenido</h1>
            <p className="text-gray-500 mt-2">Ingresa a tu panel de gestión</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm">
              ¿No tienes cuenta?{' '}
              <a href="/register" className="text-blue-600 hover:underline font-medium">
                Registra tu tienda
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* DERECHA — Descripción */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 items-center justify-center px-12">
        <div className="text-white max-w-lg">
          <h2 className="text-4xl font-bold mb-6">
            Gestiona tu negocio desde un solo lugar
          </h2>
          <p className="text-blue-100 text-lg mb-8">
            Controla tus pedidos, inventario y entregas en tiempo real. 
            La plataforma todo-en-uno para tu tienda.
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold">✓</div>
              <span className="text-blue-100">Gestión de pedidos en tiempo real</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold">✓</div>
              <span className="text-blue-100">Control de inventario automático</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold">✓</div>
              <span className="text-blue-100">Rutas optimizadas para delivery</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold">✓</div>
              <span className="text-blue-100">Seguimiento de pedidos para tus clientes</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}