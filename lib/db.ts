/**
 * Helpers para que las escrituras a Supabase dejen de fallar en silencio.
 *
 * supabase-js NO lanza excepciones: devuelve `{ data, error }`. Por eso el
 * patrón `try { await supabase.from(X).update(...) } catch { alert(...) }`
 * nunca muestra nada cuando la RLS rechaza la escritura o hay un constraint:
 * el catch no se dispara y el usuario ve "Guardado correctamente".
 */

export type DbError = { message: string; code?: string }
export type DbResponse<T> = { data: T | null; error: DbError | null }

/**
 * Ejecuta una operación de Supabase y avisa al usuario si falló.
 *
 * @param op  La query de Supabase (thenable).
 * @param ctx Qué se estaba intentando hacer, en infinitivo y en español.
 *            Se usa para el mensaje: "No se pudo {ctx}: ...".
 * @returns   Los datos, o `null` si hubo error (ya avisado al usuario).
 *
 * @example
 *   const ok = await must(
 *     supabase.from('stores').update({ name }).eq('id', id).select('id').maybeSingle(),
 *     'guardar los ajustes'
 *   )
 *   if (!ok) return   // no sigas como si hubiera funcionado
 */
export async function must<T>(
  op: PromiseLike<DbResponse<T>>,
  ctx: string
): Promise<T | null> {
  const { data, error } = await op
  if (error) {
    console.error(`[db] ${ctx}:`, error)
    alert(`No se pudo ${ctx}: ${error.message}`)
    return null
  }
  return data
}

/**
 * Igual que `must`, pero además trata "0 filas afectadas" como error.
 *
 * Es lo que hace falta en los UPDATE/DELETE: una escritura bloqueada por RLS
 * devuelve `error: null` con 0 filas. Sin `.select().maybeSingle()` encima,
 * es indistinguible del éxito.
 */
export async function mustAffect<T>(
  op: PromiseLike<DbResponse<T>>,
  ctx: string
): Promise<T | null> {
  const { data, error } = await op
  if (error) {
    console.error(`[db] ${ctx}:`, error)
    alert(`No se pudo ${ctx}: ${error.message}`)
    return null
  }
  if (data === null || (Array.isArray(data) && data.length === 0)) {
    console.error(`[db] ${ctx}: 0 filas afectadas`)
    alert(`No se pudo ${ctx}: no se encontró el registro o no tienes permiso.`)
    return null
  }
  return data
}

/** Código de Postgres para violación de constraint UNIQUE. */
export const PG_UNIQUE_VIOLATION = '23505'

/** Código de Postgres para violación de llave foránea. */
export const PG_FOREIGN_KEY_VIOLATION = '23503'
