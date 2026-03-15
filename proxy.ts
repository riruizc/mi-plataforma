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

  // Si ya está logueado y trata de ir al login
  if (user && path === '/login') {
    const { data: store } = await supabase
      .from('stores')
      .select('status')
      .eq('email', user.email!)
      .single()
  
    if (store?.status === 'admin') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    } else if (store?.status === 'active') {
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