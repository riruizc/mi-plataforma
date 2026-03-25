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
    if (codeFromUrl) { setCode(codeFromUrl.toUpperCase()); handleSearch(codeFromUrl.toUpperCase()) }
  }, [])

  const handleSearch = async (overrideCode?: string) => {
    const searchCode = overrideCode || code
    if (!searchCode.trim()) { setError('Ingresa tu código de pedido'); return }
    setLoading(true); setError(''); setOrder(null)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('orders')
        .select('*, stores(name, theme_color, button_color, text_color, logo_url), order_items(*)')
        .eq('order_code', searchCode.trim().toUpperCase())
        .single()
      if (!data) { setError('No encontramos un pedido con ese código'); return }
      setOrder(data)
    } catch (e) { setError('No encontramos un pedido con ese código') }
    finally { setLoading(false) }
  }

  const statusConfig = (status: string) => {
    if (status === 'pending') return { label: 'Pendiente', icon: '◴', color: '#f59e0b', text: 'Tu pedido está siendo preparado' }
    if (status === 'in_route') return { label: 'En ruta', icon: '◎', color: '#3b82f6', text: 'Tu pedido está en camino' }
    if (status === 'delivered') return { label: 'Entregado', icon: '◉', color: '#10b981', text: 'Tu pedido fue entregado exitosamente' }
    return { label: status, icon: '◌', color: '#6b7280', text: '' }
  }

  const themeColor = order?.stores?.theme_color || '#1a1a2e'
  const btnColor = order?.stores?.button_color || '#3b82f6'
  const txtColor = order?.stores?.text_color || '#ffffff'
  const isDarkBg = (() => {
    const hex = themeColor.replace('#','')
    if (hex.length < 6) return true
    const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16)
    return (r*299+g*587+b*114)/1000 < 128
  })()
  const cardBg = isDarkBg ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'
  const cardBorder = isDarkBg ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.1)'
  const primaryText = isDarkBg ? '#ffffff' : '#111827'
  const secondaryText = isDarkBg ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'

  return (
    <div className="min-h-screen" style={{ background: themeColor, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');`}</style>

      {/* Header */}
      <div className="sticky top-0 z-20" style={{ background: themeColor + 'ee', backdropFilter: 'blur(20px)', borderBottom: isDarkBg ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)' }}>
        <div className="max-w-lg mx-auto px-4 py-4">
          {order?.stores ? (
            <div className="flex items-center gap-3">
              {order.stores.logo_url
                ? <img src={order.stores.logo_url} alt={order.stores.name} className="w-9 h-9 rounded-xl object-cover flex-shrink-0" style={{ border: `1.5px solid ${themeColor}40` }} />
                : <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: themeColor + '20', color: themeColor }}>{order.stores.name?.[0]}</div>
              }
              <div>
                <p className="font-semibold text-sm" style={{ color: primaryText }}>{order.stores.name}</p>
                <p className="text-xs" style={{ color: btnColor }}>Rastreo de pedido</p>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-white font-bold text-base">Rastrear pedido</p>
              <p className="text-white/40 text-xs mt-0.5">Ingresa tu código para ver el estado</p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* Search box */}
        <div className="rounded-2xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
          <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: secondaryText }}>Código de pedido</label>
          <div className="flex gap-2">
            <input type="text" value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Ej: RUIZ-2026-001"
              className="flex-1 px-4 py-3 rounded-xl text-base font-mono focus:outline-none uppercase"
              style={{ background: cardBg, border: `1px solid ${cardBorder}`, color: primaryText }}
              autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
            <button onClick={() => handleSearch()} disabled={loading}
              className="px-5 py-3 rounded-xl font-bold text-sm flex-shrink-0 disabled:opacity-40 touch-manipulation"
              style={{ background: btnColor, color: txtColor }}>
              {loading
                ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin block" style={{ borderColor: txtColor, borderTopColor: 'transparent' }} />
                : 'Buscar'}
            </button>
          </div>
          {error && (
            <div className="mt-3 rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="text-red-400 text-sm font-medium">⚠ {error}</p>
            </div>
          )}
        </div>

        {order && (() => {
          const info = statusConfig(order.status)
          const steps = ['pending', 'in_route', 'delivered']
          const currentIndex = steps.indexOf(order.status)

          return (
            <div className="space-y-3">
              {/* Status card */}
              <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                  <span className="text-xs uppercase tracking-wider" style={{ color: secondaryText }}>Código</span>
                  <span className="font-mono font-bold text-sm tracking-widest" style={{ color: primaryText }}>{order.order_code}</span>
                </div>

                <div className="p-5">
                  {/* Status display */}
                  <div className="flex items-center gap-4 mb-6 p-4 rounded-2xl" style={{ background: info.color + '12', border: `1px solid ${info.color}25` }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: info.color + '20' }}>
                      {order.status === 'pending' ? '🕐' : order.status === 'in_route' ? '🛵' : '✅'}
                    </div>
                    <div>
                      <p className="font-bold text-lg" style={{ color: info.color }}>{info.label}</p>
                      <p className="text-sm" style={{ color: info.color + 'aa' }}>{info.text}</p>
                    </div>
                  </div>

                  {/* Progress steps */}
                  <div className="flex items-center">
                    {['Pendiente', 'En ruta', 'Entregado'].map((label, i) => {
                      const done = i < currentIndex
                      const active = i === currentIndex
                      const stepColor = i <= currentIndex ? themeColor : 'rgba(255,255,255,0.1)'
                      return (
                        <div key={i} className="flex items-center flex-1 last:flex-none">
                          <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                              style={{ background: i <= currentIndex ? btnColor : (isDarkBg ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'), color: i <= currentIndex ? '#fff' : 'rgba(255,255,255,0.3)', border: active ? `2px solid ${btnColor}` : 'none' }}>
                              {done ? '✓' : i + 1}
                            </div>
                            <p className="text-xs mt-1.5 font-medium text-center whitespace-nowrap" style={{ color: i <= currentIndex ? primaryText : secondaryText }}>{label}</p>
                          </div>
                          {i < 2 && <div className="flex-1 h-0.5 mx-2 mb-4 rounded-full" style={{ background: i < currentIndex ? btnColor : (isDarkBg ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)') }} />}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Products */}
              <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div className="px-4 py-3" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                  <p className="font-semibold text-sm" style={{ color: primaryText }}>Productos</p>
                </div>
                <div className="p-4 space-y-0">
                  {order.order_items?.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-start py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div className="flex-1 min-w-0 pr-3">
                        <p className="text-sm font-medium" style={{ color: primaryText }}>{item.product_name}</p>
                        <p className="text-xs mt-0.5" style={{ color: secondaryText }}>
                          {item.color && item.color !== 'Único' ? item.color + ' · ' : ''}
                          {item.quantity} unidad{item.quantity !== 1 ? 'es' : ''}
                        </p>
                      </div>
                      <p className="text-sm font-bold flex-shrink-0" style={{ color: btnColor }}>S/ {Number(item.subtotal).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 flex justify-between items-center" style={{ borderTop: `1px solid ${cardBorder}`, background: isDarkBg ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                  <span className="font-bold text-sm" style={{ color: primaryText }}>Total</span>
                  <span className="font-bold text-base" style={{ color: btnColor }}>S/ {Number(order.total_amount).toFixed(2)}</span>
                </div>
              </div>

              {/* Delivery info */}
              <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div className="px-4 py-3" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                  <p className="font-semibold text-sm" style={{ color: primaryText }}>Entrega</p>
                </div>
                <div className="p-4 space-y-3">
                  {[
                    { label: 'Método', value: order.delivery_method === 'motorizado' ? '🛵 Motorizado' : '📦 Agencia' },
                    order.agency_name && { label: 'Agencia', value: order.agency_name },
                    order.destination && { label: 'Dirección', value: order.destination },
                    order.reference && { label: 'Referencia', value: order.reference },
                  ].filter(Boolean).map((row: any, i) => (
                    <div key={i} className="flex justify-between items-start gap-4">
                      <span className="text-xs flex-shrink-0 mt-0.5" style={{ color: secondaryText }}>{row.label}</span>
                      <span className="text-sm text-right font-medium" style={{ color: primaryText }}>{row.value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2" style={{ borderTop: `1px solid ${cardBorder}` }}>
                    <span className="text-xs text-white/30">Por cobrar</span>
                    <span className="text-base font-bold text-amber-400">S/ {Number(order.pending_amount).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <button onClick={() => { setOrder(null); setCode(''); setError('') }}
                className="w-full py-3 rounded-xl text-sm font-semibold touch-manipulation"
                style={{ background: cardBg, border: `1px solid ${cardBorder}`, color: secondaryText }}>
                Buscar otro pedido
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
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#1a1a2e' }}>
        <div className="w-8 h-8 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
      </div>
    }>
      <TrackPageContent />
    </Suspense>
  )
}