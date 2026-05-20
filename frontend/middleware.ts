import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/register', '/auth'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes and Next.js internals
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r)) || pathname === '/') {
    return NextResponse.next();
  }

  // Check for Django JWT stored in a cookie (set on login) OR rely on client-side check.
  // Since JWTs are stored in localStorage (not cookies), the middleware can't read them.
  // We allow all routes here and let the client-side useCurrentUser redirect if needed.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.ico).*)'],
};
