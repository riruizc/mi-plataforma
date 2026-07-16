'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { IconLink, IconArchive, IconFactory, IconMessageCircle, IconMapPin, IconCamera, IconPalette, IconEye, IconCheck, IconPackage } from '@/lib/icons'

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
  const [copiedCatalog, setCopiedCatalog] = useState(false)
  const [copiedWholesale, setCopiedWholesale] = useState(false)
  const [savingContact, setSavingContact] = useState(false)
  const [successContact, setSuccessContact] = useState(false)
  const [catalogActive, setCatalogActive] = useState(false)
  const [togglingCatalog, setTogglingCatalog] = useState(false)
  const [wholesaleActive, setWholesaleActive] = useState(false)
  const [buttonColor, setButtonColor] = useState('#3b82f6')
  const [textColor, setTextColor] = useState('#ffffff')
  const [togglingWholesale, setTogglingWholesale] = useState(false)
  const [savingCoords, setSavingCoords] = useState(false)
  const [successCoords, setSuccessCoords] = useState(false)

  const [formData, setFormData] = useState({
    name: '', phone: '', owner_name: '', theme_color: '#3b82f6',
    origin_lat: '', origin_lng: ''
  })

  const [contactData, setContactData] = useState({
    contact_active: false, contact_bg_color: '#ffffff', contact_logo_shape: 'circular',
    contact_description: '', contact_whatsapp_msg: '',
    contact_facebook: '', contact_tiktok: '', contact_instagram: '',
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
        setWholesaleActive(data.wholesale_active || false)
        setButtonColor(data.button_color || '#3b82f6')
        setTextColor(data.text_color || '#ffffff')
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
      alert('Logo actualizado')
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
        button_color: buttonColor,
        text_color: textColor,
      }).eq('id', store.id)
      setStore((prev: any) => ({ ...prev, ...formData }))
      setSuccess(true); setTimeout(() => setSuccess(false), 3000)
    } catch (e) { alert('Error al guardar') }
    finally { setSaving(false) }
  }

  const saveCoords = async () => {
    if (!store) return
    setSavingCoords(true); setSuccessCoords(false)
    try {
      const supabase = createClient()
      await supabase.from('stores').update({
        origin_lat: formData.origin_lat ? parseFloat(formData.origin_lat) : null,
        origin_lng: formData.origin_lng ? parseFloat(formData.origin_lng) : null,
      }).eq('id', store.id)
      setStore((prev: any) => ({ ...prev, origin_lat: formData.origin_lat, origin_lng: formData.origin_lng }))
      setSuccessCoords(true); setTimeout(() => setSuccessCoords(false), 3000)
    } catch (e) { alert('Error al guardar coordenadas') }
    finally { setSavingCoords(false) }
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

  const toggleWholesaleActive = async () => {
    if (!store) return
    setTogglingWholesale(true)
    try {
      const supabase = createClient()
      const newValue = !wholesaleActive
      await supabase.from('stores').update({ wholesale_active: newValue }).eq('id', store.id)
      setWholesaleActive(newValue)
    } catch (e) { alert('Error al cambiar estado') }
    finally { setTogglingWholesale(false) }
  }

  const formLink = typeof window !== 'undefined' && store ? `${window.location.origin}/order/${store.store_prefix}` : ''
  const contactLink = typeof window !== 'undefined' && store ? `${window.location.origin}/contact/${store.store_prefix}` : ''
  const catalogLink = typeof window !== 'undefined' && store ? `${window.location.origin}/catalog/${store.store_prefix}` : ''
  const wholesaleLink = typeof window !== 'undefined' && store ? `${window.location.origin}/wholesale/${store.store_prefix}` : ''

  const copyLink = () => { navigator.clipboard.writeText(formLink); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  const copyContactLink = () => { navigator.clipboard.writeText(contactLink); setCopiedContact(true); setTimeout(() => setCopiedContact(false), 2000) }
  const copyCatalogLink = () => { navigator.clipboard.writeText(catalogLink); setCopiedCatalog(true); setTimeout(() => setCopiedCatalog(false), 2000) }
  const copyWholesaleLink = () => { navigator.clipboard.writeText(wholesaleLink); setCopiedWholesale(true); setTimeout(() => setCopiedWholesale(false), 2000) }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-db-line border-t-db-brand rounded-full animate-spin mx-auto" />
    </div>
  )

  const cardCls = "bg-db-surface rounded-2xl shadow-[0_1px_2px_rgba(23,26,43,0.04),0_8px_24px_-14px_rgba(23,26,43,0.25)] p-5"
  const toggleCls = (active: boolean) => `relative w-12 h-6 rounded-full transition-colors touch-manipulation disabled:opacity-50 ${active ? 'bg-db-delivered' : 'bg-db-line'}`
  const knobCls = (active: boolean) => `absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${active ? 'translate-x-7' : 'translate-x-1'}`

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-db-ink">Ajustes de tienda</h1>
        <p className="text-db-ink-soft text-sm mt-0.5">Personaliza tu tienda y formulario público</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">

          {/* 1. Formulario */}
          <div className={cardCls}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-bold text-db-ink flex items-center gap-2"><IconLink className="w-4 h-4 text-db-brand" />Link de tu formulario</h2>
                <p className="text-xs text-db-ink-soft mt-0.5">{formActive ? 'Tus clientes pueden hacer pedidos' : 'El formulario está desactivado'}</p>
              </div>
              <button onClick={toggleFormActive} disabled={togglingForm} className={toggleCls(formActive)}>
                <div className={knobCls(formActive)} />
              </button>
            </div>
            {formActive && (
              <>
                <div className="flex items-center gap-2 bg-db-paper rounded-xl px-3 py-2.5 mb-3">
                  <p className="text-xs text-db-ink-soft flex-1 truncate font-data">{formLink}</p>
                  <button onClick={copyLink} className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-db-brand text-white touch-manipulation">
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <button onClick={() => window.open(formLink, '_blank')}
                  className="w-full py-2 rounded-full text-sm font-semibold border border-db-line text-db-ink-soft touch-manipulation flex items-center justify-center gap-1.5">
                  <IconEye className="w-4 h-4" />Ver formulario
                </button>
              </>
            )}
          </div>

          {/* 2. Catálogo */}
          <div className={cardCls}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-bold text-db-ink flex items-center gap-2"><IconArchive className="w-4 h-4 text-db-brand" />Catálogo público</h2>
                <p className="text-xs text-db-ink-soft mt-0.5">{catalogActive ? 'Tus clientes pueden ver tu catálogo' : 'El catálogo está desactivado'}</p>
              </div>
              <button onClick={toggleCatalogActive} disabled={togglingCatalog} className={toggleCls(catalogActive)}>
                <div className={knobCls(catalogActive)} />
              </button>
            </div>
            {catalogActive && (
              <>
                <div className="flex items-center gap-2 bg-db-paper rounded-xl px-3 py-2.5 mb-3">
                  <p className="text-xs text-db-ink-soft flex-1 truncate font-data">{catalogLink}</p>
                  <button onClick={copyCatalogLink} className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-db-brand text-white touch-manipulation">
                    {copiedCatalog ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <button onClick={() => window.open(catalogLink, '_blank')}
                  className="w-full py-2 rounded-full text-sm font-semibold border border-db-line text-db-ink-soft flex items-center justify-center gap-1.5">
                  <IconEye className="w-4 h-4" />Ver catálogo
                </button>
              </>
            )}
          </div>

          {/* 3. Catálogo Mayorista */}
          <div className={cardCls}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-bold text-db-ink flex items-center gap-2"><IconFactory className="w-4 h-4 text-db-brand" />Catálogo Mayorista</h2>
                <p className="text-xs text-db-ink-soft mt-0.5">{wholesaleActive ? 'Tu catálogo mayorista está activo' : 'El catálogo mayorista está desactivado'}</p>
              </div>
              <button onClick={toggleWholesaleActive} disabled={togglingWholesale} className={toggleCls(wholesaleActive)}>
                <div className={knobCls(wholesaleActive)} />
              </button>
            </div>
            {wholesaleActive && (
              <>
                <div className="flex items-center gap-2 bg-db-paper rounded-xl px-3 py-2.5 mb-3">
                  <p className="text-xs text-db-ink-soft flex-1 truncate font-data">{wholesaleLink}</p>
                  <button onClick={copyWholesaleLink} className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-db-brand text-white touch-manipulation">
                    {copiedWholesale ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <button onClick={() => window.open(wholesaleLink, '_blank')}
                  className="w-full py-2 rounded-full text-sm font-semibold border border-db-line text-db-ink-soft flex items-center justify-center gap-1.5">
                  <IconEye className="w-4 h-4" />Ver catálogo mayorista
                </button>
              </>
            )}
            <div className="mt-3 bg-db-accent-tint rounded-xl px-3 py-2">
              <p className="text-xs text-db-accent">Configura los productos, precios y descuentos en el módulo <strong>Mayorista</strong> del menú</p>
            </div>
          </div>

          {/* 4. Panel de contacto */}
          <div className={cardCls}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-db-ink flex items-center gap-2"><IconMessageCircle className="w-4 h-4 text-db-brand" />Panel de contacto</h2>
                <p className="text-xs text-db-ink-soft mt-0.5">Página pública con tu info y redes sociales</p>
              </div>
              <button onClick={() => setContactData(p => ({ ...p, contact_active: !p.contact_active }))} className={toggleCls(contactData.contact_active)}>
                <div className={knobCls(contactData.contact_active)} />
              </button>
            </div>
            {contactData.contact_active && (
              <div className="flex items-center gap-2 bg-db-paper rounded-xl px-3 py-2.5 mb-4">
                <p className="text-xs text-db-ink-soft flex-1 truncate font-data">{contactLink}</p>
                <button onClick={copyContactLink} className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-db-brand text-white">
                  {copiedContact ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-db-ink mb-1">Descripción corta</label>
                <textarea value={contactData.contact_description}
                  onChange={e => setContactData(p => ({ ...p, contact_description: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand resize-none"
                  rows={2} placeholder="Ej: Venta de accesorios tecnológicos al mejor precio" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-db-ink mb-1">Mensaje de WhatsApp</label>
                <input type="text" value={contactData.contact_whatsapp_msg}
                  onChange={e => setContactData(p => ({ ...p, contact_whatsapp_msg: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand"
                  placeholder="Ej: Hola! Quiero hacer un pedido" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-db-ink mb-1">Color de fondo</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={contactData.contact_bg_color}
                      onChange={e => setContactData(p => ({ ...p, contact_bg_color: e.target.value }))}
                      className="w-10 h-10 rounded-lg border border-db-line cursor-pointer" />
                    <span className="text-xs text-db-ink-soft font-data">{contactData.contact_bg_color}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-db-ink mb-1">Forma del logo</label>
                  <div className="flex gap-2">
                    <button onClick={() => setContactData(p => ({ ...p, contact_logo_shape: 'circular' }))}
                      className={`flex-1 py-2 rounded-full text-xs font-semibold border ${contactData.contact_logo_shape === 'circular' ? 'bg-db-brand text-white border-db-brand' : 'bg-db-surface text-db-ink-soft border-db-line'}`}>
                      Circular
                    </button>
                    <button onClick={() => setContactData(p => ({ ...p, contact_logo_shape: 'square' }))}
                      className={`flex-1 py-2 rounded-full text-xs font-semibold border ${contactData.contact_logo_shape === 'square' ? 'bg-db-brand text-white border-db-brand' : 'bg-db-surface text-db-ink-soft border-db-line'}`}>
                      Cuadrado
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-db-ink mb-2">Redes sociales <span className="text-db-ink-soft font-normal">(deja vacío para ocultar)</span></label>
                <div className="space-y-2">
                  {[
                    { key: 'contact_facebook', tag: 'FB', placeholder: 'URL de Facebook' },
                    { key: 'contact_tiktok', tag: 'TT', placeholder: 'URL de TikTok' },
                    { key: 'contact_instagram', tag: 'IG', placeholder: 'URL de Instagram' },
                  ].map(({ key, tag, placeholder }) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-db-brand-tint text-db-brand text-[10px] font-bold flex items-center justify-center flex-shrink-0">{tag}</span>
                      <input type="text" value={(contactData as any)[key]}
                        onChange={e => setContactData(p => ({ ...p, [key]: e.target.value }))}
                        className="flex-1 px-3 py-2 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand"
                        placeholder={placeholder} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {successContact && (
              <div className="mt-3 bg-db-delivered-bg rounded-xl p-3 text-center flex items-center justify-center gap-1.5">
                <IconCheck className="w-3.5 h-3.5 text-db-delivered" />
                <p className="text-db-delivered text-sm font-semibold">Panel de contacto guardado</p>
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={saveContactSettings} disabled={savingContact}
                className="flex-1 py-3 bg-db-brand text-white rounded-full font-semibold text-sm disabled:opacity-50">
                {savingContact ? 'Guardando...' : 'Guardar panel de contacto'}
              </button>
              {contactData.contact_active && (
                <button onClick={() => window.open(contactLink, '_blank')}
                  className="px-4 py-3 border border-db-line text-db-ink-soft rounded-full text-sm font-semibold flex items-center gap-1.5"><IconEye className="w-4 h-4" />Ver</button>
              )}
            </div>
          </div>

          {/* 5. Punto de origen */}
          <div className={cardCls}>
            <h2 className="font-bold text-db-ink mb-1 flex items-center gap-2"><IconMapPin className="w-4 h-4 text-db-brand" />Punto de salida del motorizado</h2>
            <p className="text-xs text-db-ink-soft mb-4">Desde aquí se calcula la ruta óptima.</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-db-ink mb-1">Latitud</label>
                <input type="text" value={formData.origin_lat} onChange={e => setFormData(prev => ({ ...prev, origin_lat: e.target.value }))}
                  placeholder="Ej: -8.1116" className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand font-data" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-db-ink mb-1">Longitud</label>
                <input type="text" value={formData.origin_lng} onChange={e => setFormData(prev => ({ ...prev, origin_lng: e.target.value }))}
                  placeholder="Ej: -79.0286" className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand font-data" />
              </div>
            </div>
            {formData.origin_lat && formData.origin_lng && <p className="text-xs text-db-delivered mb-3 font-semibold">Coordenadas configuradas</p>}
            {successCoords && (
              <div className="mb-3 bg-db-delivered-bg rounded-xl p-3 text-center">
                <p className="text-db-delivered text-sm font-semibold">Coordenadas guardadas</p>
              </div>
            )}
            <button onClick={saveCoords} disabled={savingCoords || (!formData.origin_lat && !formData.origin_lng)}
              className="w-full py-2.5 bg-db-brand text-white rounded-full text-sm font-semibold disabled:opacity-40 touch-manipulation">
              {savingCoords ? 'Guardando...' : 'Guardar coordenadas'}
            </button>
          </div>

          {/* 6. Logo */}
          <div className={cardCls}>
            <h2 className="font-bold text-db-ink mb-4">Logo de la tienda</h2>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center bg-db-paper">
                {store?.logo_url ? <img src={store.logo_url} alt="Logo" className="w-full h-full object-cover" /> : <IconPackage className="w-7 h-7 text-db-ink-soft opacity-40" />}
              </div>
              <div className="flex-1">
                <p className="text-sm text-db-ink-soft mb-2">PNG o JPG, máximo 2MB</p>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) uploadLogo(e.target.files[0]) }} />
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-db-brand text-white rounded-full text-sm font-semibold disabled:opacity-50 touch-manipulation">
                  <IconCamera className="w-4 h-4" />{uploading ? 'Subiendo...' : 'Subir logo'}
                </button>
              </div>
            </div>
          </div>

          {/* 7. Colores */}
          <div className={cardCls}>
            <h2 className="font-bold text-db-ink mb-1 flex items-center gap-2"><IconPalette className="w-4 h-4 text-db-brand" />Colores de tu tienda</h2>
            <p className="text-xs text-db-ink-soft mb-4">Se aplican en el formulario, catálogo y página de contacto</p>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <input type="color" value={formData.theme_color}
                  onChange={e => setFormData(prev => ({ ...prev, theme_color: e.target.value }))}
                  className="w-12 h-12 rounded-xl border border-db-line cursor-pointer flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-db-ink">Color de tema / fondo</p>
                  <p className="text-xs text-db-ink-soft font-data">{formData.theme_color}</p>
                  <p className="text-xs text-db-ink-soft">Header y fondos de sección</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <input type="color" value={buttonColor}
                  onChange={e => setButtonColor(e.target.value)}
                  className="w-12 h-12 rounded-xl border border-db-line cursor-pointer flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-db-ink">Color de botones</p>
                  <p className="text-xs text-db-ink-soft font-data">{buttonColor}</p>
                  <p className="text-xs text-db-ink-soft">Botones de acción y enlaces</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <input type="color" value={textColor}
                  onChange={e => setTextColor(e.target.value)}
                  className="w-12 h-12 rounded-xl border border-db-line cursor-pointer flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-db-ink">Color de texto en botones</p>
                  <p className="text-xs text-db-ink-soft font-data">{textColor}</p>
                  <p className="text-xs text-db-ink-soft">Letras sobre los botones</p>
                </div>
              </div>
              {/* Preview */}
              <div className="rounded-xl overflow-hidden border border-db-line">
                <div className="p-3 text-center text-white text-sm font-semibold" style={{ backgroundColor: formData.theme_color }}>
                  Header de tu tienda
                </div>
                <div className="p-3 flex gap-2">
                  <div className="flex-1 py-2 rounded-lg text-xs font-bold text-center" style={{ backgroundColor: buttonColor, color: textColor }}>
                    Botón principal
                  </div>
                  <div className="flex-1 py-2 rounded-lg text-xs font-bold text-center border-2" style={{ borderColor: buttonColor, color: buttonColor }}>
                    Botón secundario
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Datos de la tienda */}
        <div className={`${cardCls} h-fit`}>
          <h2 className="font-bold text-db-ink mb-4">Datos de la tienda</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-db-ink mb-1">Nombre de la tienda</label>
              <input type="text" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-db-ink mb-1">Nombre del dueño</label>
              <input type="text" value={formData.owner_name} onChange={e => setFormData(prev => ({ ...prev, owner_name: e.target.value }))}
                className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-db-ink mb-1">Teléfono de contacto</label>
              <input type="text" value={formData.phone} onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-db-brand font-data" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-db-ink mb-1">Email</label>
              <input type="text" value={store?.email || ''} disabled
                className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm bg-db-paper text-db-ink-soft" />
              <p className="text-xs text-db-ink-soft mt-1">El email no se puede cambiar</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-db-ink mb-1">Prefijo de órdenes</label>
              <input type="text" value={store?.store_prefix || ''} disabled
                className="w-full px-3 py-2.5 border border-db-line rounded-xl text-sm bg-db-paper text-db-ink-soft font-data" />
              <p className="text-xs text-db-ink-soft mt-1">El prefijo es asignado por el admin y no cambia</p>
            </div>
            {success && (
              <div className="bg-db-delivered-bg rounded-xl p-3 text-center flex items-center justify-center gap-1.5">
                <IconCheck className="w-3.5 h-3.5 text-db-delivered" />
                <p className="text-db-delivered text-sm font-semibold">Cambios guardados correctamente</p>
              </div>
            )}
            <button onClick={saveSettings} disabled={saving}
              className="w-full py-3 bg-db-brand text-white rounded-full font-semibold text-sm disabled:opacity-50 touch-manipulation">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
