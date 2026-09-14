-- ============================================================================
--  BLOQUE 1 — ÍNDICES ÚNICOS DE INTEGRIDAD
--  pedidospe.com · auditoría 2026-09-09
-- ============================================================================
--
--  QUÉ HACE ESTE ARCHIVO
--  Cierra a nivel de base de datos cuatro clases de bug que hoy solo están
--  "prevenidas" por código de aplicación (y que el código no previene bien).
--  Un índice único no se puede eludir por una race condition, ni por un doble
--  clic, ni por una pestaña duplicada, ni por un bug futuro.
--
--  CÓMO USARLO — NO EJECUTES EL ARCHIVO COMPLETO DE UNA VEZ.
--  Está dividido en 3 fases. Corre la FASE 1 entera, lee los resultados, y
--  solo entonces decide qué partes de la FASE 2 necesitas. La FASE 3 va al
--  final y falla en voz alta si quedaron duplicados sin limpiar.
--
--    FASE 1 (líneas ~40-190)   Detección. Solo SELECTs. Es seguro correrla.
--    FASE 2 (líneas ~195-400)  Limpieza. TODO COMENTADO. Requiere criterio.
--    FASE 3 (líneas ~405-560)  Índices + función atómica. Ejecutar al final.
--
--  Todo lo destructivo está comentado con /* */ a propósito. Descoméntalo
--  solo después de leer los resultados de la fase 1 y entender qué borra.
--
--  ANTES DE EMPEZAR: haz un backup.
--    Supabase Dashboard → Database → Backups → Create backup
--  Los índices son reversibles (DROP INDEX), pero los scripts de limpieza
--  de la fase 2 borran y modifican filas. Eso no se deshace.
--
-- ============================================================================


-- ============================================================================
--  FASE 1 — DETECCIÓN
--  Solo lectura. Corre las 6 consultas y anota cuántas filas devuelve cada una.
--  Lo ideal es que TODAS devuelvan 0 filas: significa que puedes saltar
--  la fase 2 completa e ir directo a la fase 3.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1.1  Transacciones de ingreso DUPLICADAS por pedido
-- ---------------------------------------------------------------------------
-- QUÉ BUSCA: pedidos que generaron más de un ingreso en Finanzas.
--
-- CÓMO SE PRODUCE: `handleStatusChange` (app/store/orders/page.tsx:185) no
-- tiene guard anti-doble-clic. Dos cambios rápidos del <select> a "Entregado"
-- ven ambos `order.status !== 'delivered'` en el estado local de React (que
-- todavía no se refrescó) e insertan dos veces. También pasa en el ciclo
-- delivered → pending → delivered si el DELETE intermedio falla en silencio.
--
-- CÓMO LEER EL RESULTADO:
--   0 filas  → nunca ocurrió. Perfecto.
--   N filas  → tienes N pedidos contados dos o más veces en tus ingresos.
--              La columna `exceso_soles` es el dinero que Finanzas te está
--              mostrando de más POR CADA PEDIDO. Súmalo para saber el
--              descuadre total acumulado.

SELECT
  ft.order_id,
  o.order_code,
  s.name                                   AS tienda,
  count(*)                                 AS veces_registrado,
  sum(ft.amount)                           AS total_registrado,
  max(ft.amount)                           AS monto_correcto,
  sum(ft.amount) - max(ft.amount)          AS exceso_soles,
  min(ft.created_at)                       AS primera,
  max(ft.created_at)                       AS ultima
FROM finance_transactions ft
LEFT JOIN orders o ON o.id = ft.order_id
LEFT JOIN stores s ON s.id = ft.store_id
WHERE ft.source = 'order'
  AND ft.order_id IS NOT NULL
GROUP BY ft.order_id, o.order_code, s.name
HAVING count(*) > 1
ORDER BY exceso_soles DESC;


-- ---------------------------------------------------------------------------
-- 1.1b  Transacciones de tipo 'order' SIN order_id  (caso borde)
-- ---------------------------------------------------------------------------
-- El índice de la fase 3 usa (order_id) WHERE source = 'order'. En Postgres
-- los NULL no colisionan entre sí, así que estas filas NO serán bloqueadas
-- por el índice ni impedirán su creación. Pero son huérfanas: no se pueden
-- sincronizar cuando se edita el total del pedido (orders/page.tsx:432 filtra
-- por order_id), así que quedan congeladas con un monto viejo para siempre.
--
-- CÓMO LEER EL RESULTADO:
--   0 filas  → bien.
--   N filas  → revísalas a mano. Probablemente sean de una versión anterior
--              del código. No bloquean nada, pero ensucian tus reportes.

SELECT id, store_id, description, amount, created_at
FROM finance_transactions
WHERE source = 'order' AND order_id IS NULL
ORDER BY created_at DESC;


