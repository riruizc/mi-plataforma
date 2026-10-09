-- ============================================================================
--  DESTINOS DE AGENCIA DETALLADOS
--  pedidospe.com · 2026-10-09
-- ============================================================================
--
--  QUÉ HACE
--  Permite que cada destino de agencia guarde su detalle completo
--  (departamento, provincia, distrito, sede, dirección, referencia y si
--  acepta envío aéreo), en vez de ser solo una cadena de texto.
--
--  QUÉ **NO** HACE — importante:
--    · NO borra ninguna columna.
--    · NO modifica ningún dato existente.
--    · NO toca la columna `destinations` actual, que se conserva y se sigue
--      regenerando desde el detalle para que todo lo que hoy la lee (el
--      formulario público, las etiquetas, el Excel de Shalom Pro) siga
--      funcionando sin cambios.
--
--  Solo añade dos columnas con valor por defecto, así que es seguro
--  ejecutarlo con la plataforma en producción: las filas existentes quedan
--  con `destinations_detail = []` y `offers_air = false`, que es exactamente
--  el comportamiento de hoy.
--
--  CÓMO USARLO
--  Ejecutar este archivo completo en el SQL Editor de Supabase. Después,
--  cargar los destinos desde Herramientas → Agencias → «Actualizar destinos»
--  con el CSV de cada agencia.
--
-- ============================================================================


-- ---------------------------------------------------------------------------
--  1. Detalle de cada destino
-- ---------------------------------------------------------------------------
--  Array de objetos. Cada entrada representa UNA sede:
--
--    {
--      "departamento": "LIMA",
--      "provincia":    "LIMA",
--      "distrito":     "LA VICTORIA",
--      "sede":         "JR. RAYMONDI",
--      "direccion":    "Jr. Raymondi 123",
--      "referencia":   "Frente al mercado",   // opcional, puede ser ""
--      "aereo":        true,                  // ¿acepta envío aéreo?
--      "activo":       true                   // false = ya no opera
--    }
--
--  La clave única de un destino es la combinación
--  departamento|provincia|distrito|sede. El texto que se guarda en
--  `orders.destination` se arma con el MISMO formato de siempre:
--
--      DEPARTAMENTO / PROVINCIA / DISTRITO / SEDE
--      DEPARTAMENTO / PROVINCIA / DISTRITO / SEDE - AEREO   (si es aéreo)
--
--  Las sedes que dejan de operar se marcan `activo: false`, NO se eliminan:
--  así los pedidos antiguos conservan su referencia y el historial no se
--  rompe.
ALTER TABLE delivery_agencies
  ADD COLUMN IF NOT EXISTS destinations_detail jsonb NOT NULL DEFAULT '[]'::jsonb;


-- ---------------------------------------------------------------------------
--  2. ¿La agencia ofrece envío aéreo?
-- ---------------------------------------------------------------------------
--  Interruptor por agencia. Si está en false, el cliente nunca ve la opción
--  aunque alguna sede la acepte. Si está en true, se le ofrece elegir
--  Terrestre o Aéreo SOLO en las sedes marcadas con "aereo": true.
--
--  Por defecto false: ninguna agencia cambia de comportamiento al aplicar
--  esta migración.
ALTER TABLE delivery_agencies
  ADD COLUMN IF NOT EXISTS offers_air boolean NOT NULL DEFAULT false;


-- ---------------------------------------------------------------------------
--  3. Índice para la búsqueda dentro del JSON
-- ---------------------------------------------------------------------------
--  Con ~500 sedes por agencia el filtrado se hace en el navegador, así que
--  este índice no es imprescindible hoy. Se deja preparado por si más
--  adelante se consulta el detalle desde SQL.
CREATE INDEX IF NOT EXISTS delivery_agencies_dest_detail_gin
  ON delivery_agencies USING gin (destinations_detail);


-- ============================================================================
--  VERIFICACIÓN
--  Ejecutar después de aplicar. Debe mostrar las dos columnas nuevas.
-- ============================================================================

SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'delivery_agencies'
  AND column_name IN ('destinations', 'destinations_detail', 'offers_air')
ORDER BY column_name;

-- Estado actual de cada agencia (antes de importar nada, detalle = 0)
SELECT
  id,
  agency_name,
  is_active,
  offers_air,
  -- `destinations` es jsonb (un array JSON de textos), NO text[]: por eso se
  -- cuenta con jsonb_array_length y no con array_length.
  COALESCE(jsonb_array_length(destinations), 0) AS destinos_texto_actuales,
  jsonb_array_length(destinations_detail)       AS destinos_con_detalle
FROM delivery_agencies
ORDER BY agency_name;


-- ============================================================================
--  REVERTIR (si hiciera falta)
--  Quita solo lo que este archivo añadió. No afecta a `destinations` ni a
--  ningún dato previo.
-- ============================================================================
/*
DROP INDEX IF EXISTS delivery_agencies_dest_detail_gin;
ALTER TABLE delivery_agencies DROP COLUMN IF EXISTS destinations_detail;
ALTER TABLE delivery_agencies DROP COLUMN IF EXISTS offers_air;
*/
