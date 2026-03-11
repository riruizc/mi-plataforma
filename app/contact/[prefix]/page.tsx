import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function ContactPage({ params }: { params: { prefix: string } }) {
  const { data: store } = await supabase
    .from('stores')
    .select('id, name, logo_url, phone, contact_active, contact_bg_color, contact_logo_shape, contact_description, contact_whatsapp_msg, contact_facebook, contact_tiktok, contact_instagram, store_prefix')
    .eq('store_prefix', params.prefix)
    .single()

  if (!store || !store.contact_active) return notFound()

  const phone = (store.phone || '').replace(/\D/g, '')
  const waMsg = encodeURIComponent(store.contact_whatsapp_msg || '¡Hola! Quiero hacer un pedido 👋')
  const waLink = phone ? `https://wa.me/51${phone}?text=${waMsg}` : null
  const catalogLink = `/catalog/${store.store_prefix}`
  const bgColor = store.contact_bg_color || '#ffffff'
  const isLight = isLightColor(bgColor)
  const textColor = isLight ? '#111827' : '#ffffff'
  const subTextColor = isLight ? '#6b7280' : 'rgba(255,255,255,0.75)'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ backgroundColor: bgColor }}>
      <div className="w-full max-w-sm flex flex-col items-center gap-5">

        {/* Logo */}
        <div className={`w-28 h-28 overflow-hidden border-4 flex items-center justify-center bg-white shadow-lg ${store.contact_logo_shape === 'circular' ? 'rounded-full border-white' : 'rounded-2xl border-white'}`}>
          {store.logo_url
            ? <img src={store.logo_url} alt={store.name} className="w-full h-full object-cover" />
            : <span className="text-5xl">🏪</span>
          }
        </div>

        {/* Nombre y descripción */}
        <div className="text-center">
          <h1 className="text-2xl font-bold" style={{ color: textColor }}>{store.name}</h1>
          {store.contact_description && (
            <p className="mt-2 text-sm leading-relaxed" style={{ color: subTextColor }}>{store.contact_description}</p>
          )}
        </div>

        {/* Botones de acción */}
        <div className="w-full space-y-3">
          {waLink && (
            <a href={waLink} target="_blank"
              className="w-full flex items-center justify-center gap-3 py-3.5 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-2xl shadow-md transition-colors text-sm">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Contactar por WhatsApp
            </a>
          )}

          <a href={catalogLink}
            className="w-full flex items-center justify-center gap-3 py-3.5 font-semibold rounded-2xl shadow-sm transition-colors text-sm border-2"
            style={{ borderColor: isLight ? '#e5e7eb' : 'rgba(255,255,255,0.3)', color: textColor, backgroundColor: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.15)' }}>
            🛍️ Ver catálogo de productos
          </a>
        </div>

        {/* Redes sociales */}
        {(store.contact_facebook || store.contact_tiktok || store.contact_instagram) && (
          <div className="flex gap-4 mt-2">
            {store.contact_facebook && (
              <a href={store.contact_facebook} target="_blank"
                className="w-11 h-11 rounded-full flex items-center justify-center shadow-sm transition-transform hover:scale-110"
                style={{ backgroundColor: isLight ? '#1877f2' : 'rgba(255,255,255,0.2)' }}>
                <svg className="w-5 h-5 text-white" fill="white" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
            )}
            {store.contact_tiktok && (
              <a href={store.contact_tiktok} target="_blank"
                className="w-11 h-11 rounded-full flex items-center justify-center shadow-sm transition-transform hover:scale-110"
                style={{ backgroundColor: isLight ? '#000000' : 'rgba(255,255,255,0.2)' }}>
                <svg className="w-5 h-5" fill="white" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.19 8.19 0 004.79 1.54V6.79a4.85 4.85 0 01-1.02-.1z"/>
                </svg>
              </a>
            )}
            {store.contact_instagram && (
              <a href={store.contact_instagram} target="_blank"
                className="w-11 h-11 rounded-full flex items-center justify-center shadow-sm transition-transform hover:scale-110"
                style={{ backgroundColor: isLight ? '#e1306c' : 'rgba(255,255,255,0.2)' }}>
                <svg className="w-5 h-5" fill="white" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
            )}
          </div>
        )}

        <p className="text-xs mt-4" style={{ color: subTextColor }}>
          © {store.name}
        </p>
      </div>
    </div>
  )
}

function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 128
}