-- ---------------------------------------------------------------------------
-- 1.2  Códigos de pedido DUPLICADOS
-- ---------------------------------------------------------------------------
-- QUÉ BUSCA: dos o más pedidos con el mismo `order_code`.
--
-- CÓMO SE PRODUCE: dos caminos.
--   (a) `increment_order_counter` no es atómica (si está escrita como
--       SELECT + UPDATE en vez de UPDATE ... RETURNING). Dos pedidos
--       simultáneos obtienen el mismo número. Lo verificas en la consulta 1.6.
--   (b) Dos tiendas comparten `store_prefix` (consulta 1.3). Sus contadores
--       son independientes, así que generan códigos idénticos.
--
-- CÓMO LEER EL RESULTADO:
--   0 filas  → bien.
--   N filas  → `/track` está devolviendo el pedido EQUIVOCADO a esos clientes,
--              porque busca con .eq('order_code', ...).single() y hay más de
--              uno. Si `tiendas_distintas` > 1, la causa es (b) y tienes
--              además una fuga de datos entre tiendas: el cliente de una
--              tienda ve el pedido de otra.

SELECT
  o.order_code,
  count(*)                          AS veces,
  count(DISTINCT o.store_id)        AS tiendas_distintas,
  array_agg(o.id ORDER BY o.created_at)         AS ids,
  array_agg(o.created_at ORDER BY o.created_at) AS fechas,
  array_agg(DISTINCT s.name)        AS tiendas
FROM orders o
LEFT JOIN stores s ON s.id = o.store_id
GROUP BY o.order_code
HAVING count(*) > 1
ORDER BY veces DESC, o.order_code;


-- ---------------------------------------------------------------------------
-- 1.3  Prefijos de tienda DUPLICADOS
-- ---------------------------------------------------------------------------
-- QUÉ BUSCA: dos tiendas con el mismo `store_prefix` (ignorando mayúsculas).
--
-- CÓMO SE PRODUCE: `handleApprove` (app/admin/requests/page.tsx:23) deja al
-- admin escribir cualquier prefijo sin verificar que esté libre.
--
-- CÓMO LEER EL RESULTADO:
--   0 filas  → bien.
--   N filas  → esas tiendas están ROTAS AHORA MISMO, aunque no lo sepas.
--              Todas sus páginas públicas (/order, /catalog, /wholesale,
--              /contact) usan .eq('store_prefix', ...).single(), que lanza
--              PGRST116 cuando hay más de una fila. Los clientes ven
--              "Tienda no encontrada" y no pueden pedir nada.
--              Este es el caso más urgente de los cuatro: hay tiendas sin
--              poder vender.

SELECT
  upper(store_prefix)                       AS prefijo,
  count(*)                                  AS tiendas,
  array_agg(id      ORDER BY created_at)    AS ids,
  array_agg(name    ORDER BY created_at)    AS nombres,
  array_agg(email   ORDER BY created_at)    AS emails,
  array_agg(status  ORDER BY created_at)    AS estados,
  array_agg(created_at ORDER BY created_at) AS creadas
FROM stores
WHERE store_prefix IS NOT NULL AND btrim(store_prefix) <> ''
GROUP BY upper(store_prefix)
HAVING count(*) > 1
ORDER BY tiendas DESC;

-- Complemento: cuántos pedidos tiene cada tienda involucrada.
-- Es el dato que decide cuál conserva el prefijo (ver 2.3): la que ya tiene
-- pedidos e historial se queda; la que tiene menos se muda.
SELECT
  s.id, s.name, s.email, s.store_prefix, s.status,
  (SELECT count(*) FROM orders o WHERE o.store_id = s.id) AS pedidos
FROM stores s
WHERE upper(s.store_prefix) IN (
  SELECT upper(store_prefix) FROM stores
  WHERE store_prefix IS NOT NULL AND btrim(store_prefix) <> ''
  GROUP BY upper(store_prefix) HAVING count(*) > 1
)
ORDER BY upper(s.store_prefix), pedidos DESC;


-- ---------------------------------------------------------------------------
-- 1.4  Emails de tienda que difieren SOLO en mayúsculas
-- ---------------------------------------------------------------------------
-- QUÉ BUSCA: filas como 'Juan@X.com' y 'juan@x.com' que son la misma persona.
--
-- CÓMO LEER EL RESULTADO:
--   0 filas  → bien, puedes seguir.
--   N filas  → NO ejecutes el UPDATE de normalización (3.0) todavía. Primero
--              hay que decidir cuál fila sobrevive, y eso es una fusión de
--              datos (pedidos, productos, finanzas de dos tiendas). Ver 2.4.

SELECT
  lower(btrim(email))                       AS email_normalizado,
  count(*)                                  AS filas,
  array_agg(id     ORDER BY created_at)     AS ids,
  array_agg(email  ORDER BY created_at)     AS emails_tal_cual,
  array_agg(name   ORDER BY created_at)     AS nombres,
  array_agg(status ORDER BY created_at)     AS estados
FROM stores
WHERE email IS NOT NULL
GROUP BY lower(btrim(email))
HAVING count(*) > 1;


