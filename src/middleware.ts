import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const isWww = host?.startsWith('www.');
    const isHttps = protocol === 'https';

    // 1. Force WWW and HTTPS in production
    if (process.env.NODE_ENV === 'production') {
        if (!isWww || !isHttps) {
            const newHost = isWww ? host : `www.${host}`;
            return NextResponse.redirect(
                `https://${newHost}${request.nextUrl.pathname}${request.nextUrl.search}`,
                301
            );
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
