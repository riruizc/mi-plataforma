'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'login' | 'register' | null>(null)
  const router = useRouter()

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* HEADER AZUL */}
      <div className="bg-[#0d3fa6] px-6 pt-10 pb-0 flex flex-col items-center">
        <img
          src="/logo.png"
          alt="PedidosPE"
          className="w-20 h-20 object-contain mb-3"
        />
        <div className="text-white text-xl font-bold leading-tight">
          Pedidos<span className="text-[#f57c00]">PE</span>
          <span className="text-white/40 text-sm font-normal">.com</span>
        </div>
        <p className="text-white/55 text-xs mt-1 mb-5">Plataforma de gestión y delivery</p>
        <p className="text-white/70 text-sm mb-5">¿Quieres gestionar tu negocio con nosotros?</p>

        {/* BOTONES */}
        <div className="flex gap-3 w-full max-w-xs mb-0">
          <button
            onClick={() => setActiveTab(activeTab === 'register' ? null : 'register')}
            className={`flex-1 py-3 rounded-t-xl text-sm font-semibold border-2 transition-all ${
              activeTab === 'register'
                ? 'bg-white text-[#0d3fa6] border-white'
                : 'bg-transparent text-white border-white/35'
            }`}
          >
            Registrar mi tienda
          </button>
          <button
            onClick={() => setActiveTab(activeTab === 'login' ? null : 'login')}
            className={`flex-1 py-3 rounded-t-xl text-sm font-semibold border-2 transition-all ${
              activeTab === 'login'
                ? 'bg-white text-[#f57c00] border-white'
                : 'bg-[#f57c00] text-white border-[#f57c00]'
            }`}
          >
            Iniciar sesión
          </button>
        </div>
      </div>

      {/* FORMULARIO DESPLEGABLE */}
      {activeTab && (
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-6 w-full max-w-xs mx-auto">
          {activeTab === 'login' && (
            <LoginForm />
          )}
          {activeTab === 'register' && (
            <RegisterForm />
          )}
        </div>
      )}

      {/* FUNCIONALIDADES */}
      <div className="flex-1 px-6 pt-7 pb-4 max-w-md mx-auto w-full">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Tu tienda completa desde el primer día</h2>
        <p className="text-xs text-gray-500 mb-5">Todo lo que necesitas para vender y hacer delivery.</p>

        <div className="flex flex-col divide-y divide-gray-100">
          {features.map((f) => (
            <div key={f.key} className="flex items-start gap-3 py-3.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: f.bg, color: f.color }}
              >
                {f.key}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{f.name}</p>
                <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA AGENDAR */}
      <div className="px-6 pb-10 pt-2 max-w-md mx-auto w-full">
        <div className="border-t border-gray-100 pt-5 mb-4">
          <p className="text-xs text-gray-500 text-center mb-4 leading-relaxed">
            ¿Quieres ver la plataforma antes de registrarte?<br />
            Agenda una demostración personalizada.
          </p>
          <a
            href="https://wa.me/51935119375?text=Hola%20deseo%20agendar%20una%20cita%20personal%2C%20para%20mi%20negocio"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#25D366] text-white font-semibold rounded-xl text-sm"
          >
            <span className="w-4 h-4 bg-white rounded-full flex items-center justify-center flex-shrink-0">
              <span className="w-2.5 h-2.5 bg-[#25D366] rounded-full block" />
            </span>
            Agendar una cita
          </a>
        </div>
        <p className="text-center text-xs text-gray-400">pedidospe.com · Plataforma SaaS de delivery</p>
      </div>

    </div>
  )
}

// ─── Sub-formulario Login ───────────────────────────────────────────────────
import { createClient } from '@/lib/supabase'

