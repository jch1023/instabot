
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { username, password } = await request.json();

        // 하드코딩된 인증 정보
        if (username === 'jch1023' && password === 'j1023') {
            const response = NextResponse.json({ success: true });

            // 서버에서 직접 쿠키 설정 (HttpOnly, Secure)
            response.cookies.set('auth', 'true', {
                httpOnly: true, // 자바스크립트 접근 불가 (보안 강화)
                secure: process.env.NODE_ENV === 'production', // HTTPS에서만 동작
                path: '/',
                maxAge: 60 * 60 * 24, // 1일
            });

            return response;
        }

        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    } catch (error) {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
