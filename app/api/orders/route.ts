import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { storePrefix, customer, delivery, cart, comboCart } = body

    if (!storePrefix || !customer?.name || !customer?.phone) {
      return NextResponse.json({ error: 'Faltan datos del pedido' }, { status: 400 })
    }
    if (!delivery?.destination) {
      return NextResponse.json({ error: 'Falta la dirección de entrega' }, { status: 400 })
    }
    if ((!Array.isArray(cart) || cart.length === 0) && (!Array.isArray(comboCart) || comboCart.length === 0)) {
      return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // 1. Tienda: se resuelve por prefijo en el servidor, nunca se confía en un store_id del cliente
    const { data: store } = await supabase
      .from('stores')
      .select('id, store_prefix, order_counter')
      .eq('store_prefix', String(storePrefix).toUpperCase())
      .eq('status', 'active')
      .single()

    if (!store) {
      return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })
    }

    // 2. Recalcular cada línea de producto contra el precio real en la DB
    const resolvedItems: { product_id: string; variant_id: string | null; product_name: string; color: string; quantity: number; unit_price: number }[] = []

    for (const c of (cart || [])) {
      const quantity = Number(c.quantity)
      if (!c.product_id || !Number.isFinite(quantity) || quantity <= 0) {
        return NextResponse.json({ error: 'Producto inválido en el carrito' }, { status: 400 })
      }

      const { data: product } = await supabase
        .from('products')
        .select('id, name, sale_price, product_variants(id, color)')
        .eq('id', c.product_id)
        .eq('store_id', store.id)
        .eq('is_active', true)
        .single()

      if (!product) {
        return NextResponse.json({ error: 'Un producto del carrito ya no está disponible' }, { status: 400 })
      }

      let color = 'Único'
      let variantId: string | null = null
      if (c.variant_id) {
        const variant = (product.product_variants || []).find((v: any) => v.id === c.variant_id)
        if (!variant) {
          return NextResponse.json({ error: 'Una variante del carrito ya no está disponible' }, { status: 400 })
        }
        variantId = variant.id
        color = variant.color
      }

      resolvedItems.push({
        product_id: product.id,
        variant_id: variantId,
        product_name: product.name,
        color,
        quantity,
        unit_price: product.sale_price,
      })
    }

    // 3. Recalcular cada combo contra el precio y la composición real en la DB
    const resolvedCombos: { combo_id: string; combo_name: string; quantity: number; unit_price: number; items: { product_id: string; variant_id: string | null; product_name: string; color: string; quantity: number }[] }[] = []

    for (const c of (comboCart || [])) {
      const quantity = Number(c.quantity)
      if (!c.combo_id || !Number.isFinite(quantity) || quantity <= 0) {
        return NextResponse.json({ error: 'Combo inválido en el carrito' }, { status: 400 })
      }

      const { data: combo } = await supabase
        .from('combos')
        .select('id, name, price')
        .eq('id', c.combo_id)
        .eq('store_id', store.id)
        .eq('is_active', true)
        .single()

      if (!combo) {
        return NextResponse.json({ error: 'Un combo del carrito ya no está disponible' }, { status: 400 })
      }

      const { data: comboItems } = await supabase
        .from('combo_items')
        .select('product_id, variant_id, quantity, products(name), product_variants(color)')
        .eq('combo_id', combo.id)

      resolvedCombos.push({
        combo_id: combo.id,
        combo_name: combo.name,
        quantity,
        unit_price: combo.price,
        items: (comboItems || []).map((ci: any) => ({
          product_id: ci.product_id,
          variant_id: ci.variant_id || null,
          product_name: ci.products?.name || '',
          color: ci.product_variants?.color || 'Único',
          quantity: ci.quantity,
        })),
      })
    }

    const productTotal = resolvedItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
    const comboTotal = resolvedCombos.reduce((sum, c) => sum + c.unit_price * c.quantity, 0)
    const total = productTotal + comboTotal

    // 4. Cliente: buscar por teléfono (store-scoped) o crear uno nuevo
    let customerId: string | undefined
    const { data: existingCustomer } = await supabase
      .from('customers').select('id')
      .eq('store_id', store.id)
      .eq('phone', customer.phone)
      .maybeSingle()

    if (existingCustomer?.id) {
      customerId = existingCustomer.id
      await supabase.from('customers')
        .update({ name: customer.name, dni: customer.dni || null })
        .eq('id', existingCustomer.id)
    } else {
      const { data: newCustomer, error: insertError } = await supabase
        .from('customers')
        .insert({ store_id: store.id, name: customer.name, phone: customer.phone, dni: customer.dni || null })
        .select('id')
        .maybeSingle()

      if (insertError) {
        const { data: retryCustomer } = await supabase
          .from('customers').select('id')
          .eq('store_id', store.id)
          .eq('phone', customer.phone)
          .maybeSingle()
        customerId = retryCustomer?.id
      } else {
        customerId = newCustomer?.id
      }
    }

    // 5. Código de pedido y token de rastreo (generado server-side con crypto seguro)
    const year = new Date().getFullYear()
    const { data: counterData } = await supabase.rpc('increment_order_counter', { p_store_id: store.id })
    const code = store.store_prefix + '-' + year + '-' + String(counterData).padStart(3, '0')
    const token = randomBytes(16).toString('hex')

    const { data: order, error: orderError } = await supabase.from('orders').insert({
      store_id: store.id, customer_id: customerId, order_code: code,
      delivery_method: delivery.method,
      agency_name: delivery.method === 'agencia' ? delivery.agency_name : null,
      destination: delivery.destination, reference: delivery.reference || null,
      lat: delivery.method === 'motorizado' && delivery.lat ? Number(delivery.lat) : null,
      lng: delivery.method === 'motorizado' && delivery.lng ? Number(delivery.lng) : null,
      total_amount: total, pending_amount: total, status: 'pending', tracking_token: token,
    }).select('id').single()

    if (orderError || !order) {
      console.error('Order insert error:', orderError)
      return NextResponse.json({ error: 'No se pudo crear el pedido' }, { status: 500 })
    }

    // 6. Ítems de productos + descuento de stock
    if (resolvedItems.length > 0) {
      await supabase.from('order_items').insert(
        resolvedItems.map((i) => ({
          order_id: order.id,
          product_id: i.product_id,
          variant_id: i.variant_id,
          product_name: i.product_name,
          color: i.color,
          quantity: i.quantity,
          unit_price: i.unit_price,
          subtotal: i.unit_price * i.quantity,
        }))
      )
      for (const item of resolvedItems) {
        if (item.variant_id) {
          await supabase.rpc('decrement_stock', { p_variant_id: item.variant_id, p_qty: item.quantity })
        }
      }
    }

    // 7. Ítems de combos (expandidos) + descuento de stock
    for (const comboItem of resolvedCombos) {
      for (const ci of comboItem.items) {
        const totalQty = ci.quantity * comboItem.quantity
        await supabase.from('order_items').insert({
          order_id: order.id,
          product_id: ci.product_id,
          variant_id: ci.variant_id,
          product_name: `[Combo: ${comboItem.combo_name}] ${ci.product_name}`,
          color: ci.color,
          quantity: totalQty,
          unit_price: 0,
          subtotal: 0,
        })
        if (ci.variant_id) await supabase.rpc('decrement_stock', { p_variant_id: ci.variant_id, p_qty: totalQty })
      }
      await supabase.from('order_items').insert({
        order_id: order.id,
        product_id: comboItem.items[0]?.product_id || null,
        variant_id: null,
        product_name: `🎁 Combo: ${comboItem.combo_name}`,
        color: `x${comboItem.quantity}`,
        quantity: comboItem.quantity,
        unit_price: comboItem.unit_price,
        subtotal: comboItem.unit_price * comboItem.quantity,
      })
    }

    return NextResponse.json({ success: true, order_code: code })
  } catch (e) {
    console.error('Create order error:', e)
    return NextResponse.json({ error: 'Error al enviar el pedido, intenta de nuevo' }, { status: 500 })
  }
}
