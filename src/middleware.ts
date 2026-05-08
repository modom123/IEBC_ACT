import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Subdomain → path prefix mapping
// e.g. app.iebusinessconsultants.com  → rewrite to /accounting
// e.g. hub.iebusinessconsultants.com  → rewrite to /hub
// e.g. portal.iebusinessconsultants.com → rewrite to /portal
const SUBDOMAIN_MAP: Record<string, string> = {
  app:        '/accounting',
  accounting: '/accounting',
  hub:        '/hub',
  portal:     '/portal',
  platform:   '/platform',
  workspace:  '/workspace',
}

function getSubdomain(request: NextRequest): string | null {
  const host = request.headers.get('host') || ''
  // Strip port if present (localhost:3000)
  const hostname = host.split(':')[0]
  // e.g. "app.iebusinessconsultants.com" → "app"
  const parts = hostname.split('.')
  if (parts.length >= 3) return parts[0]
  // Handle Vercel preview URLs like "app-iebconsultants.vercel.app"
  // or branch deploys — skip those
  return null
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }

  // ── Subdomain routing ──────────────────────────────────────────────
  // Known top-level sections — never prepend a subdomain prefix to these paths
  // (e.g. app.iebusinessconsultants.com/auth/login must NOT become /accounting/auth/login)
  const KNOWN_SECTIONS = [
    '/accounting', '/hub', '/portal', '/platform', '/efficient',
    '/checkout', '/auth', '/settings', '/admin', '/api', '/formation', '/workspace',
  ]

  // Track the path that will actually be served (may differ from the request path
  // when subdomain routing rewrites it — used for auth guard checks below)
  let effectivePathname = request.nextUrl.pathname

  const subdomain = getSubdomain(request)
  if (subdomain && SUBDOMAIN_MAP[subdomain]) {
    const prefix = SUBDOMAIN_MAP[subdomain]
    const pathname = request.nextUrl.pathname

    // Skip rewrite if the path already starts with the target prefix OR belongs
    // to another known section (prevents /auth/login → /accounting/auth/login)
    const isKnownSection = KNOWN_SECTIONS.some(p => pathname.startsWith(p))

    if (!pathname.startsWith(prefix) && !isKnownSection) {
      const rewriteUrl = request.nextUrl.clone()
      rewriteUrl.pathname = prefix + (pathname === '/' ? '' : pathname)
      effectivePathname = rewriteUrl.pathname
      response = NextResponse.rewrite(rewriteUrl)
      // Re-apply security headers after rewrite
      response.headers.set('X-Frame-Options', 'DENY')
      response.headers.set('X-Content-Type-Options', 'nosniff')
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
      response.headers.set('X-XSS-Protection', '1; mode=block')
      if (process.env.NODE_ENV === 'production') {
        response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
      }
    }
  }

  // ── Portal is fully public — skip auth ────────────────────────────
  if (effectivePathname.startsWith('/portal')) {
    return response
  }

  // Skip auth check if Supabase env vars are not configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { session } } = await supabase.auth.getSession()

    // Public paths that live inside a normally-protected prefix
    const publicWithinProtected = [
      '/accounting/checkout',  // purchase flow — must be accessible before login
    ]
    if (publicWithinProtected.some(p => effectivePathname.startsWith(p))) {
      return response
    }

    const protectedPaths = ['/accounting', '/hub', '/settings', '/admin', '/workspace', '/consultant']
    if (protectedPaths.some(p => effectivePathname.startsWith(p)) && !session) {
      // Redirect to login, preserving the effective destination as ?next=
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('next', effectivePathname)
      return NextResponse.redirect(loginUrl)
    }

    // ── Subscription gate for /accounting ────────────────────────────
    // Require an active/trialing/past_due subscription for all accounting
    // pages. Checkout itself is already exempted above via publicWithinProtected.
    // IEBC internal staff (admin / iebc_staff) bypass this gate entirely —
    // they use Phantom as internal tooling and always have full Platinum access.
    if (effectivePathname.startsWith('/accounting') && session) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
        const isInternalUser = profile?.role === 'admin' || profile?.role === 'iebc_staff'
        if (!isInternalUser) {
          const { data: sub } = await supabase
            .from('subscriptions')
            .select('status')
            .eq('user_id', session.user.id)
            .single()
          const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']
          if (!sub || !ACTIVE_STATUSES.includes(sub.status)) {
            return NextResponse.redirect(new URL('/accounting/checkout?required=1', request.url))
          }
        }
      } catch {
        // Subscription check failed — fail open so a DB hiccup doesn't lock users out
      }
    }

    // Admin-only guard
    if (effectivePathname.startsWith('/admin') && session) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
        if (profile?.role !== 'admin') {
          return NextResponse.redirect(new URL('/accounting', request.url))
        }
      } catch {
        return NextResponse.redirect(new URL('/accounting', request.url))
      }
    }
  } catch {
    return response
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static  (static files)
     * - _next/image   (image optimization)
     * - favicon.ico
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}
