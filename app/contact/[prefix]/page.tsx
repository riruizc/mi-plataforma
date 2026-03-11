import { createClient } from '@supabase/supabase-js'

export default async function ContactPage({ params }: { params: Promise<{ prefix: string }> }) {
  const { prefix } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: store } = await supabase
    .from('stores')
    .select('id, name, phone, theme_color, logo_url, store_prefix, contact_active, contact_bg_color, contact_logo_shape, contact_description, contact_whatsapp_msg, contact_facebook, contact_tiktok, contact_instagram, catalog_active')
    .eq('store_prefix', prefix.toUpperCase())
    .single()

  // Tienda no existe
  if (!store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
        <p className="text-4xl mb-3">🔍</p>
        <p className="text-gray-700 font-semibold text-lg">Tienda no encontrada</p>
        <p className="text-gray-400 text-sm mt-1">Verifica el enlace e intenta de nuevo</p>
      </div>
    )
  }

  // Panel de contacto inactivo — página bonita
  if (!store.contact_active) {
    const color = store.theme_color || '#3b82f6'
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
        <div className="bg-white rounded-3xl shadow-lg p-8 max-w-sm w-full text-center">
          {store.logo_url ? (
            <img src={store.logo_url} alt={store.name}
              className="w-20 h-20 object-cover mx-auto mb-4 rounded-full border-4"
              style={{ borderColor: color + '33' }} />
          ) : (
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-3xl font-bold"
              style={{ backgroundColor: color }}>
              {store.name?.[0]?.toUpperCase()}
            </div>
          )}
          <h2 className="text-xl font-bold text-gray-900 mb-1">{store.name}</h2>
          <p className="text-4xl my-4">🔒</p>
          <p className="text-gray-600 font-medium">Panel de contacto no disponible</p>
          <p className="text-gray-400 text-sm mt-1">Esta página no está activa en este momento.</p>
          {store.phone && (
            <a href={`https://wa.me/51${store.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
              className="mt-6 w-full py-3 rounded-2xl text-white font-bold flex items-center justify-center gap-2 text-sm"
              style={{ backgroundColor: '#25d366' }}>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Contactar por WhatsApp
            </a>
          )}
        </div>
      </div>
    )
  }

  const bg = store.contact_bg_color || '#ffffff'
  const isDark = (() => {
    const hex = bg.replace('#', '')
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return (r * 299 + g * 587 + b * 114) / 1000 < 128
  })()
  const textColor = isDark ? '#ffffff' : '#111827'
  const subTextColor = isDark ? 'rgba(255,255,255,0.7)' : '#6b7280'
  const color = store.theme_color || '#3b82f6'
  const whatsappPhone = store.phone?.replace(/\D/g, '') || ''
  const whatsappMsg = store.contact_whatsapp_msg || `Hola! Me comunico desde tu página de contacto 👋`
  const catalogUrl = `/catalog/${store.store_prefix}`

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: bg }}>
      <div className="max-w-sm w-full flex flex-col items-center text-center">

        {/* Logo */}
        {store.logo_url ? (
          <img src={store.logo_url} alt={store.name}
            className={`w-28 h-28 object-cover mb-5 border-4 ${store.contact_logo_shape === 'square' ? 'rounded-3xl' : 'rounded-full'}`}
            style={{ borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)' }} />
        ) : (
          <div className={`w-28 h-28 flex items-center justify-center mb-5 text-white text-4xl font-bold ${store.contact_logo_shape === 'square' ? 'rounded-3xl' : 'rounded-full'}`}
            style={{ backgroundColor: color }}>
            {store.name?.[0]?.toUpperCase()}
          </div>
        )}

        {/* Nombre */}
        <h1 className="text-2xl font-bold mb-1" style={{ color: textColor }}>{store.name}</h1>

        {/* Descripción */}
        {store.contact_description && (
          <p className="text-sm mb-6 leading-relaxed" style={{ color: subTextColor }}>{store.contact_description}</p>
        )}

        {/* WhatsApp */}
        {whatsappPhone && (
          <a href={`https://wa.me/51${whatsappPhone}?text=${encodeURIComponent(whatsappMsg)}`}
            target="_blank" rel="noreferrer"
            className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 mb-3 shadow-md"
            style={{ backgroundColor: '#25d366' }}>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Escribir por WhatsApp
          </a>
        )}

        {/* Ver catálogo */}
        {store.catalog_active && (
          <a href={catalogUrl}
            className="w-full py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 mb-6 border-2"
            style={{ borderColor: color, color, backgroundColor: 'transparent' }}>
            🛍️ Ver catálogo de productos
          </a>
        )}

        {/* Redes sociales */}
        {(store.contact_facebook || store.contact_tiktok || store.contact_instagram) && (
          <div className="flex items-center gap-4 mt-2">
            {store.contact_facebook && (
              <a href={store.contact_facebook} target="_blank" rel="noreferrer"
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-sm"
                style={{ backgroundColor: '#1877f2' }}>f</a>
            )}
            {store.contact_tiktok && (
              <a href={store.contact_tiktok} target="_blank" rel="noreferrer"
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl shadow-sm"
                style={{ backgroundColor: '#010101' }}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/>
                </svg>
              </a>
            )}
            {store.contact_instagram && (
              <a href={store.contact_instagram} target="_blank" rel="noreferrer"
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl shadow-sm"
                style={{ background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' }}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
                </svg>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}