'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'

const SHALOM_ORIGINS = [
  'CAJAMARCA / HUALGAYOC / BAMBAMARCA / BAMBAMARCA',
  'AREQUIPA / AREQUIPA / AREQUIPA / AV PARRA 379 CO',
  'ICA / ICA / ICA / ICA SAN JOAQUIN',
  'APURIMAC / ANDAHUAYLAS / ANDAHUAYLAS / ANDAHUAYLAS',
  'PASCO / PASCO / CHAUPIMARCA / CERRO DE PASCO',
  'CAJAMARCA / CAJAMARCA / CAJAMARCA / CAJAMARCA CO',
  'SAN MARTIN / MOYOBAMBA / MOYOBAMBA / OVALO ORQUIDEAS CO',
  'APURIMAC / ABANCAY / ABANCAY / ABANCAY',
  'LIMA / BARRANCA / BARRANCA / BARRANCA',
  'ANCASH / SANTA / CHIMBOTE / AV ENRIQUE MEIGGS',
  'CUSCO / CUSCO / WANCHAQ / CUSCO PARQUE INDUSTRIAL',
  'LIMA / HUAURA / HUACHO / SALAVERRY HUACHO CO',
  'MOQUEGUA / ILO / ILO / ILO CO PAMPA INALAMBRICA',
  'AYACUCHO / HUAMANGA / AYACUCHO / AYACUCHO CO',
  'LIMA / CAÑETE / SAN VICENTE DE CANET / CAÑETE SAN VICENTE',
  'ICA / CHINCHA / CHINCHA ALTA / PROLONG LUIS MASSARO',
  'JUNIN / HUANCAYO / EL TAMBO / AV MARISCAL CASTILLA CO PARQUE INDUSTRIAL',
  'LAMBAYEQUE / CHICLAYO / LA VICTORIA / AV VICTOR R. HAYA CO',
  'HUANUCO / HUANUCO / HUANUCO / JR AGUILAR',
  'PUNO / SAN ROMAN / JULIACA / JR. MAMA OCLLO',
  'PUNO / PUNO / PUNO / AV COSTANERA',
  'CUSCO / CANCHIS / SICUANI / SICUANI CO OVALO SAN ANDRES',
  'TACNA / TACNA / TACNA / TACNA CO AV. JORGE BASADRE',
  'PIURA / TALARA / PARINAS / TALARA CO ASOC CALIFORNIA',
  'LA LIBERTAD / TRUJILLO / TRUJILLO / CALLE LIVERPOOL',
  'TUMBES / TUMBES / TUMBES / TUMBES - AV ARICA',
  'MOQUEGUA / MARISCAL NIETO / MOQUEGUA / SAN ANTONIO',
  'LIMA / LIMA / LA VICTORIA / JR. RAYMONDI',
  'LIMA / LIMA / VILLA MARIA DEL TRIUNFO / LAS CONCHITAS',
  'AMAZONAS / UTCUBAMBA / BAGUA GRANDE / BAGUA GRANDE',
  'AMAZONAS / BONGARA / JAZAN / PEDRO RUIZ',
  'CAJAMARCA / CHOTA / CHOTA / CHOTA',
  'LORETO / MAYNAS / IQUITOS / IQUITOS JR FRANCISCO BOLOGNESI',
  'UCAYALI / CORONEL PORTILLO / PUCALLPA CALLERIA / CALLERIA JR JOSE GALVEZ',
  'HUANUCO / LEONCIO PRADO / RUPA RUPA / TINGO MARIA CO BUENOS AIRES',
  'ICA / PISCO / PISCO / AV ABRAHAM VALDELOMAR CO',
  'LIMA / LIMA / ATE-VITARTE / HUAYCAN ENTRADA',
  'CALLAO / CALLAO / CALLAO / CALLAO FAUCETT',
  'CUSCO / ESPINAR / YAURI ( ESPINAR ) / ESPINAR',
  'LIMA / LIMA / PACHACAMAC / LA CURVA DE MANCHAY',
  'LIMA / LIMA / VILLA EL SALVADOR / AV. CESAR VALLEJO',
  'CALLAO / CALLAO / VENTANILLA / PARAD. LOS LICENCIADOS',
  'LIMA / LIMA / BRENA / AV VENEZUELA',
  'LIMA / HUARAL / HUARAL / HUARAL',
  'ANCASH / HUARAZ / HUARAZ / HUARAZ',
  'CAJAMARCA / CUTERVO / CUTERVO / CUTERVO',
  'ICA / NAZCA / NAZCA / AV CIRCUNVALACION NAZCA',
  'ICA / NAZCA / MARCONA / SAN JUAN DE MARCONA',
  'PASCO / PASCO / HUAYLLAY / HUAYLLAY',
  'PIURA / TALARA / EL ALTO / EL ALTO',
  'TUMBES / ZARUMILLA / AGUAS VERDES / AGUAS VERDES',
  'PIURA / TALARA / LOS ORGANOS / LOS ORGANOS',
  'TUMBES / CONTRALMIRANTE VILLA / ZORRITOS / ZORRITOS',
  'HUANUCO / AMBO / AMBO / AMBO',
  'LAMBAYEQUE / FERRENAFE / FERRENAFE / FERREÑAFE',
  'AREQUIPA / AREQUIPA / CERRO COLORADO / CIUDAD MUNICIPAL',
  'LIMA / BARRANCA / PARAMONGA / PARAMONGA',
  'AREQUIPA / AREQUIPA / CERRO COLORADO / ASOC LAS FLORES - AV 54',
  'AYACUCHO / HUANTA / HUANTA / HUANTA',
  'LIMA / LIMA / SAN JUAN DE LURIGANCHO / CRUZ DE MOTUPE',
  'AREQUIPA / AREQUIPA / CAYMA / PLAZA LA TOMILLA',
  'AREQUIPA / AREQUIPA / CERRO COLORADO / AV PUMACAHUA',
  'PIURA / TALARA / MANCORA / MÁNCORA',
  'AREQUIPA / AREQUIPA / MARIANO MELGAR / MARIANO MELGAR',
  'AREQUIPA / AREQUIPA / SOCABAYA / AV SOCABAYA - LOS TORITOS',
  'LIMA / CAÑETE / MALA / MALA',
  'LIMA / LIMA / SAN JUAN DE LURIGANCHO / SJL- LAS FLORES',
  'LAMBAYEQUE / LAMBAYEQUE / MOTUPE / MOTUPE',
  'LIMA / HUARAL / CHANCAY / CHANCAY',
  'AREQUIPA / AREQUIPA / MIRAFLORES / MIRAFLORES AREQUIPA',
  'AREQUIPA / AREQUIPA / PAUCARPATA / URB MANUEL PRADO',
  'JUNIN / SATIPO / SATIPO / SATIPO',
  'JUNIN / CHANCHAMAYO / SAN RAMON / SAN RAMÓN',
  'JUNIN / CHANCHAMAYO / BAJO PICHANAQUI / PICHANAKI',
  'JUNIN / TARMA / TARMA / TARMA',
  'LIMA / LIMA / LURIGANCHO / CHOSICA',
  'LIMA / CAÑETE / CHILCA / AV NICOLAS DE PIEROLA CDRA 4',
  'LIMA / LIMA / LOS OLIVOS / PRO',
  'LIMA / LIMA / RIMAC / RIMAC AV. AMANCAES',
  'ANCASH / SANTA / NUEVO CHIMBOTE / OVALO DE LA FAMILIA',
  'LIMA / LIMA / JESUS MARIA / AV. SAN FELIPE',
  'LIMA / LIMA / VILLA MARIA DEL TRIUNFO / PESQUERO',
  'LIMA / LIMA / MAGDALENA DEL MAR / MAGDALENA DEL MAR',
  'ANCASH / CASMA / CASMA / CASMA',
  'LIMA / LIMA / MIRAFLORES / AV. JOSE PARDO',
  'LIMA / LIMA / SANTIAGO DE SURCO / AV. PRIMAVERA 120',
  'LIMA / LIMA / SAN MARTIN DE PORRES / SMP-AV. PROCERES',
  'LAMBAYEQUE / CHICLAYO / TUMAN / TUMAN',
  'LIMA / LIMA / PUENTE PIEDRA / ZAPALLAL',
  'PIURA / PIURA / PIURA / AV. LUIS EGUIGUREN',
  'LIMA / LIMA / ATE-VITARTE / PUENTE SANTA ANITA',
  'CUSCO / CUSCO / SAN JERONIMO / SAN JERONIMO',
  'LA LIBERTAD / TRUJILLO / EL PORVENIR / AV HERMANOS ANGULO',
  'CUSCO / CUSCO / SANTIAGO / AV ANTONIO LORENA',
  'JUNIN / HUANCAYO / CHILCA / CHILCA HUANCAYO',
  'LIMA / LIMA / VILLA MARIA DEL TRIUNFO / AV. LIMA - VMT',
  'LIMA / LIMA / ATE-VITARTE / LOS SAUCES',
  'LIMA / LIMA / CERCADO LIMA / MALVINAS - JR. RICARDO TRENEMAN',
  'PIURA / PIURA / 26 DE OCTUBRE / PARQUE INDUSTRIAL CO PIURA FUTURA',
  'CUSCO / ANTA / ANTA / ANTA IZCUCHACA',
  'SAN MARTIN / MARISCAL CACERES / JUANJUI / JUANJUÍ FERNANDO BELAUNDE TERRY CO',
  'LIMA / LIMA / LA VICTORIA / AV. CANADA',
  'LORETO / ALTO AMAZONAS / YURIMAGUAS / YURIMAGUAS',
  'CUSCO / URUBAMBA / URUBAMBA / CUSCO URUBAMBA',
  'CUSCO / URUBAMBA / CHINCHERO / CHINCHERO',
  'CUSCO / LA CONVENCION / SANTA ANA / QUILLABAMBA',
  'LIMA / LIMA / SAN BORJA / AVIACION 2819',
  'JUNIN / YAULI / LA OROYA / LA OROYA',
  'LIMA / LIMA / INDEPENDENCIA / PLAZA NORTE S. EXPRESS',
  'LIMA / LIMA / SAN JUAN DE MIRAFLORES / MARIA AUXILIADORA',
  'LIMA / LIMA / LOS OLIVOS / AV HUANDOY CON MARAÑON',
  'HUANCAVELICA / HUANCAVELICA / HUANCAVELICA / HUANCAVELICA',
  'CUSCO / CUSCO / WANCHAQ / AV PACHACUTEC',
  'TACNA / TACNA / CORONEL GREGORIO ALBARRACIN LANCHIPA / VILLA SAN FRANCISCO',
  'LIMA / LIMA / SAN ISIDRO / RIV. NAVARRETE',
  'LIMA / LIMA / SAN ISIDRO / CORPAC',
  'LIMA / LIMA / JESUS MARIA / AV. ARENALES',
  'LIMA / LIMA / SURQUILLO / AV. ARAMBURU',
  'MADRE DE DIOS / TAMBOPATA / TAMBOPATA / TAMBOPATA AV LA JOYA CO',
  'PASCO / OXAPAMPA / VILLA RICA / VILLA RICA',
  'AREQUIPA / ISLAY / MOLLENDO / MOLLENDO CO',
  'LAMBAYEQUE / LAMBAYEQUE / TUCUME / TUCUME',
  'TACNA / TACNA / TACNA / AV VIGIL',
  'AREQUIPA / CAMANA / CAMANA / CAMANA',
  'AREQUIPA / ISLAY / MOLLENDO / CERCADO MOLLENDO',
  'AREQUIPA / CAYLLOMA / MAJES / CALLE YARABAMBA',
  'JUNIN / HUANCAYO / SAN AGUSTIN / SAN AGUSTIN DE CAJAS',
  'MADRE DE DIOS / TAMBOPATA / INAMBARI / MAZUKO',
  'LIMA / LIMA / CARABAYLLO / AV TUPAC AMARU KM. 19',
  'LA LIBERTAD / TRUJILLO / EL PORVENIR / ALTO TRUJILLO',
  'LIMA / LIMA / SAN MARTIN DE PORRES / AV. CARLOS IZAGUIRRE CUADRA 23',
  'MOQUEGUA / ILO / ILO / ILO PUERTO',
  'CUSCO / CUSCO / WANCHAQ / VELASCO ASTETE',
  'UCAYALI / CORONEL PORTILLO / PUCALLPA YARINACOCHA / PUCALLPA CO FEDERICO BASADRE',
  'UCAYALI / CORONEL PORTILLO / PUCALLPA YARINACOCHA / YARINACOCHA CENTRO',
  'JUNIN / CHANCHAMAYO / PERENE / PERENE',
  'CAJAMARCA / CELENDIN / CELENDIN / CELENDIN',
  'SAN MARTIN / SAN MARTIN / LA BANDA DE SHILCAYO / TARAPOTO LA BANDA DE SHILCAYO',
  'SAN MARTIN / SAN MARTIN / MORALES / TARAPOTO JR. SARGENTO LOREZ',
  'SAN MARTIN / SAN MARTIN / TARAPOTO / JR LEONCIO PRADO',
  'LIMA / LIMA / CHORRILLOS / LAS DELICIAS DE VILLA',
  'ANCASH / CARHUAZ / CARHUAZ / CARHUAZ',
  'AMAZONAS / CHACHAPOYAS / CHACHAPOYAS / CHACHAPOYAS JR GRAU',
  'SAN MARTIN / PICOTA / PICOTA / PICOTA',
  'PUNO / CHUCUITO / DESAGUADERO / DESAGUADERO',
  'ANCASH / YUNGAY / YUNGAY / YUNGAY',
  'MOQUEGUA / MARISCAL NIETO / MOQUEGUA / CALLE LIMA',
  'PUNO / EL COLLAO / ILAVE / ILAVE',
  'LIMA / LIMA / SANTA ROSA / SANTA ROSA',
  'CAJAMARCA / CAJABAMBA / CAJABAMBA / CAJABAMBA',
  'CALLAO / CALLAO / BELLAVISTA / BELLAVISTA CALLAO',
  'TUMBES / TUMBES / TUMBES / TUMBES PUYANGO',
  'LIMA / LIMA / ATE-VITARTE / SANTA CLARA',
  'LIMA / LIMA / VILLA EL SALVADOR / ÓVALO MARIÁTEGUI',
  'LIMA / LIMA / VILLA EL SALVADOR / 01 DE MAYO',
  'LIMA / LIMA / SAN JUAN DE MIRAFLORES / AV. CANEVARO',
  'LIMA / LIMA / VILLA MARIA DEL TRIUNFO / AV. VILLA MARIA',
  'LIMA / LIMA / SANTIAGO DE SURCO / SURCO MATEO PUMACAHUA',
  'LIMA / LIMA / CARABAYLLO / AV. TUPAC AMARU KM. 23.5',
  'LIMA / LIMA / SAN MARTIN DE PORRES / GERMÁN AGUIRRE',
  'AREQUIPA / AREQUIPA / UCHUMAYO / UCHUMAYO',
  'LIMA / HUAURA / HUAURA / HUAURA',
  'UCAYALI / PADRE ABAD / AGUAYTIA / AGUAYTÍA',
  'PUNO / SAN ROMAN / JULIACA / AV. HUANCANE CDRA. 9',
  'PUNO / SAN ROMAN / JULIACA / LAS MERCEDES',
  'TUMBES / TUMBES / TUMBES / TUMBES CO - PANAMERICANA NORTE KM 2360',
  'JUNIN / HUANCAYO / HUANCAYO / TERMINAL LOS ANDES',
  'ICA / ICA / SANTIAGO / ICA SANTIAGO',
  'HUANUCO / LEONCIO PRADO / JOSE CRESPO Y CASTIL / AUCAYACU',
  'LA LIBERTAD / TRUJILLO / TRUJILLO / ATAHUALPA',
  'LA LIBERTAD / PACASMAYO / GUADALUPE / CIUDAD DE DIOS',
  'SAN MARTIN / TOCACHE / TOCACHE / AV FERNANDO BELAUNDE',
]

