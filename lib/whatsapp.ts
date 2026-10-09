/**
 * Construcción del mensaje de WhatsApp que el cliente envía a la tienda
 * al registrar su pedido.
 *
 * El objetivo es que el pedido llegue al mismo chat donde el cliente ya venía
 * conversando, escrito desde SU número, para que la tienda lo tenga en su
 * historial sin tener que copiarlo del panel.
 *
 * El mensaje NO lleva precios ni total: el precio válido es el que la tienda
 * maneja en el live, y mostrarlo aquí solo generaría discusiones.
 */

/** Cantidad máxima de líneas de producto antes de resumir el resto. */
export const MAX_ITEMS_EN_MENSAJE = 40

export type MensajePedidoInput = {
  orderCode: string
  customer: { name: string; dni?: string; phone: string }
  cart: { product_name: string; color: string; quantity: number }[]
  comboCart: { combo_name: string; quantity: number }[]
  delivery: {
    method: string
    destination: string
    reference?: string
    lat?: string
    lng?: string
    agency_name?: string
  }
}

/**
 * Normaliza un número peruano al formato que espera wa.me (sin «+»).
 *
 * Acepta lo que el dueño haya escrito en Ajustes: «987 654 321»,
 * «+51 987-654-321», «(51) 987654321»… y devuelve «51987654321».
 *
 * @returns El número listo para wa.me, o `null` si no es un celular peruano
 *          reconocible (en ese caso no se debe ofrecer el botón de WhatsApp).
 */
export function normalizePeruPhone(raw: string | null | undefined): string | null {
  if (!raw) return null

  // Fuera todo lo que no sea dígito: espacios, guiones, paréntesis, «+».
  const digits = String(raw).replace(/\D/g, '')

  // 9 dígitos empezando en 9 → celular peruano sin prefijo de país.
  if (digits.length === 9 && digits.startsWith('9')) return '51' + digits

  // 11 dígitos empezando en 519 → ya viene con el prefijo.
  if (digits.length === 11 && digits.startsWith('519')) return digits

  // Algunos lo guardan con el 0 de larga distancia: 0051...
  if (digits.length === 13 && digits.startsWith('0051')) return digits.slice(2)

  return null
}

/**
 * Valida que un número sea un celular peruano: 9 dígitos que empiezan con 9.
 * Se usa en el formulario, sobre lo que escribe el cliente.
 */
export function isValidPeruMobile(phone: string): boolean {
  return /^9\d{8}$/.test(phone)
}

/**
 * Formatea una coordenada con 6 decimales.
 *
 * Seis decimales equivalen a ~11 cm de precisión. Con cuatro serían ~11 m,
 * suficiente para errar de casa o de puerta en una calle estrecha, que es
 * justo lo que el motorizado necesita evitar.
 */
function formatCoord(value: string | number): string | null {
  const n = typeof value === 'number' ? value : parseFloat(value)
  if (!Number.isFinite(n)) return null
  return n.toFixed(6)
}

/**
 * Arma el texto del mensaje con saltos de línea REALES.
 *
 * No se codifica aquí: la codificación se hace una sola vez en
 * `buildWhatsAppUrl`. Concatenar «%0A» a mano y no codificar el resto es
 * exactamente el error que rompía los comprobantes cuando una dirección
 * traía «&» o «#».
 */
export function buildOrderMessage(input: MensajePedidoInput): string {
  const { orderCode, customer, cart, comboCart, delivery } = input
  const lineas: string[] = []

  lineas.push(`🛒 Nuevo pedido ${orderCode}`)

  // El DNI es opcional: si no lo puso, no se deja el « · DNI » colgando.
  const dni = customer.dni?.trim()
  lineas.push(dni ? `👤 ${customer.name} · DNI ${dni}` : `👤 ${customer.name}`)
  lineas.push(`📱 ${customer.phone}`)

  // ── Productos y combos ──────────────────────────────────────────────────
  const itemsProductos = cart.map(item => {
    // «Único» es el color interno de los productos sin variante; mostrarlo
    // solo añade ruido para el cliente.
    const color = item.color && item.color !== 'Único' ? ` (${item.color})` : ''
    return `📦 ${item.product_name}${color} × ${item.quantity}`
  })
  const itemsCombos = comboCart.map(c => `🎁 ${c.combo_name} × ${c.quantity}`)
  const todos = [...itemsProductos, ...itemsCombos]

  // Un carrito enorme produciría una URL que algunos navegadores truncan.
  if (todos.length > MAX_ITEMS_EN_MENSAJE) {
    const restantes = todos.length - MAX_ITEMS_EN_MENSAJE
    lineas.push(...todos.slice(0, MAX_ITEMS_EN_MENSAJE))
    lineas.push(`…y ${restantes} producto${restantes !== 1 ? 's' : ''} más`)
  } else {
    lineas.push(...todos)
  }

  // ── Entrega ─────────────────────────────────────────────────────────────
  if (delivery.method === 'motorizado') {
    lineas.push('🛵 Motorizado')
    if (delivery.destination) lineas.push(`📍 ${delivery.destination}`)
    const ref = delivery.reference?.trim()
    if (ref) lineas.push(`📝 Ref: ${ref}`)

    const lat = delivery.lat ? formatCoord(delivery.lat) : null
    const lng = delivery.lng ? formatCoord(delivery.lng) : null
    if (lat && lng) {
      lineas.push(`🗺️ Ubicación: https://www.google.com/maps?q=${lat},${lng}`)
    } else {
      lineas.push('⚠️ No marcó su ubicación en el mapa')
    }
  } else {
    if (delivery.agency_name) lineas.push(`🚚 Agencia: ${delivery.agency_name}`)
    if (delivery.destination) lineas.push(`📍 Destino: ${delivery.destination}`)
  }

  return lineas.join('\n')
}

/**
 * Enlace wa.me definitivo.
 *
 * @returns `null` si la tienda no tiene un número utilizable, para que la UI
 *          sepa que no debe ofrecer el botón.
 */
export function buildWhatsAppUrl(storePhone: string | null | undefined, mensaje: string): string | null {
  const destino = normalizePeruPhone(storePhone)
  if (!destino) return null
  // Una sola codificación, sobre el mensaje completo.
  return `https://wa.me/${destino}?text=${encodeURIComponent(mensaje)}`
}
