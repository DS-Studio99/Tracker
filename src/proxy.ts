import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)

  const { pathname } = request.nextUrl

  // Public auth pages — no login required
  const publicPaths = ['/login', '/register', '/forgot-password', '/auth/callback']
  const isPublicPath = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(path + '/')
  )

  // API routes are handled independently (auth via service role / bearer token)
  const isApiRoute = pathname.startsWith('/api/')

  // Redirect unauthenticated users to login
  if (!user && !isPublicPath && !isApiRoute) {
    const url = new URL('/login', request.url)
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (user && isPublicPath && pathname !== '/auth/callback') {
    const url = new URL('/', request.url)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public static assets (svg, png, jpg, jpeg, gif, webp, ico, txt)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)',
  ],
}
