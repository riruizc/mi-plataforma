import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function DELETE(request: Request) {
  try {
    const { storeId, email } = await request.json()

    if (!storeId || !email) {
      return NextResponse.json({ error: 'Missing storeId or email' }, { status: 400 })
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Borrar order_items de los pedidos de la tienda
    const { data: orders } = await adminSupabase
      .from('orders')
      .select('id')
      .eq('store_id', storeId)

    const orderIds = (orders || []).map((o: any) => o.id)
    if (orderIds.length > 0) {
      await adminSupabase.from('order_items').delete().in('order_id', orderIds)
    }

    // 2. Borrar orders
    await adminSupabase.from('orders').delete().eq('store_id', storeId)

    // 3. Borrar combo_items de los combos de la tienda
    const { data: combosToDelete } = await adminSupabase
      .from('combos')
      .select('id')
      .eq('store_id', storeId)

    const comboIds = (combosToDelete || []).map((c: any) => c.id)
    if (comboIds.length > 0) {
      await adminSupabase.from('combo_items').delete().in('combo_id', comboIds)
    }

    // 4. Borrar combos
    await adminSupabase.from('combos').delete().eq('store_id', storeId)

    // 5. Borrar product_variants
    const { data: products } = await adminSupabase
      .from('products')
      .select('id')
      .eq('store_id', storeId)

    const productIds = (products || []).map((p: any) => p.id)
    if (productIds.length > 0) {
      await adminSupabase.from('product_variants').delete().in('product_id', productIds)
    }

    // 6. Borrar products
    await adminSupabase.from('products').delete().eq('store_id', storeId)

    // 7. Borrar customers
    await adminSupabase.from('customers').delete().eq('store_id', storeId)

    // 8. Borrar routes
    await adminSupabase.from('routes').delete().eq('store_id', storeId)

    // 9. Borrar delivery_agencies
    await adminSupabase.from('delivery_agencies').delete().eq('store_id', storeId)

    // 10. Borrar finance_transactions
    await adminSupabase.from('finance_transactions').delete().eq('store_id', storeId)

    // 11. Borrar finances
    await adminSupabase.from('finances').delete().eq('store_id', storeId)

    // 12. Borrar goals
    await adminSupabase.from('goals').delete().eq('store_id', storeId)

    // 13. Borrar quotes
    await adminSupabase.from('quotes').delete().eq('store_id', storeId)

    // 14. Borrar suppliers
    await adminSupabase.from('suppliers').delete().eq('store_id', storeId)

    // 15. Borrar store_features
    await adminSupabase.from('store_features').delete().eq('store_id', storeId)

    // 16. Borrar logo del Storage (intentamos las extensiones más comunes)
    await adminSupabase.storage.from('logos').remove([
      `store-${storeId}.png`,
      `store-${storeId}.jpg`,
      `store-${storeId}.jpeg`,
      `store-${storeId}.webp`,
    ])

    // 17. Borrar la tienda
    await adminSupabase.from('stores').delete().eq('id', storeId)

    // 18. Borrar usuario de Auth
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