-- ---------------------------------------------------------------------------
-- 1.5  ⚠️  SEGURIDAD CRÍTICA DEL UPDATE DE EMAILS  ⚠️
-- ---------------------------------------------------------------------------
-- LEE ESTO ANTES DE NORMALIZAR NADA. Puede dejar tiendas sin acceso.
--
-- EL PROBLEMA: 14 lugares del código buscan la tienda con el email del usuario
-- SIN normalizar. Los más importantes:
--     proxy.ts:38 y :54          ← controla el acceso a TODO el panel
--     app/admin/layout.tsx:21    ← controla el acceso al panel de admin
--     app/store/layout.tsx:33, dashboard:21, orders:133, quotes:56,
--     customers:46, combos:33, finances:51, goals:35, suppliers:44,
--     summary:28, tools:537, wholesale:45
-- (Solo inventory, settings y routes aplican .toLowerCase().)
--
-- Esos sitios comparan contra `auth.users.email` tal cual viene. Entonces:
--
--   ESCENARIO A — auth.users tiene el email en minúsculas y stores en
--                 mayúsculas ('juan@x.com' vs 'Juan@X.com').
--                 → HOY esa tienda YA ESTÁ ROTA: proxy.ts no la encuentra y
--                   la manda a /pending en cada request. El UPDATE la ARREGLA.
--                   Normalizar es la solución, no el riesgo.
--
--   ESCENARIO B — ambos tienen mayúsculas y coinciden entre sí.
--                 → HOY funciona. Si normalizas solo `stores`, la comparación
--                   deja de coincidir y ESA TIENDA PIERDE EL ACCESO al panel
--                   de forma permanente. Aquí el UPDATE es el que rompe.
--
-- Esta consulta te dice en cuál escenario estás. Necesita permisos sobre el
-- esquema `auth`; córrela desde el SQL Editor del dashboard de Supabase.
--
-- CÓMO LEER EL RESULTADO:
--   0 filas                       → todos los emails ya coinciden. El UPDATE
--                                   es inofensivo (no cambiará nada o solo
--                                   quitará espacios). Puedes correr 3.0.
--   filas con diagnostico =
--     'A - ROTA HOY, el UPDATE la arregla'
--                                 → corre el UPDATE 3.0, mejora la situación.
--   filas con diagnostico =
--     'B - PELIGRO: el UPDATE la deja sin acceso'
--                                 → NO corras el UPDATE 3.0 solo.
--                                   Opción 1 (recomendada): aplica primero el
--                                   fix A3 del informe (normalizar los 14 call
--                                   sites en el código) y despliega. Después
--                                   el UPDATE es seguro.
--                                   Opción 2: normaliza también auth.users en
--                                   el mismo momento (ver 2.5).

SELECT
  s.id,
  s.email                      AS email_en_stores,
  u.email                      AS email_en_auth,
  CASE
    WHEN u.email IS NULL
      THEN 'Sin usuario de Auth — no puede loguearse igual'
    WHEN s.email = u.email
      THEN 'OK - coinciden exactamente'
    WHEN lower(btrim(s.email)) = lower(btrim(u.email)) AND u.email = lower(btrim(u.email))
      THEN 'A - ROTA HOY, el UPDATE la arregla'
    ELSE
      'B - PELIGRO: el UPDATE la deja sin acceso'
  END                          AS diagnostico
FROM stores s
LEFT JOIN auth.users u ON lower(btrim(u.email)) = lower(btrim(s.email))
WHERE s.email IS DISTINCT FROM lower(btrim(s.email))
ORDER BY diagnostico, s.email;


-- ---------------------------------------------------------------------------
-- 1.6  ¿Es atómica la función `increment_order_counter` actual?
-- ---------------------------------------------------------------------------
-- QUÉ BUSCAR EN EL RESULTADO (columna `codigo_fuente`):
--
--   SI CONTIENE  'UPDATE ... RETURNING'  y NADA de 'SELECT ... INTO' previo
--     → ya es atómica. La sección 3.5 igual la reemplaza por una versión
--       equivalente y documentada; es un no-op funcional, no hace daño.
--
--   SI CONTIENE  'SELECT ... INTO' seguido de un 'UPDATE'
--     → NO es atómica. Es una race condition activa: dos pedidos simultáneos
--       leen el mismo contador y generan el mismo order_code. Es la causa
--       (a) de los duplicados de la consulta 1.2. Aplica 3.5 sí o sí.
--
-- Anota también `tipo_retorno` y `argumentos`: los necesitas en 3.5 para saber
-- si basta CREATE OR REPLACE o hace falta DROP FUNCTION primero.

SELECT
  p.proname                                  AS funcion,
  pg_get_function_identity_arguments(p.oid)  AS argumentos,
  pg_get_function_result(p.oid)              AS tipo_retorno,
  p.prosecdef                                AS es_security_definer,
  p.prosrc                                   AS codigo_fuente
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN ('increment_order_counter', 'decrement_stock', 'increment_stock')
  AND n.nspname = 'public'
ORDER BY p.proname;

-- Quién puede ejecutarla hoy. IMPORTANTE: `anon` DEBE seguir apareciendo,
-- porque app/api/orders/route.ts:166 la llama con la anon key desde el
-- formulario público. Si al recrear la función se pierde ese permiso, los
-- pedidos públicos dejan de crearse. Por eso 3.5 re-otorga los GRANT.
SELECT
  routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('increment_order_counter', 'decrement_stock', 'increment_stock')
ORDER BY routine_name, grantee;


