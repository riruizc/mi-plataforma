'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password
    })

    if (error) {
      setError('Correo o contraseña incorrectos')
      setLoading(false)
      return
    }

    const { data: store } = await supabase
      .from('stores')
      .select('id, status')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (store?.status === 'admin') {
      router.push('/admin/dashboard')
    } else if (!store || store.status === 'pending') {
      router.push('/pending')
    } else if (store.status === 'active') {
      router.push('/store/dashboard')
    } else {
      setError('Tu cuenta está inactiva. Contacta al administrador.')
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotEmail.trim()) return
    setForgotLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(
      forgotEmail.toLowerCase().trim(),
      { redirectTo: `${window.location.origin}/reset-password` }
    )

    setForgotLoading(false)
    if (error) {
      alert('Error al enviar el correo. Verifica el email e intenta de nuevo.')
      return
    }
    setForgotSent(true)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* Modal Olvidé contraseña — lógica idéntica, solo estilos nuevos */}
      {showForgot && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            {forgotSent ? (
              <div className="text-center">
                <p className="text-4xl mb-3">📧</p>
                <h3 className="font-bold text-gray-900 text-lg mb-2">Correo enviado</h3>
                <p className="text-gray-500 text-sm mb-4">
                  Revisa tu bandeja de entrada y sigue el link para restablecer tu contraseña.
                </p>
                <button
                  onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail('') }}
                  className="w-full py-3 bg-[#0d3fa6] text-white rounded-xl font-semibold text-sm"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <>
                <h3 className="font-bold text-gray-900 text-lg mb-1">¿Olvidaste tu contraseña?</h3>
                <p className="text-gray-500 text-sm mb-4">
                  Ingresa tu correo y te enviaremos un link para restablecerla.
                </p>
                <form onSubmit={handleForgotPassword} className="space-y-3">
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    required
                    placeholder="tu@email.com"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0d3fa6]"
                  />
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-3 bg-[#0d3fa6] text-white rounded-xl font-semibold text-sm disabled:opacity-50"
                  >
                    {forgotLoading ? 'Enviando...' : 'Enviar link'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowForgot(false); setForgotEmail('') }}
                    className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-semibold text-sm"
                  >
                    Cancelar
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Header azul con logo */}
      <div className="bg-[#0d3fa6] px-6 pt-10 pb-7 flex flex-col items-center">
        <img
          src="/logo.png"
          alt="PedidosPE"
          className="w-20 h-20 object-contain mb-3"
        />
        <div className="text-white text-xl font-bold leading-tight">
          Pedidos<span className="text-[#f57c00]">PE</span>
          <span className="text-white/40 text-sm font-normal">.com</span>
        </div>
        <p className="text-white/55 text-xs mt-1">Plataforma de gestión y delivery</p>
      </div>

      {/* Formulario */}
      <div className="flex-1 w-full max-w-md mx-auto px-6 pt-8 pb-12">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Bienvenido de vuelta</h1>
        <p className="text-sm text-gray-500 mb-7">Ingresa a tu panel de administración</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@email.com"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0d3fa6] focus:border-transparent focus:bg-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0d3fa6] focus:border-transparent focus:bg-white transition-colors"
            />
          </div>

          <div className="text-right">
            <button
              type="button"
              onClick={() => setShowForgot(true)}
              className="text-xs text-[#0d3fa6] hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#f57c00] hover:bg-[#e06900] text-white font-semibold py-3.5 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            ¿No tienes cuenta?{' '}
            <a href="/register" className="text-[#0d3fa6] hover:underline font-medium">
              Registra tu tienda
            </a>
          </p>
        </div>
      </div>

    </div>
  )
}