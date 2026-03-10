'use client'

import { Suspense, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'

function TrackPageContent() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [order, setOrder] = useState<any>(null)
  const [error, setError] = useState('')

  const searchParams = useSearchParams()

  useEffect(() => {
    const codeFromUrl = searchParams.get('code')
    if (codeFromUrl) {
      setCode(codeFromUrl.toUpperCase())
      handleSearch(codeFromUrl.toUpperCase())
    }
  }, [])

  const handleSearch = async (overrideCode?: string) => {
    const searchCode = overrideCode || code
    if (!searchCode.trim()) {
      setError('Ingresa tu código de pedido')
      return
    }

    setLoading(true)
    setError('')
    setOrder(null)

    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('orders')
        .select('*, stores(name, theme_color, logo_url), order_items(*)')
        .eq('order_code', searchCode.trim().toUpperCase())
        .single()

      if (!data) {
        setError('No encontramos un pedido con ese código')
        return
      }

      setOrder(data)
    } catch (e) {
      setError('No encontramos un pedido con ese código')
    } finally {
      setLoading(false)
    }
  }

  const statusInfo = (status: string) => {
    if (status === 'pending')
      return {
        label: 'Pendiente',
        emoji: '🕐',
        color: '#d97706',
        bg: '#fef3c7',
        text: 'Tu pedido está siendo preparado.',
      }
    if (status === 'in_route')
      return {
        label: 'En ruta',
        emoji: '🛵',
        color: '#2563eb',
        bg: '#dbeafe',
        text: 'Tu pedido está en camino.',
      }
    if (status === 'delivered')
      return {
        label: 'Entregado',
        emoji: '✅',
        color: '#059669',
        bg: '#d1fae5',
        text: 'Tu pedido fue entregado exitosamente.',
      }

    return {
      label: status,
      emoji: '📦',
      color: '#6b7280',
      bg: '#f3f4f6',
      text: '',
    }
  }

  const themeColor = order?.stores?.theme_color || '#2563eb'

  return (
    <div className="min-h-screen bg-gray-50">
      <div
        className="px-4 pt-5 pb-5 shadow-sm"
        style={{ backgroundColor: order ? themeColor : '#2563eb' }}
      >
        <div className="max-w-lg mx-auto">
          {order?.stores && (
            <div className="flex items-center gap-2 mb-3">
              {order.stores.logo_url && (
                <img
                  src={order.stores.logo_url}
                  alt="Logo"
                  className="w-8 h-8 rounded-full object-cover border-2 border-white border-opacity-60"
                />
              )}
              <span className="text-white text-sm font-medium opacity-90">
                {order.stores.name}
              </span>
            </div>
          )}

          <h1 className="text-white font-bold text-xl">📦 Rastrear pedido</h1>
          <p className="text-white text-sm opacity-70 mt-0.5">
            Ingresa tu código para ver el estado
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Código de pedido
          </label>

          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Ej: RUIZ-2026-001"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-base font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />

            <button
              onClick={() => handleSearch()}
              disabled={loading}
              className="px-5 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm disabled:opacity-50 touch-manipulation active:bg-blue-700 flex-shrink-0"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin block" />
              ) : (
                'Buscar'
              )}
            </button>
          </div>

          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-red-600 text-sm font-medium">⚠️ {error}</p>
            </div>
          )}
        </div>

        {order &&
          (() => {
            const info = statusInfo(order.status)
            const steps = ['pending', 'in_route', 'delivered']
            const currentIndex = steps.indexOf(order.status)

            return (
              <div className="space-y-3">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Código de pedido</span>
                    <span className="font-mono font-bold text-gray-900 text-sm tracking-wide">
                      {order.order_code}
                    </span>
                  </div>

                  <div className="p-4">
                    <div
                      className="rounded-2xl p-5 text-center mb-4"
                      style={{ backgroundColor: info.bg }}
                    >
                      <p className="text-5xl mb-2">{info.emoji}</p>
                      <p className="font-bold text-lg" style={{ color: info.color }}>
                        {info.label}
                      </p>
                      <p
                        className="text-sm mt-1 opacity-80"
                        style={{ color: info.color }}
                      >
                        {info.text}
                      </p>
                    </div>

                    <div className="flex items-start justify-between mt-4">
                      {['Pendiente', 'En ruta', 'Entregado'].map((label, i) => {
                        const active = i <= currentIndex
                        return (
                          <div key={i} className="flex flex-col items-center flex-1">
                            <div className="flex items-center w-full">
                              <div
                                className={`flex-1 h-0.5 rounded-full ${
                                  i === 0
                                    ? 'invisible'
                                    : active && i <= currentIndex
                                    ? 'bg-blue-600'
                                    : 'bg-gray-200'
                                }`}
                              />

                              <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors ${
                                  active
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 text-gray-400'
                                }`}
                              >
                                {active && i < currentIndex ? '✓' : i + 1}
                              </div>

                              <div
                                className={`flex-1 h-0.5 rounded-full ${
                                  i === 2
                                    ? 'invisible'
                                    : i < currentIndex
                                    ? 'bg-blue-600'
                                    : 'bg-gray-200'
                                }`}
                              />
                            </div>

                            <p
                              className={`text-xs mt-1.5 font-medium text-center ${
                                active ? 'text-blue-600' : 'text-gray-400'
                              }`}
                            >
                              {label}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                  <h3 className="font-bold text-gray-900 mb-3 text-sm">🛍️ Productos</h3>
                  <div className="space-y-2">
                    {order.order_items?.map((item: any) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-start py-2 border-b border-gray-50 last:border-0"
                      >
                        <div className="flex-1 min-w-0 pr-3">
                          <p className="text-sm font-medium text-gray-900 leading-snug">
                            {item.product_name}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {item.color && item.color !== 'Único'
                              ? item.color + ' · '
                              : ''}
                            cantidad: {item.quantity}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-gray-900 flex-shrink-0">
                          S/ {Number(item.subtotal).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between pt-3 mt-1 border-t border-gray-100">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="font-bold text-gray-900">
                      S/ {Number(order.total_amount).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                  <h3 className="font-bold text-gray-900 mb-3 text-sm">📬 Entrega</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Método</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {order.delivery_method === 'motorizado'
                          ? '🛵 Motorizado'
                          : '📦 Agencia'}
                      </span>
                    </div>

                    {order.agency_name && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Agencia</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {order.agency_name}
                        </span>
                      </div>
                    )}

                    {order.destination && (
                      <div className="flex justify-between items-start gap-4">
                        <span className="text-sm text-gray-500 flex-shrink-0">
                          Dirección
                        </span>
                        <span className="text-sm font-medium text-gray-900 text-right">
                          {order.destination}
                        </span>
                      </div>
                    )}

                    {order.reference && (
                      <div className="flex justify-between items-start gap-4">
                        <span className="text-sm text-gray-500 flex-shrink-0">
                          Referencia
                        </span>
                        <span className="text-sm font-medium text-gray-900 text-right">
                          {order.reference}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-1">
                      <span className="text-sm text-gray-500">Por cobrar</span>
                      <span className="text-base font-bold text-orange-600">
                        S/ {Number(order.pending_amount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setOrder(null)
                    setCode('')
                    setError('')
                  }}
                  className="w-full py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm touch-manipulation active:bg-gray-50"
                >
                  🔍 Buscar otro pedido
                </button>
              </div>
            )
          })()}
      </div>
    </div>
  )
}

export default function TrackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        </div>
      }
    >
      <TrackPageContent />
    </Suspense>
  )
}