-- ============================================================================
--  FASE 2 — LIMPIEZA
--
--  TODO ESTE BLOQUE ESTÁ COMENTADO A PROPÓSITO.
--
--  Solo necesitas la subsección correspondiente a las consultas de la fase 1
--  que devolvieron filas. Si todas dieron 0, salta directo a la FASE 3.
--
--  Cada script tiene un SELECT de previsualización (seguro, córrelo primero)
--  y debajo el DML real dentro de /* */. Descomenta solo cuando el SELECT te
--  muestre exactamente las filas que esperas tocar.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 2.1  Limpiar transacciones de ingreso duplicadas
-- ---------------------------------------------------------------------------
-- CRITERIO: conservar la MÁS ANTIGUA de cada grupo (la que se creó cuando el
-- pedido se marcó entregado por primera vez) y borrar las demás. Se desempata
-- por `id` para que el resultado sea determinista aunque los `created_at`
-- sean idénticos al milisegundo.
--
-- POR QUÉ LA MÁS ANTIGUA: las copias posteriores son el artefacto del doble
-- clic. La primera es la que corresponde al hecho real de la entrega.
--
-- OJO: si el total del pedido se editó DESPUÉS (orders/page.tsx:432 sincroniza
-- el monto), las copias pueden tener montos distintos. En ese caso quieres
-- conservar la que coincide con `orders.total_amount` actual. El SELECT de
-- previsualización marca esos casos en la columna `revisar_a_mano`.

-- PASO 1 — previsualizar qué se borraría (seguro):
SELECT
  ft.id, ft.order_id, o.order_code, ft.amount, o.total_amount AS total_del_pedido,
  ft.created_at,
  CASE WHEN ft.amount IS DISTINCT FROM o.total_amount
       THEN 'SI - montos distintos entre copias' ELSE '' END AS revisar_a_mano
FROM finance_transactions ft
LEFT JOIN orders o ON o.id = ft.order_id
WHERE ft.source = 'order' AND ft.order_id IS NOT NULL
  AND ft.id NOT IN (
    SELECT DISTINCT ON (order_id) id
    FROM finance_transactions
    WHERE source = 'order' AND order_id IS NOT NULL
    ORDER BY order_id, created_at ASC, id ASC
  )
ORDER BY ft.order_id, ft.created_at;

-- PASO 2 — borrar (descomentar solo tras revisar el paso 1):
/*
BEGIN;

  DELETE FROM finance_transactions
  WHERE source = 'order'
    AND order_id IS NOT NULL
    AND id NOT IN (
      SELECT DISTINCT ON (order_id) id
      FROM finance_transactions
      WHERE source = 'order' AND order_id IS NOT NULL
      ORDER BY order_id, created_at ASC, id ASC
    );

  -- Verificación dentro de la transacción: debe devolver 0 filas.
  -- Si devuelve algo, haz ROLLBACK en vez de COMMIT.
  SELECT order_id, count(*)
  FROM finance_transactions
  WHERE source = 'order' AND order_id IS NOT NULL
  GROUP BY order_id HAVING count(*) > 1;

COMMIT;
-- ROLLBACK;   <- usa este si la verificación devolvió filas
*/


-- ---------------------------------------------------------------------------
-- 2.2  Limpiar códigos de pedido duplicados
-- ---------------------------------------------------------------------------
-- CRITERIO: NO se borra ningún pedido. Son ventas reales con items, cliente y
-- posiblemente dinero asociado. Se RENOMBRAN los duplicados más nuevos
-- añadiendo un sufijo -D2, -D3, etc. El más antiguo conserva el código limpio.
--
-- CONSECUENCIA ACEPTADA: si un cliente guardó el link /track?code=XXX de un
-- pedido renombrado, ese link deja de funcionar. Es preferible al estado
-- actual, en el que ese mismo link devuelve el pedido de OTRA persona
-- (track/page.tsx:26 usa .single() sobre un código ambiguo).
--
-- SI `tiendas_distintas` > 1 EN LA CONSULTA 1.2: arregla primero el prefijo
-- duplicado (2.3), porque si no volverán a colisionar en el próximo pedido.

-- PASO 1 — previsualizar los renombres (seguro):
SELECT
  id, order_code AS codigo_actual,
  order_code || '-D' || row_number() OVER (PARTITION BY order_code ORDER BY created_at ASC, id ASC) AS codigo_nuevo,
  store_id, created_at, total_amount
FROM orders
WHERE order_code IN (SELECT order_code FROM orders GROUP BY order_code HAVING count(*) > 1)
  AND id NOT IN (
    SELECT DISTINCT ON (order_code) id FROM orders ORDER BY order_code, created_at ASC, id ASC
  )
ORDER BY order_code, created_at;

-- PASO 2 — renombrar (descomentar solo tras revisar el paso 1):
/*
BEGIN;

  WITH ranked AS (
    SELECT id, order_code,
           row_number() OVER (PARTITION BY order_code ORDER BY created_at ASC, id ASC) AS rn
    FROM orders
    WHERE order_code IN (SELECT order_code FROM orders GROUP BY order_code HAVING count(*) > 1)
  )
  UPDATE orders o
  SET order_code = r.order_code || '-D' || r.rn
  FROM ranked r
  WHERE o.id = r.id AND r.rn > 1;   -- rn = 1 conserva el código original

  -- Verificación: debe devolver 0 filas.
  SELECT order_code, count(*) FROM orders GROUP BY order_code HAVING count(*) > 1;

COMMIT;
-- ROLLBACK;
*/