function LoginForm() {
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

    const { error } = await supabase.auth.signInWithPassword({
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

  if (showForgot) {
    return (
      <div>
        {forgotSent ? (
          <div className="text-center">
            <p className="text-3xl mb-2">📧</p>
            <p className="font-semibold text-gray-900 text-sm mb-1">Correo enviado</p>
            <p className="text-gray-500 text-xs mb-4">Revisa tu bandeja y sigue el link.</p>
            <button
              onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail('') }}
              className="w-full py-2.5 bg-[#0d3fa6] text-white rounded-xl text-sm font-semibold"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <p className="font-semibold text-gray-900 text-sm mb-1">¿Olvidaste tu contraseña?</p>
            <p className="text-gray-500 text-xs mb-3">Te enviaremos un link para restablecerla.</p>
            <form onSubmit={handleForgotPassword} className="space-y-2">
              <input
                type="email"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                required
                placeholder="tu@email.com"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0d3fa6]"
              />
              <button type="submit" disabled={forgotLoading}
                className="w-full py-2.5 bg-[#0d3fa6] text-white rounded-xl font-semibold text-sm disabled:opacity-50">
                {forgotLoading ? 'Enviando...' : 'Enviar link'}
              </button>
              <button type="button" onClick={() => { setShowForgot(false); setForgotEmail('') }}
                className="w-full py-2.5 bg-gray-100 text-gray-600 rounded-xl font-semibold text-sm">
                Cancelar
              </button>
            </form>
          </>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleLogin} className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-800 mb-0.5">Bienvenido de vuelta</p>
        <p className="text-xs text-gray-500 mb-3">Ingresa a tu panel de administración</p>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Correo</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          placeholder="tu@email.com"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0d3fa6]"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          placeholder="••••••••"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0d3fa6]"
        />
      </div>
      <div className="text-right">
        <button type="button" onClick={() => setShowForgot(true)} className="text-xs text-[#0d3fa6]">
          ¿Olvidaste tu contraseña?
        </button>
      </div>
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">{error}</p>}
      <button type="submit" disabled={loading}
        className="w-full py-3 bg-[#f57c00] text-white rounded-xl font-semibold text-sm disabled:opacity-50">
        {loading ? 'Ingresando...' : 'Ingresar'}
      </button>
    </form>
  )
}

// ─── Sub-formulario Register ────────────────────────────────────────────────
function RegisterForm() {
  const [formData, setFormData] = useState({
    name: '', owner_name: '', email: '', phone: '', password: '', confirmPassword: ''
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

    const { error: authError } = await supabase.auth.signUp({
      email: formData.email.toLowerCase().trim(),
      password: formData.password
    })

    if (authError) {
      setError('Error al crear la cuenta: ' + authError.message)
      setLoading(false)
      return
    }

    const { error: storeError } = await supabase.from('stores').insert({
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
    <form onSubmit={handleRegister} className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-800 mb-0.5">Crea tu tienda</p>
        <p className="text-xs text-gray-500 mb-3">Sin tarjeta de crédito · Empieza gratis</p>
      </div>
      {[
        { label: 'Nombre del negocio', name: 'name', placeholder: 'Ej: Tienda Don Carlos', type: 'text' },
        { label: 'Tu nombre', name: 'owner_name', placeholder: 'Juan Pérez', type: 'text' },
        { label: 'Correo electrónico', name: 'email', placeholder: 'tu@email.com', type: 'email' },
        { label: 'Teléfono', name: 'phone', placeholder: '999 999 999', type: 'text' },
        { label: 'Contraseña', name: 'password', placeholder: 'Mínimo 6 caracteres', type: 'password' },
        { label: 'Confirmar contraseña', name: 'confirmPassword', placeholder: 'Repite tu contraseña', type: 'password' },
      ].map(f => (
        <div key={f.name}>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{f.label}</label>
          <input
            type={f.type}
            name={f.name}
            value={(formData as any)[f.name]}
            onChange={handleChange}
            required={f.name !== 'phone'}
            placeholder={f.placeholder}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0d3fa6]"
          />
        </div>
      ))}
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">{error}</p>}
      <button type="submit" disabled={loading}
        className="w-full py-3 bg-[#0d3fa6] text-white rounded-xl font-semibold text-sm disabled:opacity-50">
        {loading ? 'Registrando...' : 'Solicitar acceso'}
      </button>
    </form>
  )
}

// ─── Features data ──────────────────────────────────────────────────────────
const features = [
  { key: 'P', name: 'Pedidos en tiempo real', desc: 'Recibe y gestiona pedidos desde el formulario público o manualmente.', bg: '#e8f0fe', color: '#0d3fa6' },
  { key: 'I', name: 'Inventario automático', desc: 'Stock que se descuenta solo al confirmar y se reintegra al cancelar.', bg: '#fff3e0', color: '#e65100' },
  { key: 'R', name: 'Rutas optimizadas', desc: 'El sistema calcula el orden óptimo de entrega para tu motorizado.', bg: '#e8f5e9', color: '#2e7d32' },
  { key: 'C', name: 'Catálogo con WhatsApp', desc: 'Tus clientes arman su carrito y te contactan directo.', bg: '#fce4ec', color: '#c62828' },
  { key: 'F', name: 'Finanzas automáticas', desc: 'Balance, ingresos y egresos sin hojas de cálculo.', bg: '#e8f0fe', color: '#0d3fa6' },
  { key: 'M', name: 'Metas y cotizaciones', desc: 'Objetivos financieros y presupuestos PDF para tus clientes.', bg: '#f3e5f5', color: '#6a1b9a' },
]