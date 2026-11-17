import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = new Set(['/', '/login', '/register'])

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const hasSession = Boolean(req.cookies.get('cc_access'))

  // Si autenticado y va a /login o /register, redirige a /dashboard
  if (hasSession && (pathname === '/login' || pathname === '/register')) {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Si NO autenticado y la ruta no es pública, redirige a /login
  if (!hasSession && !PUBLIC_PATHS.has(pathname)) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

// Protege todo salvo APIs internas de Next, assets estáticos y archivos con extensión
export const config = {
  matcher: ['/((?!_next/|api/|favicon.ico|.*\\..*).*)'],
}