-- ---------------------------------------------------------------------------
-- 2.3  Resolver prefijos de tienda duplicados
-- ---------------------------------------------------------------------------
-- ESTO NO SE PUEDE AUTOMATIZAR. Requiere una decisión de negocio.
--
-- CRITERIO SUGERIDO: conserva el prefijo la tienda con MÁS PEDIDOS (usa el
-- complemento de la consulta 1.3). La otra recibe un prefijo nuevo y libre.
--
-- TRES EFECTOS QUE DEBES ASUMIR ANTES DE CAMBIAR UN PREFIJO:
--
--   1. Se rompen TODOS los links públicos de esa tienda. /order/VIEJO,
--      /catalog/VIEJO, /wholesale/VIEJO y /contact/VIEJO dejan de resolver.
--      La tienda los tiene repartidos en WhatsApp, Instagram, tarjetas.
--      AVÍSALE AL DUEÑO ANTES. Los links nuevos están en Ajustes.
--
--   2. Sus pedidos YA CREADOS conservan el order_code con el prefijo viejo
--      (VIEJO-2026-001). No se renombran: son comprobantes ya entregados al
--      cliente y links de rastreo activos. Convivirán códigos de dos prefijos
--      en la misma tienda. Es cosmético y aceptable.
--
--   3. ⚠️  El punto 2 puede CREAR duplicados de order_code con la otra tienda,
--      porque ambas venían generando la misma serie. Por eso el orden correcto
--      es: primero 2.3 (prefijos), después 2.2 (renombrar códigos), y recién
--      entonces los índices de la fase 3. Si ya corriste 2.2, vuelve a correr
--      la consulta 1.2 después de este paso.
--
-- Verifica que el prefijo nuevo esté libre antes de asignarlo:
--     SELECT id, name FROM stores WHERE upper(store_prefix) = upper('NUEVO');
--     -- debe devolver 0 filas
--
-- Reemplaza <UUID-DE-LA-TIENDA> y 'NUEVO' y descomenta:
/*
BEGIN;

  UPDATE stores
  SET store_prefix = upper(btrim('NUEVO'))
  WHERE id = '<UUID-DE-LA-TIENDA>'::uuid
    AND NOT EXISTS (                                  -- red de seguridad
      SELECT 1 FROM stores s2
      WHERE upper(s2.store_prefix) = upper(btrim('NUEVO'))
        AND s2.id <> '<UUID-DE-LA-TIENDA>'::uuid
    );

  -- Verificación: debe devolver 0 filas.
  SELECT upper(store_prefix), count(*) FROM stores
  WHERE store_prefix IS NOT NULL AND btrim(store_prefix) <> ''
  GROUP BY upper(store_prefix) HAVING count(*) > 1;

COMMIT;
-- ROLLBACK;
*/


-- ---------------------------------------------------------------------------
-- 2.4  Resolver tiendas con el mismo email (distinta capitalización)
-- ---------------------------------------------------------------------------
-- ESTO TAMPOCO SE PUEDE AUTOMATIZAR. Son dos filas `stores` para una misma
-- persona, cada una con sus propios pedidos, productos, clientes y finanzas
-- colgando por store_id. Fusionarlas es un proyecto aparte, no un índice.
--
-- Primero mide el daño — cuánto dato tiene cada fila:
SELECT
  s.id, s.email, s.name, s.status, s.store_prefix, s.created_at,
  (SELECT count(*) FROM orders               o WHERE o.store_id  = s.id) AS pedidos,
  (SELECT count(*) FROM products             p WHERE p.store_id  = s.id) AS productos,
  (SELECT count(*) FROM customers            c WHERE c.store_id  = s.id) AS clientes,
  (SELECT count(*) FROM finance_transactions f WHERE f.store_id  = s.id) AS movimientos
FROM stores s
WHERE lower(btrim(s.email)) IN (
  SELECT lower(btrim(email)) FROM stores WHERE email IS NOT NULL
  GROUP BY lower(btrim(email)) HAVING count(*) > 1
)
ORDER BY lower(btrim(s.email)), pedidos DESC;

-- CASO FÁCIL (el habitual): una de las filas está completamente VACÍA
-- (0 pedidos, 0 productos, 0 clientes, 0 movimientos) — típicamente un
-- registro duplicado que nunca se usó. Bórrala:
/*
BEGIN;
  DELETE FROM stores
  WHERE id = '<UUID-DE-LA-FILA-VACIA>'::uuid
    AND NOT EXISTS (SELECT 1 FROM orders               WHERE store_id = '<UUID-DE-LA-FILA-VACIA>'::uuid)
    AND NOT EXISTS (SELECT 1 FROM products             WHERE store_id = '<UUID-DE-LA-FILA-VACIA>'::uuid)
    AND NOT EXISTS (SELECT 1 FROM customers            WHERE store_id = '<UUID-DE-LA-FILA-VACIA>'::uuid)
    AND NOT EXISTS (SELECT 1 FROM finance_transactions WHERE store_id = '<UUID-DE-LA-FILA-VACIA>'::uuid);
  -- Si devuelve DELETE 0, la fila NO estaba vacía. Haz ROLLBACK y ve al caso difícil.
COMMIT;
-- ROLLBACK;
*/

