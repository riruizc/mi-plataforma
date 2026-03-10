import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function DELETE(request: Request) {
  try {
    const { storeId, email } = await request.json()

    if (!storeId || !email) {
      return NextResponse.json({ error: 'Missing storeId or email' }, { status: 400 })
    }

    // Cliente con service role para borrar auth user
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Obtener todos los pedidos de la tienda
    const { data: orders } = await adminSupabase
      .from('orders')
      .select('id')
      .eq('store_id', storeId)

    const orderIds = (orders || []).map((o: any) => o.id)

    // 2. Borrar order_items
    if (orderIds.length > 0) {
      await adminSupabase.from('order_items').delete().in('order_id', orderIds)
    }

    // 3. Borrar orders
    await adminSupabase.from('orders').delete().eq('store_id', storeId)

    // 4. Borrar product_variants
    const { data: products } = await adminSupabase
      .from('products')
      .select('id')
      .eq('store_id', storeId)

    const productIds = (products || []).map((p: any) => p.id)
    if (productIds.length > 0) {
      await adminSupabase.from('product_variants').delete().in('product_id', productIds)
    }

    // 5. Borrar products
    await adminSupabase.from('products').delete().eq('store_id', storeId)

    // 6. Borrar customers
    await adminSupabase.from('customers').delete().eq('store_id', storeId)

    // 7. Borrar routes
    await adminSupabase.from('routes').delete().eq('store_id', storeId)

    // 8. Borrar delivery_agencies
    await adminSupabase.from('delivery_agencies').delete().eq('store_id', storeId)

    // 9. Borrar store_features
    await adminSupabase.from('store_features').delete().eq('store_id', storeId)

    // 10. Borrar la tienda
    await adminSupabase.from('stores').delete().eq('id', storeId)

    // 11. Borrar usuario de Auth
    const { data: users } = await adminSupabase.auth.admin.listUsers()
    const authUser = users?.users?.find((u: any) => u.email === email.toLowerCase())
    if (authUser) {
      await adminSupabase.auth.admin.deleteUser(authUser.id)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete store error:', error)
    return NextResponse.json({ error: 'Error al eliminar tienda' }, { status: 500 })
  }
}