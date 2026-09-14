import { createClient } from '@/lib/supabase'

/**
 * Resolución de "la tienda del usuario logueado", en un solo lugar.
 *
 * Antes esto estaba copiado en 16 páginas, y con dos criterios distintos:
 * unas comparaban `.eq('email', user.email)` en crudo y otras
 * `.eq('email', user.email.toLowerCase())`. Si `stores.email` tenía alguna
 * mayúscula, unas páginas cargaban y otras se quedaban en blanco para
 * siempre (varias hacían `if (!store) return` sin apagar el spinner).
 *
 * Aquí se compara con ILIKE en vez de `eq(lower(...))` a propósito: ILIKE es
 * insensible a mayúsculas en AMBOS lados, así que funciona tal como está la
 * base hoy, sin depender de haber corrido antes el UPDATE de normalización
 * de `sql/01-indices-integridad.sql`. Eso permite desplegar este cambio solo.
 */

/**
 * Escapa los comodines de LIKE/ILIKE.
 *
 * Sin esto, un email con guion bajo — `juan_perez@x.com`, que es perfectamente
 * válido — se convertiría en un patrón donde `_` matchea cualquier carácter,
 * y podría resolver a la tienda equivocada.
 */
function escapeLikePattern(value: string): string {
  return value.replace(/([\\%_])/g, '\\$1')
}

export type CurrentStore<T> = { store: T | null; error: string | null }

/**
 * Devuelve la tienda del usuario autenticado.
 *
 * @param columns Columnas a traer, en sintaxis de PostgREST. Pide solo lo que
 *                necesites: varias páginas hacían `select('*')` y arrastraban
 *                el esquema entero en cada carga.
 *
 * @example
 *   const { store, error } = await getCurrentStore<{ id: string; name: string }>('id, name')
 *   if (!store) { setError(error); setLoading(false); return }
 */
export async function getCurrentStore<T = any>(
  columns: string = 'id'
): Promise<CurrentStore<T>> {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) {
    console.error('[store] getUser:', authError)
    return { store: null, error: 'No se pudo verificar tu sesión' }
  }
  if (!user?.email) {
    return { store: null, error: 'Sin sesión activa' }
  }

  const { data, error } = await supabase
    .from('stores')
    .select(columns)
    .ilike('email', escapeLikePattern(user.email.trim()))
    .maybeSingle()

  if (error) {
    console.error('[store] lookup:', error)
    return { store: null, error: error.message }
  }
  if (!data) {
    return { store: null, error: 'No se encontró tu tienda' }
  }
  return { store: data as T, error: null }
}