-- CASO DIFÍCIL: ambas filas tienen datos. NO improvises aquí. Requiere
-- reasignar store_id en ~14 tablas dentro de una sola transacción, decidir
-- qué pasa con los prefijos y los contadores, y validar que no colisionen
-- order_codes. Déjalo fuera del Bloque 1: crea el resto de los índices,
-- omite `stores_email_lower_idx` (3.4) por ahora, y trátalo aparte.


-- ---------------------------------------------------------------------------
-- 2.5  (Solo escenario B de la consulta 1.5) Normalizar también auth.users
-- ---------------------------------------------------------------------------
-- Si 1.5 marcó filas como 'B - PELIGRO', la ruta LIMPIA es aplicar el fix A3
-- en el código (normalizar los 14 call sites) y desplegar ANTES de tocar la
-- base. Eso elimina el problema de raíz y no requiere tocar `auth`.
--
-- Si necesitas resolverlo solo en base de datos, hay que mover ambos lados a
-- la vez para que la comparación siga cuadrando. Escribir en `auth.users`
-- directamente NO está soportado por Supabase y puede romper el login:
-- hazlo con la Admin API, no con SQL.
--
--   Node, con la SERVICE ROLE KEY, fuera de la app:
--     const { data } = await admin.auth.admin.listUsers()
--     for (const u of data.users) {
--       const low = u.email.toLowerCase().trim()
--       if (u.email !== low) await admin.auth.admin.updateUserById(u.id, { email: low })
--     }
--
-- Recién después corre el UPDATE 3.0. Verifica con la consulta 1.5 (debe
-- devolver 0 filas) antes de crear el índice 3.4.


-- ============================================================================
--  FASE 3 — ÍNDICES Y FUNCIÓN ATÓMICA
--
--  Ejecutar cuando las consultas de la FASE 1 devuelvan 0 filas (o cuando
--  hayas aplicado la limpieza correspondiente de la FASE 2).
--
--  Los CREATE INDEX de abajo van SIN CONCURRENTLY porque el SQL Editor de
--  Supabase envuelve la sesión en una transacción y CONCURRENTLY no puede
--  correr dentro de una. Con el volumen actual de la plataforma el lock dura
--  milisegundos. Si alguna tabla superara el millón de filas, corre estos
--  índices con CONCURRENTLY desde una conexión psql directa, uno por uno.
--
--  TODOS SON REVERSIBLES:  DROP INDEX <nombre>;
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 3.0  Normalizar emails a minúsculas   ← ANTES del índice 3.4
-- ---------------------------------------------------------------------------
-- ⚠️  NO EJECUTES ESTO SIN HABER LEÍDO EL RESULTADO DE LA CONSULTA 1.5.
--     Si 1.5 marcó alguna fila como 'B - PELIGRO', este UPDATE deja a esa
--     tienda sin acceso al panel de forma permanente (proxy.ts:38 deja de
--     encontrarla y la redirige a /pending en cada request).
--
--     Puedes ejecutarlo con seguridad si 1.5 devolvió 0 filas, o si todas sus
--     filas dicen 'A - ROTA HOY, el UPDATE la arregla'.
--
-- Va antes del índice porque `stores_email_lower_idx` indexa lower(email):
-- si quedaran dos filas que solo difieren en capitalización, el CREATE INDEX
-- fallaría. Y va después de 2.4 porque esa es la que resuelve ese caso.

-- Previsualiza qué filas cambiarían (seguro):
SELECT id, name, email AS antes, lower(btrim(email)) AS despues
FROM stores
WHERE email IS DISTINCT FROM lower(btrim(email))
ORDER BY name;

-- Aplica (descomentar tras validar 1.5):
/*
BEGIN;
  UPDATE stores
  SET email = lower(btrim(email))
  WHERE email IS DISTINCT FROM lower(btrim(email));

  -- Verificación: debe devolver 0 filas.
  SELECT id, email FROM stores WHERE email IS DISTINCT FROM lower(btrim(email));
COMMIT;
-- ROLLBACK;
*/


-- ---------------------------------------------------------------------------
-- 3.1  finance_tx_one_per_order
-- ---------------------------------------------------------------------------
-- QUÉ PREVIENE:
--   Que un mismo pedido genere más de un ingreso en Finanzas. Es la defensa
--   real contra el hallazgo C7 del informe (`handleStatusChange` sin guard
--   anti-doble-clic) y contra cualquier futura ruta de duplicación —
--   incluyendo el endpoint del motorizado que hay que crear en C3.
--
--   Es el índice de mayor retorno del bloque: convierte "el dinero se cuenta
--   dos veces si el usuario hace doble clic" en un error 23505 que el código
--   puede ignorar tranquilamente (el ingreso ya estaba registrado).
--
-- POR QUÉ ES PARCIAL (WHERE source = 'order'):
--   Las transacciones manuales tienen order_id NULL y no deben restringirse.
--   La tienda puede registrar cuantos ingresos y egresos manuales quiera.
--
-- SI EL CREATE FALLA con 'could not create unique index ... duplicate key':
--   Tienes ingresos duplicados. Vuelve a la consulta 1.1 y aplica 2.1.
--   El mensaje de error incluye el order_id conflictivo entre paréntesis.
--   La base queda INTACTA: un CREATE INDEX que falla no modifica datos.
--
-- EFECTO EN EL CÓDIGO ACTUAL (sin tocar .tsx):
--   orders/page.tsx:192 y :210 harán `insert` que puede devolver error 23505.
--   Hoy ninguno de los dos lee `error`, así que el insert duplicado
--   simplemente NO OCURRE y la app sigue funcionando igual — que es
--   exactamente el comportamiento deseado. Al aplicar el Bloque 3 se añadirá
--   el manejo explícito (`if (txErr && txErr.code !== '23505')`).

