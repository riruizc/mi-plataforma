/**
 * Destinos de agencia con detalle (departamento, provincia, distrito, sede,
 * dirección, referencia y si acepta envío aéreo).
 *
 * Este módulo es la única fuente de verdad del formato del destino. Lo usan
 * tres sitios que DEBEN coincidir exactamente:
 *   · el buscador del formulario público (app/order/[prefix]/page.tsx)
 *   · la validación del servidor        (app/api/orders/route.ts)
 *   · el importador CSV                 (app/store/tools/page.tsx)
 *
 * Si el texto canónico se generara distinto en alguno de ellos, el servidor
 * rechazaría destinos que el cliente sí puede elegir.
 */

export type DestinoDetalle = {
  departamento: string
  provincia: string
  distrito: string
  sede: string
  direccion: string
  /** Opcional: si la agencia no la da, queda como cadena vacía. */
  referencia: string
  /** ¿Esta sede acepta envío aéreo? */
  aereo: boolean
  /** false = la sede dejó de operar. No se borra, para no romper el historial. */
  activo: boolean
}

/** Sufijo que marca un envío aéreo dentro del texto del destino. */
export const SUFIJO_AEREO = ' - AEREO'

/**
 * Texto canónico que se guarda en `orders.destination`.
 *
 * Mantiene EXACTAMENTE el formato que ya usaban los pedidos anteriores:
 *
 *     DEPARTAMENTO / PROVINCIA / DISTRITO / SEDE
 *     DEPARTAMENTO / PROVINCIA / DISTRITO / SEDE - AEREO
 *
 * De ahí dependen las etiquetas PDF y el Excel de Shalom Pro, que extrae la
 * sede con `destination.split('/').pop()`. No cambiar sin revisar ambos.
 */
export function textoDestino(d: DestinoDetalle, aereo = false): string {
  const base = `${d.departamento} / ${d.provincia} / ${d.distrito} / ${d.sede}`
  return aereo ? base + SUFIJO_AEREO : base
}

/**
 * Clave única de una sede. Dos agencias pueden tener sedes con el mismo
 * nombre en distritos distintos, así que la identidad es la combinación
 * completa, no solo `sede`.
 */
export function claveDestino(d: Pick<DestinoDetalle, 'departamento' | 'provincia' | 'distrito' | 'sede'>): string {
  return [d.departamento, d.provincia, d.distrito, d.sede]
    .map(v => (v || '').trim().toUpperCase())
    .join('|')
}

/**
 * Todos los textos de destino que un cliente puede enviar para una agencia.
 *
 * Incluye la variante aérea solo cuando la agencia ofrece aéreo Y la sede en
 * concreto lo acepta. Es la lista contra la que valida el servidor.
 */
export function destinosPermitidos(
  detalle: DestinoDetalle[] | null | undefined,
  offersAir: boolean
): Set<string> {
  const permitidos = new Set<string>()
  for (const d of detalle || []) {
    if (!d?.activo) continue
    permitidos.add(textoDestino(d, false))
    if (offersAir && d.aereo) permitidos.add(textoDestino(d, true))
  }
  return permitidos
}

/**
 * Normaliza texto para buscar sin tildes ni mayúsculas: así «ancash»
 * encuentra «ÁNCASH» y «jose» encuentra «JOSÉ».
 */
function normalizar(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    // Marcas diacríticas combinantes (U+0300–U+036F): lo que NFD separa de
    // la letra base. Escapes explícitos para no depender de la codificación
    // con la que se guarde este archivo.
    .replace(/[̀-ͯ]/g, '')
}

/**
 * Filtra destinos por cualquiera de sus campos: departamento, provincia,
 * distrito, sede, dirección o referencia.
 *
 * Todas las palabras de la consulta deben aparecer en algún campo, así
 * «villa salvador» encuentra «VILLA EL SALVADOR» aunque falte «el».
 */
export function buscarDestinos(
  detalle: DestinoDetalle[] | null | undefined,
  consulta: string,
  limite = 30
): DestinoDetalle[] {
  const activos = (detalle || []).filter(d => d?.activo)
  const q = normalizar(consulta).trim()
  if (!q) return activos.slice(0, limite)

  const palabras = q.split(/\s+/).filter(Boolean)
  const resultados = activos.filter(d => {
    const campos = normalizar(
      [d.departamento, d.provincia, d.distrito, d.sede, d.direccion, d.referencia]
        .filter(Boolean).join(' ')
    )
    return palabras.every(p => campos.includes(p))
  })

  return resultados.slice(0, limite)
}

