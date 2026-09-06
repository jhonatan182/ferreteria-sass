import { type NextRequest, NextResponse } from 'next/server';

/**
 * Redirección barata por presencia de la cookie de sesión (Next 16 "proxy",
 * antes "middleware"). Es solo UX: la autoridad de acceso es el backend
 * (docs/07 556-569). No valida la sesión, solo evita mostrar el login a quien
 * ya la tiene y viceversa.
 */
const SESSION_COOKIE = 'ferreteria_session';

export function proxy(req: NextRequest): NextResponse {
  const hasSession = req.cookies.has(SESSION_COOKIE);
  const { pathname } = req.nextUrl;

  const inApp = pathname === '/app' || pathname.startsWith('/app/');
  if (!hasSession && (inApp || pathname === '/select-tenant')) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  if (hasSession && pathname === '/login') {
    return NextResponse.redirect(new URL('/app', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/app', '/app/:path*', '/select-tenant'],
};