CREATE UNIQUE INDEX IF NOT EXISTS finance_tx_one_per_order
  ON finance_transactions (order_id)
  WHERE source = 'order';


-- ---------------------------------------------------------------------------
-- 3.2  orders_code_unique
-- ---------------------------------------------------------------------------
-- QUÉ PREVIENE:
--   Dos pedidos con el mismo `order_code`. Cierra la race condition del
--   contador (hallazgo A10) por si `increment_order_counter` no fuera atómica,
--   y el efecto colateral de los prefijos duplicados (A9).
--
--   Sin este índice, /track (track/page.tsx:26) usa .eq('order_code', ...)
--   con .single() y devuelve el pedido equivocado — incluido el de otra
--   tienda — cuando hay ambigüedad.
--
-- SI EL CREATE FALLA:
--   Hay códigos repetidos. Consulta 1.2 → limpieza 2.2. Si 1.2 mostró
--   `tiendas_distintas` > 1, resuelve ANTES los prefijos (2.3), porque si no
--   volverás a tener colisiones en cuanto entre el siguiente pedido.
--
-- EFECTO EN EL CÓDIGO ACTUAL:
--   api/orders/route.ts:170 SÍ lee `orderError` (línea 180) y devuelve
--   "No se pudo crear el pedido" al cliente. Con este índice, una colisión de
--   contador pasa de "dos pedidos con el mismo código, silenciosamente" a
--   "un pedido falla y el cliente reintenta". Es el trade-off correcto: mejor
--   un reintento visible que dos ventas confundidas.
--   El fix 3.5 hace que esa colisión no ocurra en primer lugar.

CREATE UNIQUE INDEX IF NOT EXISTS orders_code_unique
  ON orders (order_code);


-- ---------------------------------------------------------------------------
-- 3.3  stores_prefix_unique
-- ---------------------------------------------------------------------------
-- QUÉ PREVIENE:
--   Que el admin asigne un prefijo ya ocupado desde app/admin/requests/page.tsx
--   (hallazgo A9). Hoy no hay ninguna validación: se escribe el prefijo a mano
--   y se guarda.
--
--   Un prefijo duplicado deja a AMBAS tiendas sin páginas públicas
--   funcionales, porque /order, /catalog, /wholesale y /contact resuelven la
--   tienda con .eq('store_prefix', ...).single(), que lanza PGRST116 con más
--   de una fila. Las dos tiendas ven "Tienda no encontrada".
--
-- POR QUÉ upper():
--   El código llama a .toUpperCase() antes de comparar (order/[prefix]:175,
--   catalog:55, wholesale:38, contact:10) y al guardar (requests:24), pero
--   nada garantiza que la columna esté en mayúsculas. Indexar upper() hace
--   que 'abc' y 'ABC' colisionen, que es la semántica real de la aplicación.
--
-- POR QUÉ ES PARCIAL (WHERE store_prefix IS NOT NULL):
--   Las tiendas en estado 'pending' todavía no tienen prefijo — se les asigna
--   al aprobarlas. Sin el WHERE, solo una podría tener NULL.
--   (En Postgres los NULL no colisionan entre sí, así que el WHERE es
--   defensivo y además hace el índice más chico. Lo que sí filtra de verdad
--   son las cadenas vacías, si las hubiera: revísalas con
--   SELECT id, name FROM stores WHERE btrim(store_prefix) = '';
--   y ponlas en NULL antes de crear el índice.)
--
-- SI EL CREATE FALLA:
--   Consulta 1.3 → limpieza 2.3. Recuerda avisar al dueño de la tienda que
--   cambia de prefijo: se le rompen los links que ya repartió.

CREATE UNIQUE INDEX IF NOT EXISTS stores_prefix_unique
  ON stores (upper(store_prefix))
  WHERE store_prefix IS NOT NULL;


-- ---------------------------------------------------------------------------
-- 3.4  stores_email_lower_idx
-- ---------------------------------------------------------------------------
-- ⚠️  REQUIERE HABER CORRIDO 3.0 (y haber validado 1.5) PRIMERO.
--
-- QUÉ PREVIENE:
--   Dos filas `stores` para la misma persona con distinta capitalización
--   (hallazgo A3). Hoy nada lo impide: register/page.tsx:53 inserta sin
--   verificar duplicados, y admin puede crear filas a mano.
--
--   Con dos filas para el mismo email, `.single()` en proxy.ts:36 lanza
--   PGRST116, el resultado es null, y el usuario queda encerrado en /pending
--   sin poder entrar a ninguna parte.
--
-- BENEFICIO ADICIONAL:
--   Este índice acelera los ~16 lookups `stores WHERE email = ...` que hace
--   la app en cada carga de página del panel — pero SOLO para las consultas
--   que usan lower(email). Las 14 que pasan `user.email` crudo no lo
--   aprovechan hasta que se aplique el fix A3.
--
-- SI EL CREATE FALLA:
--   Consulta 1.4 → limpieza 2.4. Si el caso es el "difícil" (ambas filas con
--   datos), OMITE este índice por ahora: los otros tres son independientes y
--   valen igual. Deja este para cuando resuelvas la fusión.