/**
 * Convierte una fila del CSV en un destino, tolerando las variaciones
 * habituales de encabezado (con o sin tilde, mayúsculas, espacios).
 *
 * @returns El destino, o `null` si la fila no tiene los campos mínimos.
 */
export function filaCsvADestino(fila: Record<string, unknown>): DestinoDetalle | null {
  // Se indexa el encabezado normalizado para no depender de tildes ni
  // mayúsculas: «Dirección», «DIRECCION» y «direccion» son la misma columna.
  const idx: Record<string, string> = {}
  for (const clave of Object.keys(fila)) {
    idx[normalizar(clave).replace(/\s+/g, '')] = clave
  }
  const leer = (...nombres: string[]): string => {
    for (const n of nombres) {
      const real = idx[n]
      if (real !== undefined && fila[real] != null) return String(fila[real]).trim()
    }
    return ''
  }

  const departamento = leer('departamento', 'depto', 'dpto').toUpperCase()
  const provincia = leer('provincia', 'prov').toUpperCase()
  const distrito = leer('distrito', 'dist').toUpperCase()
  const sede = leer('sede', 'agencia', 'local', 'oficina').toUpperCase()

  // Sin estos cuatro no se puede construir el texto del destino.
  if (!departamento || !provincia || !distrito || !sede) return null

  const aereoRaw = normalizar(leer('aereo', 'aéreo', 'air'))
  const aereo = ['si', 'sí', 'yes', 'true', '1', 'x'].includes(aereoRaw)

  return {
    departamento,
    provincia,
    distrito,
    sede,
    direccion: leer('direccion', 'dirección', 'address'),
    referencia: leer('referencia', 'ref'),
    aereo,
    activo: true,
  }
}

export type DiffDestinos = {
  nuevos: DestinoDetalle[]
  /** Siguen en el CSV: se conservan (y se refrescan dirección/referencia/aéreo). */
  iguales: DestinoDetalle[]
  /** Ya no están en el CSV: se marcan activo=false, no se borran. */
  retirados: DestinoDetalle[]
  /** Resultado final a guardar en destinations_detail. */
  resultado: DestinoDetalle[]
}

/**
 * Compara los destinos actuales con los del CSV.
 *
 * Los que desaparecen NO se eliminan: se desactivan, para que un pedido
 * antiguo hecho a esa sede siga teniendo sentido.
 */
export function compararDestinos(
  actuales: DestinoDetalle[] | null | undefined,
  entrantes: DestinoDetalle[]
): DiffDestinos {
  const mapaActuales = new Map((actuales || []).map(d => [claveDestino(d), d]))
  const mapaEntrantes = new Map(entrantes.map(d => [claveDestino(d), d]))

  const nuevos: DestinoDetalle[] = []
  const iguales: DestinoDetalle[] = []
  const resultado: DestinoDetalle[] = []

  // Todo lo que viene en el CSV queda activo, con sus datos actualizados.
  for (const [clave, entrante] of mapaEntrantes) {
    const previo = mapaActuales.get(clave)
    if (previo) iguales.push(entrante)
    else nuevos.push(entrante)
    resultado.push({ ...entrante, activo: true })
  }

  // Lo que estaba y ya no viene se conserva desactivado.
  const retirados: DestinoDetalle[] = []
  for (const [clave, previo] of mapaActuales) {
    if (mapaEntrantes.has(clave)) continue
    // Si ya estaba desactivado no se reporta como novedad, pero se conserva.
    if (previo.activo) retirados.push(previo)
    resultado.push({ ...previo, activo: false })
  }

  return { nuevos, iguales, retirados, resultado }
}

/**
 * Regenera la columna `destinations` (text[]) a partir del detalle activo.
 *
 * Se mantiene por compatibilidad: todo lo que hoy lee `destinations` sigue
 * funcionando sin enterarse de que existe el detalle.
 */
export function destinosPlanos(detalle: DestinoDetalle[], offersAir: boolean): string[] {
  const salida: string[] = []
  for (const d of detalle) {
    if (!d.activo) continue
    salida.push(textoDestino(d, false))
    if (offersAir && d.aereo) salida.push(textoDestino(d, true))
  }
  return salida
}
