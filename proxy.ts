import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Si no está logueado y trata de entrar al panel
  if (!user && (path.startsWith('/admin') || path.startsWith('/store'))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Escapa los comodines de ILIKE. Sin esto, un email con guion bajo
  // (juan_perez@x.com, perfectamente válido) se trataría como patrón y podría
  // resolver a la tienda equivocada — en el guardia de acceso, nada menos.
  const escapeLike = (v: string) => v.replace(/([\\%_])/g, '\\$1')

  /**
   * Resuelve la tienda del usuario y si su plan sigue vigente.
   *
   * Usa ILIKE en vez de eq() para no depender de la capitalización guardada en
   * `stores.email`, y maybeSingle() en vez de single(): un usuario de Auth sin
   * fila en `stores` hacía que .single() devolviera un error PGRST116 en CADA
   * request del panel.
   */
  const getStoreAccess = async () => {
    const { data: store } = await supabase
      .from('stores')
      .select('status, expires_at')
      .ilike('email', escapeLike(user!.email!))
      .maybeSingle()

    const isExpired = !!store?.expires_at && new Date(store.expires_at) < new Date()
    return {
      status: store?.status as string | undefined,
      // El admin nunca vence; una tienda activa sí.
      isActive: store?.status === 'admin' || (store?.status === 'active' && !isExpired),
      isAdmin: store?.status === 'admin',
    }
  }

  // Si está logueado y trata de entrar al panel, validar el status de su tienda
  if (user && (path.startsWith('/admin') || path.startsWith('/store'))) {
    const { isActive, isAdmin } = await getStoreAccess()

    if (path.startsWith('/admin') && !isAdmin) {
      return NextResponse.redirect(new URL(isActive ? '/store/dashboard' : '/pending', request.url))
    }
    // Incluye el caso de plan vencido: antes `expires_at` se mostraba y se
    // extendía desde el panel de admin, pero no se comprobaba en ningún lado,
    // así que una tienda vencida conservaba el acceso completo indefinidamente.
    if (path.startsWith('/store') && !isActive) {
      return NextResponse.redirect(new URL('/pending', request.url))
    }
  }

  // Si ya está logueado y trata de ir al login
  if (user && path === '/login') {
    const { isActive, isAdmin } = await getStoreAccess()

    if (isAdmin) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    } else if (isActive) {
      return NextResponse.redirect(new URL('/store/dashboard', request.url))
    } else {
      return NextResponse.redirect(new URL('/pending', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|form|track|route|contact|catalog).*)'],
}