CREATE UNIQUE INDEX IF NOT EXISTS stores_email_lower_idx
  ON stores (lower(email));


-- ---------------------------------------------------------------------------
-- 3.5  increment_order_counter — versión atómica
-- ---------------------------------------------------------------------------
-- QUÉ ARREGLA (hallazgo A10):
--   Un solo UPDATE ... RETURNING. Postgres toma un lock de fila sobre `stores`
--   durante el UPDATE, así que dos pedidos simultáneos de la misma tienda se
--   serializan: el segundo espera y recibe el número siguiente. Es imposible
--   que dos transacciones concurrentes obtengan el mismo contador.
--
--   Si la versión actual hace SELECT y luego UPDATE (verifícalo en 1.6),
--   ahí hay una ventana entre ambos en la que dos pedidos leen el mismo valor
--   y generan el mismo order_code.
--
-- ANTES DE EJECUTAR — mira `tipo_retorno` y `argumentos` en la consulta 1.6:
--   · Si son (p_store_id uuid) → integer, CREATE OR REPLACE funciona directo.
--   · Si el tipo de retorno es distinto (bigint, numeric...), Postgres
--     rechaza el REPLACE con "cannot change return type of existing function".
--     En ese caso descomenta el DROP de abajo. Ajusta la firma si difiere.
--   · Si el nombre del parámetro no es `p_store_id`, NO lo cambies aquí sin
--     cambiarlo también en las 3 llamadas del código, que lo pasan por nombre:
--       app/api/orders/route.ts:166, app/store/orders/page.tsx:485,
--       app/store/quotes/page.tsx:217
--
-- SOBRE LOS GRANT: son imprescindibles. app/api/orders/route.ts:166 llama a
-- esta función con la ANON KEY (el endpoint construye un cliente anónimo en
-- la línea 20). Sin GRANT a `anon`, el formulario público deja de crear
-- pedidos. CREATE OR REPLACE conserva los permisos, pero si usas el DROP se
-- pierden — por eso se re-otorgan explícitamente al final.

-- Descomenta SOLO si el CREATE OR REPLACE falla por cambio de tipo:
-- DROP FUNCTION IF EXISTS public.increment_order_counter(uuid);

CREATE OR REPLACE FUNCTION public.increment_order_counter(p_store_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_counter integer;
BEGIN
  -- UPDATE ... RETURNING en una sola sentencia: atómico por definición.
  -- El COALESCE cubre las tiendas cuyo order_counter todavía es NULL.
  UPDATE stores
  SET order_counter = COALESCE(order_counter, 0) + 1
  WHERE id = p_store_id
  RETURNING order_counter INTO v_counter;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tienda no encontrada: %', p_store_id
      USING ERRCODE = 'no_data_found';
  END IF;

  RETURN v_counter;
END;
$$;

COMMENT ON FUNCTION public.increment_order_counter(uuid) IS
  'Incrementa y devuelve el contador de pedidos de una tienda de forma atómica. '
  'Un solo UPDATE ... RETURNING: dos llamadas concurrentes nunca devuelven el '
  'mismo número. Llamada desde api/orders/route.ts (anon), store/orders y '
  'store/quotes (authenticated).';

-- Re-otorgar permisos (imprescindible si usaste el DROP de arriba):
GRANT EXECUTE ON FUNCTION public.increment_order_counter(uuid) TO anon, authenticated;


-- ============================================================================
--  VERIFICACIÓN FINAL
--  Corre esto al terminar. Deben aparecer los 4 índices y la función.
-- ============================================================================

SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'finance_tx_one_per_order',
    'orders_code_unique',
    'stores_prefix_unique',
    'stores_email_lower_idx'
  )
ORDER BY indexname;
-- Esperado: 4 filas. Si falta alguna, ese CREATE falló — revisa el mensaje
-- de error y la consulta de detección correspondiente de la FASE 1.
-- (Si omitiste stores_email_lower_idx por el caso difícil de 2.4, son 3.)

SELECT
  p.proname,
  pg_get_function_result(p.oid) AS retorna,
  p.prosrc LIKE '%RETURNING%'   AS usa_returning   -- debe ser true
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'increment_order_counter';

-- Y confirma que `anon` sigue pudiendo ejecutarla (si no, el formulario
-- público deja de crear pedidos):
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public' AND routine_name = 'increment_order_counter';
-- Esperado: al menos `anon` y `authenticated` con EXECUTE.


-- ============================================================================
--  ROLLBACK COMPLETO DEL BLOQUE 1
--  Los índices se quitan sin efectos secundarios. El UPDATE de emails (3.0)
--  y la limpieza de la FASE 2 NO son reversibles: para eso está el backup.
-- ============================================================================
/*
DROP INDEX IF EXISTS finance_tx_one_per_order;
DROP INDEX IF EXISTS orders_code_unique;
DROP INDEX IF EXISTS stores_prefix_unique;
DROP INDEX IF EXISTS stores_email_lower_idx;
*/
