import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('sm_session')?.value;
  const { pathname } = request.nextUrl;

  // 1. Define login/register and asset exclusions
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register');
  const isPublicRoute = pathname.startsWith('/brochure/');
  const isPublicAsset = pathname.startsWith('/_next') || pathname.startsWith('/favicon.ico');

  if (isPublicAsset) {
    return NextResponse.next();
  }

  // 2. Redirect rule: Redirect to /login if token doesn't exist and not on auth path or public route
  if (!token && !isAuthRoute && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Redirect rule: If logged in, prevent visiting /login or /register
  if (token && isAuthRoute) {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
