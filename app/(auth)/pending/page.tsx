'use client'

import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function PendingPage() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-[#0d3fa6] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.png" alt="PedidosPE" className="w-16 h-16 object-contain mb-3" />
          <div className="text-white text-lg font-bold">
            Pedidos<span className="text-[#f57c00]">PE</span>
            <span className="text-white/40 text-sm font-normal">.com</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-7 text-center">
          <p className="text-4xl mb-3">⏳</p>
          <h2 className="text-lg font-bold text-gray-900">Cuenta en revisión</h2>
          <p className="text-gray-500 text-sm mt-2 leading-relaxed">
            Tu solicitud fue registrada y está pendiente de aprobación por un administrador.
            Te avisaremos por correo apenas tu tienda quede activa.
          </p>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full mt-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>

      </div>
    </div>
  )
}