type Agency = {
  id: string; agency_name: string; destinations: string[]; is_active: boolean
}

type OrderItem = {
  product_name: string; color: string; quantity: number
}

type Order = {
  id: string; order_code: string; destination: string
  pending_amount: number; delivery_method: string; agency_name?: string
  customers?: { name?: string; phone?: string; dni?: string }
  order_items?: OrderItem[]
}

export default function ToolsPage() {
  const [storeId, setStoreId] = useState<string | null>(null)
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'agencias' | 'etiquetas'>('agencias')
  const [newAgency, setNewAgency] = useState({ name: '', destinations: '' })
  const [saving, setSaving] = useState(false)

  // Shalom Pro
  const [showShalomPro, setShowShalomPro] = useState(false)
  const [shalomOrders, setShalomOrders] = useState<Order[]>([])
  const [selectedShalom, setSelectedShalom] = useState<string[]>([])
  const [shalomOriginQuery, setShalomOriginQuery] = useState('')
  const [shalomOrigin, setShalomOrigin] = useState('')
  const [shalomOriginSuggestions, setShalomOriginSuggestions] = useState<string[]>([])
  const [loadingShalom, setLoadingShalom] = useState(false)
  const hasShalomAgency = agencies.some(a => a.agency_name.toLowerCase().includes('shalom') && a.is_active)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: store } = await supabase.from('stores').select('id').eq('email', user.email).single()
      if (!store) return
      setStoreId(store.id)

      const { data: agencyData } = await supabase.from('delivery_agencies').select('*').eq('store_id', store.id).order('agency_name')
      setAgencies(agencyData || [])

      const { data: orderData } = await supabase
        .from('orders')
        .select('*, customers(name, phone, dni), order_items(product_name, color, quantity)')
        .eq('store_id', store.id)
        .in('status', ['pending', 'in_route'])
        .order('created_at', { ascending: false })
      setOrders(orderData || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const loadShalomOrders = async () => {
    if (!storeId) return
    setLoadingShalom(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('orders')
        .select('*, customers(name, phone, dni), order_items(product_name, color, quantity)')
        .eq('store_id', storeId)
        .eq('status', 'pending')
        .ilike('agency_name', '%shalom%')
        .order('created_at', { ascending: false })
      setShalomOrders(data || [])
      setSelectedShalom((data || []).map((o: any) => o.id))
    } catch (e) { console.error(e) }
    finally { setLoadingShalom(false) }
  }

  const openShalomPro = () => {
    setShowShalomPro(true)
    setShalomOrigin('')
    setShalomOriginQuery('')
    loadShalomOrders()
  }

  const generarExcelShalom = () => {
    if (!shalomOrigin) { alert('Selecciona la agencia de origen primero'); return }
    const selected = shalomOrders.filter(o => selectedShalom.includes(o.id))
    if (selected.length === 0) { alert('Selecciona al menos un pedido'); return }

    const rows = selected.map(o => ({
      'DESTINATARIO (DOC)': o.customers?.dni || '',
      'TELF. DESTINATARIO': o.customers?.phone || '',
      'CONTACTO (DOC)': '',
      'TELF. CONTACTO': '',
      'NRO GRR': '',
      'ORIGEN': shalomOrigin,
      'DESTINO': o.destination || '',
      'MERCADERIA': 'PAQUETE XXS',
      'ALTO': 0.1,
      'ANCHO': 0.1,
      'LARGO': 0.1,
      'PESO': 1,
      'CANTIDAD': 1,
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Pedidos Shalom')
    XLSX.writeFile(wb, 'shalom-masivo-' + new Date().toISOString().split('T')[0] + '.xlsx')
  }

  const agregarAgencia = async () => {
    if (!newAgency.name.trim()) { alert('Ingresa el nombre de la agencia'); return }
    if (!storeId) return
    setSaving(true)
    try {
      const supabase = createClient()
      const destinations = newAgency.destinations
        ? newAgency.destinations.split(',').map(d => d.trim()).filter(d => d)
        : []
      const { data } = await supabase.from('delivery_agencies')
        .insert({ store_id: storeId, agency_name: newAgency.name.trim(), destinations, is_active: true })
        .select().single()
      if (data) { setAgencies(prev => [...prev, data]); setNewAgency({ name: '', destinations: '' }) }
    } catch (e) { alert('Error al guardar la agencia') }
    finally { setSaving(false) }
  }

  const toggleAgencia = async (agency: Agency) => {
    try {
      const supabase = createClient()
      await supabase.from('delivery_agencies').update({ is_active: !agency.is_active }).eq('id', agency.id)
      setAgencies(prev => prev.map(a => a.id === agency.id ? { ...a, is_active: !a.is_active } : a))
    } catch (e) { alert('Error al actualizar') }
  }

  const eliminarAgencia = async (id: string) => {
    if (!confirm('¿Eliminar esta agencia?')) return
    try {
      const supabase = createClient()
      await supabase.from('delivery_agencies').delete().eq('id', id)
      setAgencies(prev => prev.filter(a => a.id !== id))
    } catch (e) { alert('Error al eliminar') }
  }

  const toggleOrderSelect = (id: string) => {
    setSelectedOrders(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const generarEtiquetas = () => {
    const selected = orders.filter(o => selectedOrders.includes(o.id))
    if (selected.length === 0) { alert('Selecciona al menos un pedido'); return }

    const doc = new jsPDF()
    const cols = 2
    const rows = 4
    const perPage = cols * rows
    const labelW = 90
    const labelH = 68
    const marginX = 10
    const marginY = 5
    const gapX = 10
    const gapY = 4

    selected.forEach((order, index) => {
      if (index > 0 && index % perPage === 0) doc.addPage()
      const pos = index % perPage
      const col = pos % cols
      const row = Math.floor(pos / cols)
      const x = marginX + col * (labelW + gapX)
      const y = marginY + row * (labelH + gapY)

      doc.setDrawColor(180, 180, 180)
      doc.setLineWidth(0.3)
      doc.rect(x, y, labelW, labelH)

      // Código de pedido
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text(order.order_code, x + 4, y + 8)

      // Datos del cliente
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'normal')
      doc.text('Cliente: ' + (order.customers?.name || '-'), x + 4, y + 15)
      doc.text('Cel: ' + (order.customers?.phone || '-') + '   DNI: ' + (order.customers?.dni || '-'), x + 4, y + 21)

      // Destino
      const dest = order.destination ? order.destination.substring(0, 42) : '-'
      const destLines = doc.splitTextToSize('Destino: ' + dest, labelW - 8)
      doc.text(destLines.slice(0, 2), x + 4, y + 27)

      // Línea separadora
      doc.setDrawColor(220, 220, 220)
      doc.line(x + 4, y + 34, x + labelW - 4, y + 34)

      // Productos
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.text('Productos:', x + 4, y + 39)
      doc.setFont('helvetica', 'normal')

      const items = order.order_items || []
      let itemY = y + 44
      const maxItems = 3

      if (items.length === 0) {
        doc.text('Sin productos registrados', x + 4, itemY)
      } else {
        items.slice(0, maxItems).forEach((item, i) => {
          const colorStr = item.color && item.color !== 'Único' ? ` ${item.color}` : ''
          const line = `• ${item.product_name}${colorStr} x${item.quantity}`
          const truncated = line.length > 38 ? line.substring(0, 36) + '...' : line
          doc.text(truncated, x + 4, itemY + i * 5)
        })
        if (items.length > maxItems) {
          doc.text(`  + ${items.length - maxItems} producto(s) más`, x + 4, itemY + maxItems * 5)
        }
      }

      // Por cobrar
      // Método de entrega
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      const deliveryText = order.delivery_method === 'motorizado'
        ? '🛵 Motorizado'
        : '📦 ' + (order.agency_name || 'Agencia')
      doc.text(deliveryText, x + 4, y + 57)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Por cobrar: S/ ' + Number(order.pending_amount).toFixed(2), x + 4, y + 64)
    })

    doc.save('etiquetas.pdf')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-500">Cargando...</p>
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Herramientas</h1>
        <p className="text-gray-500 mt-1">Agencias de delivery y etiquetas PDF</p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => setTab('agencias')}
          className={'px-4 py-2 rounded-xl text-sm font-medium ' + (tab === 'agencias' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600')}>
          🚚 Agencias
        </button>
        <button onClick={() => setTab('etiquetas')}
          className={'px-4 py-2 rounded-xl text-sm font-medium ' + (tab === 'etiquetas' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600')}>
          🏷️ Etiquetas PDF
        </button>
        {hasShalomAgency && (
          <button onClick={openShalomPro}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-orange-500 text-white">
            📦 Formato Shalom Pro
          </button>
        )}
      </div>

      {/* MODAL SHALOM PRO */}
      {showShalomPro && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-screen flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
              <div>
                <h2 className="font-bold text-gray-900">📦 Formato Shalom Pro</h2>
                <p className="text-xs text-gray-500 mt-0.5">Genera el Excel de carga masiva</p>
              </div>
              <button onClick={() => setShowShalomPro(false)} className="text-gray-400 text-2xl font-bold">×</button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              {/* Agencia de origen */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">1. Selecciona la agencia de origen</label>
                <p className="text-xs text-gray-400 mb-2">Esta será la sucursal Shalom desde donde salen los paquetes</p>
                <div className="relative">
                  <input
                    type="text"
                    value={shalomOriginQuery}
                    onChange={e => {
                      setShalomOriginQuery(e.target.value)
                      setShalomOrigin('')
                      const q = e.target.value.toLowerCase()
                      if (q.length >= 2) {
                        setShalomOriginSuggestions(
                          SHALOM_ORIGINS.filter(o => o.toLowerCase().includes(q)).slice(0, 6)
                        )
                      } else {
                        setShalomOriginSuggestions([])
                      }
                    }}
                    placeholder="Escribe para buscar... ej: Lima, Trujillo"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  {shalomOriginSuggestions.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
                      {shalomOriginSuggestions.map((o, i) => (
                        <button key={i} type="button"
                          onClick={() => { setShalomOrigin(o); setShalomOriginQuery(o); setShalomOriginSuggestions([]) }}
                          className="w-full text-left px-3 py-2.5 text-xs text-gray-700 hover:bg-orange-50 border-b border-gray-50 last:border-0">
                          📍 {o}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {shalomOrigin && (
                  <p className="text-xs text-green-600 mt-1.5 font-medium">✅ Origen: {shalomOrigin}</p>
                )}
              </div>

              {/* Pedidos pendientes de Shalom */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">2. Selecciona los pedidos a exportar</label>
                {loadingShalom ? (
                  <div className="text-center py-6"><div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto" /></div>
                ) : shalomOrders.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-2xl mb-2">📦</p>
                    <p className="text-gray-500 text-sm">No hay pedidos pendientes con Shalom</p>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2 mb-2">
                      <button onClick={() => setSelectedShalom(shalomOrders.map(o => o.id))}
                        className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600">Seleccionar todos</button>
                      <button onClick={() => setSelectedShalom([])}
                        className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600">Limpiar</button>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {shalomOrders.map(order => (
                        <div key={order.id} onClick={() => setSelectedShalom(prev =>
                            prev.includes(order.id) ? prev.filter(x => x !== order.id) : [...prev, order.id]
                          )}
                          className={'flex items-center justify-between p-3 rounded-xl border cursor-pointer ' +
                            (selectedShalom.includes(order.id) ? 'border-orange-400 bg-orange-50' : 'border-gray-100 hover:border-gray-300')}>
                          <div className="flex-1 min-w-0">
                            <p className="font-mono font-bold text-sm text-gray-900">{order.order_code}</p>
                            <p className="text-xs text-gray-600">{order.customers?.name || '-'} · {order.customers?.phone || '-'}</p>
                            <p className="text-xs text-gray-400 truncate">{order.destination || 'Sin destino'}</p>
                          </div>
                          <div className={'w-5 h-5 rounded-full border-2 flex-shrink-0 ml-3 ' +
                            (selectedShalom.includes(order.id) ? 'bg-orange-500 border-orange-500' : 'border-gray-300')} />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={generarExcelShalom} disabled={!shalomOrigin || selectedShalom.length === 0}
                className="w-full py-3 bg-orange-500 text-white rounded-xl text-sm font-bold disabled:opacity-40">
                📥 Generar Excel ({selectedShalom.length} pedidos)
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'agencias' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Agregar agencia</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la agencia *</label>
                <input type="text" value={newAgency.name} onChange={e => setNewAgency(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Shalom, Olva, Flores" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Destinos predefinidos <span className="text-gray-400">(opcional, separados por coma)</span>
                </label>
                <input type="text" value={newAgency.destinations} onChange={e => setNewAgency(prev => ({ ...prev, destinations: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Moquegua, Arequipa, Tacna" />
                <p className="text-xs text-gray-400 mt-1">Si lo dejas vacío, el cliente podrá escribir el destino libremente</p>
              </div>
              <button onClick={agregarAgencia} disabled={saving}
                className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                {saving ? 'Guardando...' : '+ Agregar agencia'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Agencias configuradas ({agencies.length})</h2>
            {agencies.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-3xl mb-2">🚚</p>
                <p className="text-gray-500 text-sm">No hay agencias configuradas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {agencies.map(agency => (
                  <div key={agency.id} className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{agency.agency_name}</p>
                        <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + (agency.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                          {agency.is_active ? 'Activa' : 'Inactiva'}
                        </span>
                      </div>
                      {agency.destinations?.length > 0
                        ? <p className="text-xs text-gray-500 mt-1">Destinos: {agency.destinations.join(', ')}</p>
                        : <p className="text-xs text-gray-400 mt-1">Destino libre</p>
                      }
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleAgencia(agency)}
                        className={'px-3 py-1.5 rounded-lg text-xs font-medium border ' + (agency.is_active ? 'border-gray-200 text-gray-600' : 'border-green-200 text-green-700')}>
                        {agency.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                      <button onClick={() => eliminarAgencia(agency.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'etiquetas' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">Generar etiquetas</h2>
                <p className="text-xs text-gray-500 mt-0.5">8 etiquetas por hoja A4 — incluye productos del pedido</p>
              </div>
              {selectedOrders.length > 0 && (
                <button onClick={generarEtiquetas}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold">
                  📄 Generar PDF ({selectedOrders.length})
                </button>
              )}
            </div>

            <div className="flex gap-2 mb-3">
              <button onClick={() => setSelectedOrders(orders.map(o => o.id))}
                className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600">
                Seleccionar todos
              </button>
              <button onClick={() => setSelectedOrders([])}
                className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600">
                Limpiar
              </button>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-3xl mb-2">📦</p>
                <p className="text-gray-500 text-sm">No hay pedidos activos</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 sm:max-h-96 overflow-y-auto">
                {orders.map(order => (
                  <div key={order.id} onClick={() => toggleOrderSelect(order.id)}
                    className={'flex items-center justify-between p-3 rounded-xl border cursor-pointer ' + (selectedOrders.includes(order.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-300')}>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono font-bold text-sm text-gray-900">{order.order_code}</p>
                      <p className="text-xs text-gray-600">{order.customers?.name || '-'}</p>
                      {order.order_items && order.order_items.length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {order.order_items.slice(0, 2).map(i => `${i.product_name} x${i.quantity}`).join(', ')}
                          {order.order_items.length > 2 ? ` +${order.order_items.length - 2} más` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <p className="text-sm font-bold text-orange-600">S/ {Number(order.pending_amount).toFixed(2)}</p>
                      <div className={'w-5 h-5 rounded-full border-2 ' + (selectedOrders.includes(order.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300')} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}