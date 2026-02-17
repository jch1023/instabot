
import { NextResponse } from 'next/server';

export const config = {
    // protected routes only (API + Pages) used to prevent unauthorized access
    matcher: [
        '/',
        '/dashboard/:path*',
        '/settings/:path*',
        '/api/campaigns/:path*',
        '/api/settings/:path*'
    ],
};

export function middleware(request) {
    // 0. API Webhook은 검사 제외 (Meta는 인증 정보 없이 호출함)
    if (request.nextUrl.pathname.startsWith('/api/webhook')) {
        return NextResponse.next();
    }

    // 1. 로그인 여부 확인 (auth 쿠키 확인)
    const authCookie = request.cookies.get('auth');

    // 2. 로그인 안 했으면 -> 로그인 페이지로 이동
    if (!authCookie || authCookie.value !== 'true') {
        // API 요청이면 401 반환 (JSON)
        if (request.nextUrl.pathname.startsWith('/api')) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }
        // 일반 페이지면 /login으로 리다이렉트 (로그인 페이지 자체는 보호하지 않음)
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // 3. 로그인 했으면 통과
    return NextResponse.next();
}
