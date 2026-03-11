'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'

export default function SettingsPage() {
  const [store, setStore] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [formActive, setFormActive] = useState(true)
  const [togglingForm, setTogglingForm] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedContact, setCopiedContact] = useState(false)
  const [savingContact, setSavingContact] = useState(false)
  const [successContact, setSuccessContact] = useState(false)
  const [catalogActive, setCatalogActive] = useState(false)
  const [togglingCatalog, setTogglingCatalog] = useState(false)

  const [formData, setFormData] = useState({
    name: '', phone: '', owner_name: '', theme_color: '#3b82f6',
    origin_lat: '', origin_lng: ''
  })

  const [contactData, setContactData] = useState({
    contact_active: false,
    contact_bg_color: '#ffffff',
    contact_logo_shape: 'circular',
    contact_description: '',
    contact_whatsapp_msg: '',
    contact_facebook: '',
    contact_tiktok: '',
    contact_instagram: '',
  })

  const fileRef = useRef<any>(null)

  useEffect(() => { loadStore() }, [])

  const loadStore = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('stores').select('*').eq('email', (user.email ?? '').toLowerCase()).single()
      if (data) {
        setStore(data)
        setFormActive(data.form_active !== false)
        setCatalogActive(data.catalog_active || false)
        setFormData({
          name: data.name || '', phone: data.phone || '', owner_name: data.owner_name || '',
          theme_color: data.theme_color || '#3b82f6',
          origin_lat: data.origin_lat ? String(data.origin_lat) : '',
          origin_lng: data.origin_lng ? String(data.origin_lng) : '',
        })
        setContactData({
          contact_active: data.contact_active || false,
          contact_bg_color: data.contact_bg_color || '#ffffff',
          contact_logo_shape: data.contact_logo_shape || 'circular',
          contact_description: data.contact_description || '',
          contact_whatsapp_msg: data.contact_whatsapp_msg || '',
          contact_facebook: data.contact_facebook || '',
          contact_tiktok: data.contact_tiktok || '',
          contact_instagram: data.contact_instagram || '',
        })
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const uploadLogo = async (file: File) => {
    if (!store) return
    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = 'store-' + store.id + '.' + ext
      const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
      if (error) { alert('Error al subir el logo'); return }
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
      await supabase.from('stores').update({ logo_url: urlData.publicUrl }).eq('id', store.id)
      setStore((prev: any) => ({ ...prev, logo_url: urlData.publicUrl }))
      alert('Logo actualizado ✅')
    } catch (e) { alert('Error al subir el logo') }
    finally { setUploading(false) }
  }

  const saveSettings = async () => {
    if (!store) return
    setSaving(true); setSuccess(false)
    try {
      const supabase = createClient()
      await supabase.from('stores').update({
        name: formData.name, phone: formData.phone, owner_name: formData.owner_name,
        theme_color: formData.theme_color,
        origin_lat: formData.origin_lat ? parseFloat(formData.origin_lat) : null,
        origin_lng: formData.origin_lng ? parseFloat(formData.origin_lng) : null,
      }).eq('id', store.id)
      setStore((prev: any) => ({ ...prev, ...formData }))
      setSuccess(true); setTimeout(() => setSuccess(false), 3000)
    } catch (e) { alert('Error al guardar') }
    finally { setSaving(false) }
  }

  const saveContactSettings = async () => {
    if (!store) return
    setSavingContact(true); setSuccessContact(false)
    try {
      const supabase = createClient()
      await supabase.from('stores').update(contactData).eq('id', store.id)
      setStore((prev: any) => ({ ...prev, ...contactData }))
      setSuccessContact(true); setTimeout(() => setSuccessContact(false), 3000)
    } catch (e) { alert('Error al guardar') }
    finally { setSavingContact(false) }
  }

  const toggleFormActive = async () => {
    if (!store) return
    setTogglingForm(true)
    try {
      const supabase = createClient()
      const newValue = !formActive
      await supabase.from('stores').update({ form_active: newValue }).eq('id', store.id)
      setFormActive(newValue)
    } catch (e) { alert('Error al cambiar estado') }
    finally { setTogglingForm(false) }
  }

  const toggleCatalogActive = async () => {
    if (!store) return
    setTogglingCatalog(true)
    try {
      const supabase = createClient()
      const newValue = !catalogActive
      await supabase.from('stores').update({ catalog_active: newValue }).eq('id', store.id)
      setCatalogActive(newValue)
    } catch (e) { alert('Error al cambiar estado') }
    finally { setTogglingCatalog(false) }
  }

  const formLink = typeof window !== 'undefined' && store ? `${window.location.origin}/order/${store.store_prefix}` : ''
  const contactLink = typeof window !== 'undefined' && store ? `${window.location.origin}/contact/${store.store_prefix}` : ''
  const catalogLink = typeof window !== 'undefined' && store ? `${window.location.origin}/catalog/${store.store_prefix}` : ''
  const copyLink = () => { navigator.clipboard.writeText(formLink); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  const copyContactLink = () => { navigator.clipboard.writeText(contactLink); setCopiedContact(true); setTimeout(() => setCopiedContact(false), 2000) }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto" />
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Ajustes de tienda</h1>
        <p className="text-gray-500 text-sm mt-0.5">Personaliza tu tienda y formulario público</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">

          {/* 1. Formulario */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-semibold text-gray-900">🔗 Link de tu formulario</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formActive ? 'Tus clientes pueden hacer pedidos' : 'El formulario está desactivado'}
                </p>
              </div>
              <button onClick={toggleFormActive} disabled={togglingForm}
                className={`relative w-12 h-6 rounded-full transition-colors touch-manipulation disabled:opacity-50 ${formActive ? 'bg-green-500' : 'bg-gray-300'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${formActive ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>
            {formActive && (
              <>
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 mb-3 border border-gray-200">
                  <p className="text-xs text-gray-600 flex-1 truncate font-mono">{formLink}</p>
                  <button onClick={copyLink} className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white touch-manipulation">
                    {copied ? '✅ Copiado' : '📋 Copiar'}
                  </button>
                </div>
                <button onClick={() => window.open(formLink, '_blank')}
                  className="w-full py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 touch-manipulation">
                  👁️ Ver formulario
                </button>
              </>
            )}
          </div>

          {/* 2. Catálogo */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-semibold text-gray-900">🛍️ Catálogo público</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {catalogActive ? 'Tus clientes pueden ver tu catálogo' : 'El catálogo está desactivado'}
                </p>
              </div>
              <button onClick={toggleCatalogActive} disabled={togglingCatalog}
                className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-50 ${catalogActive ? 'bg-green-500' : 'bg-gray-300'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${catalogActive ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>
            {catalogActive && (
              <>
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 mb-3 border border-gray-200">
                  <p className="text-xs text-gray-600 flex-1 truncate font-mono">{catalogLink}</p>
                </div>
                <button onClick={() => window.open(catalogLink, '_blank')}
                  className="w-full py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-700">
                  👁️ Ver catálogo
                </button>
              </>
            )}
          </div>

          {/* 3. Panel de contacto */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">📇 Panel de contacto</h2>
                <p className="text-xs text-gray-400 mt-0.5">Página pública con tu info y redes sociales</p>
              </div>
              <button onClick={() => setContactData(p => ({ ...p, contact_active: !p.contact_active }))}
                className={`relative w-12 h-6 rounded-full transition-colors ${contactData.contact_active ? 'bg-green-500' : 'bg-gray-300'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${contactData.contact_active ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>

            {contactData.contact_active && (
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 mb-4 border border-gray-200">
                <p className="text-xs text-gray-600 flex-1 truncate font-mono">{contactLink}</p>
                <button onClick={copyContactLink} className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 text-white">
                  {copiedContact ? '✅ Copiado' : '📋 Copiar'}
                </button>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Descripción corta</label>
                <textarea value={contactData.contact_description}
                  onChange={e => setContactData(p => ({ ...p, contact_description: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={2} placeholder="Ej: Venta de accesorios tecnológicos al mejor precio 🚀" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Mensaje de WhatsApp</label>
                <input type="text" value={contactData.contact_whatsapp_msg}
                  onChange={e => setContactData(p => ({ ...p, contact_whatsapp_msg: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Hola! Quiero hacer un pedido 👋" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Color de fondo</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={contactData.contact_bg_color}
                      onChange={e => setContactData(p => ({ ...p, contact_bg_color: e.target.value }))}
                      className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer" />
                    <span className="text-xs text-gray-500 font-mono">{contactData.contact_bg_color}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Forma del logo</label>
                  <div className="flex gap-2">
                    <button onClick={() => setContactData(p => ({ ...p, contact_logo_shape: 'circular' }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium border ${contactData.contact_logo_shape === 'circular' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                      ⭕ Circular
                    </button>
                    <button onClick={() => setContactData(p => ({ ...p, contact_logo_shape: 'square' }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium border ${contactData.contact_logo_shape === 'square' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                      ⬛ Cuadrado
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Redes sociales <span className="text-gray-400">(deja vacío para ocultar)</span></label>
                <div className="space-y-2">
                  {[
                    { key: 'contact_facebook', icon: '📘', placeholder: 'URL de Facebook' },
                    { key: 'contact_tiktok', icon: '🎵', placeholder: 'URL de TikTok' },
                    { key: 'contact_instagram', icon: '📸', placeholder: 'URL de Instagram' },
                  ].map(({ key, icon, placeholder }) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-lg w-7">{icon}</span>
                      <input type="text" value={(contactData as any)[key]}
                        onChange={e => setContactData(p => ({ ...p, [key]: e.target.value }))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={placeholder} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {successContact && (
              <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                <p className="text-green-700 text-sm font-medium">✅ Panel de contacto guardado</p>
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={saveContactSettings} disabled={savingContact}
                className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50">
                {savingContact ? 'Guardando...' : 'Guardar panel de contacto'}
              </button>
              {contactData.contact_active && (
                <button onClick={() => window.open(contactLink, '_blank')}
                  className="px-4 py-3 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium">👁️ Ver</button>
              )}
            </div>
          </div>

          {/* 4. Punto de origen */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-1">📍 Punto de salida del motorizado</h2>
            <p className="text-xs text-gray-400 mb-4">Desde aquí se calcula la ruta óptima.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Latitud</label>
                <input type="text" value={formData.origin_lat} onChange={e => setFormData(prev => ({ ...prev, origin_lat: e.target.value }))}
                  placeholder="Ej: -8.1116" className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Longitud</label>
                <input type="text" value={formData.origin_lng} onChange={e => setFormData(prev => ({ ...prev, origin_lng: e.target.value }))}
                  placeholder="Ej: -79.0286" className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            {formData.origin_lat && formData.origin_lng && <p className="text-xs text-green-600 mt-2">📍 Coordenadas configuradas</p>}
          </div>

          {/* 5. Logo */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Logo de la tienda</h2>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl border-2 border-gray-200 overflow-hidden flex items-center justify-center bg-gray-50">
                {store?.logo_url ? <img src={store.logo_url} alt="Logo" className="w-full h-full object-cover" /> : <span className="text-3xl">🏪</span>}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-2">PNG o JPG, máximo 2MB</p>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) uploadLogo(e.target.files[0]) }} />
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 touch-manipulation">
                  {uploading ? 'Subiendo...' : '📤 Subir logo'}
                </button>
              </div>
            </div>
          </div>

          {/* 6. Color */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Color de tema</h2>
            <div className="flex items-center gap-4">
              <input type="color" value={formData.theme_color}
                onChange={e => setFormData(prev => ({ ...prev, theme_color: e.target.value }))}
                className="w-16 h-16 rounded-xl border border-gray-200 cursor-pointer" />
              <div>
                <p className="text-sm font-medium text-gray-700">Color seleccionado</p>
                <p className="text-sm text-gray-500 font-mono">{formData.theme_color}</p>
                <p className="text-xs text-gray-400 mt-1">Aparece en el formulario público</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl p-4 text-white text-sm font-medium text-center" style={{ backgroundColor: formData.theme_color }}>
              Vista previa del color en tu formulario
            </div>
          </div>

        </div>

        {/* Datos de la tienda */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 h-fit">
          <h2 className="font-semibold text-gray-900 mb-4">Datos de la tienda</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la tienda</label>
              <input type="text" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del dueño</label>
              <input type="text" value={formData.owner_name} onChange={e => setFormData(prev => ({ ...prev, owner_name: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono de contacto</label>
              <input type="text" value={formData.phone} onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="text" value={store?.email || ''} disabled
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-400" />
              <p className="text-xs text-gray-400 mt-1">El email no se puede cambiar</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prefijo de órdenes</label>
              <input type="text" value={store?.store_prefix || ''} disabled
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-400" />
              <p className="text-xs text-gray-400 mt-1">El prefijo es asignado por el admin y no cambia</p>
            </div>
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                <p className="text-green-700 text-sm font-medium">✅ Cambios guardados correctamente</p>
              </div>
            )}
            <button onClick={saveSettings} disabled={saving}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50 touch-manipulation">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}