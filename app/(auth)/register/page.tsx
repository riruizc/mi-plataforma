'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    owner_name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden')
      setLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      setLoading(false)
      return
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: formData.email.toLowerCase().trim(),
      password: formData.password
    })

    if (authError) {
      setError('Error al crear la cuenta: ' + authError.message)
      setLoading(false)
      return
    }

    const { error: storeError } = await supabase
      .from('stores')
      .insert({
        name: formData.name,
        owner_name: formData.owner_name,
        email: formData.email.toLowerCase().trim(),
        phone: formData.phone,
        status: 'pending'
      })

    if (storeError) {
      setError('Error al registrar la tienda: ' + storeError.message)
      setLoading(false)
      return
    }

    router.push('/pending')
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">

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
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Crea tu tienda</h1>
        <p className="text-sm text-gray-500 mb-7">Sin tarjeta de crédito · Empieza gratis</p>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Nombre del negocio
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Ej: Syr Import, Farmacia Central"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0d3fa6] focus:border-transparent focus:bg-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Tu nombre
            </label>
            <input
              type="text"
              name="owner_name"
              value={formData.owner_name}
              onChange={handleChange}
              required
              placeholder="Tu nombre completo"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0d3fa6] focus:border-transparent focus:bg-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Correo electrónico
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="tu@email.com"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0d3fa6] focus:border-transparent focus:bg-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Teléfono / Celular
            </label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="999 999 999"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0d3fa6] focus:border-transparent focus:bg-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Contraseña
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Mínimo 6 caracteres"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0d3fa6] focus:border-transparent focus:bg-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Confirmar contraseña
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Repite tu contraseña"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0d3fa6] focus:border-transparent focus:bg-white transition-colors"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0d3fa6] hover:bg-[#0a2e80] text-white font-semibold py-3.5 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Registrando...' : 'Solicitar acceso'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <a href="/login" className="text-[#0d3fa6] hover:underline font-medium">
              Inicia sesión
            </a>
          </p>
        </div>
      </div>

    </div>
  )
}