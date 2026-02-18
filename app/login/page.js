
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (res.ok) {
                // 성공 시 페이지 이동 (서버가 쿠키를 심어줌)
                router.push('/');
                router.refresh();
            } else {
                const data = await res.json();
                setError(data.error || '로그인 실패');
            }
        } catch {
            setError('서버 통신 오류');
        }
    };

    return (
        <div className="login-shell">
            <div className="login-orb login-orb-left" />
            <div className="login-orb login-orb-right" />

            <div className="login-stage">
                <section className="login-hero">
                    <div className="login-brand">
                        <div className="login-brand-mark">BB</div>
                        <div>
                            <div className="login-brand-name">BLANKER BOT</div>
                            <div className="login-brand-subtitle">Instagram DM Automation Console</div>
                        </div>
                    </div>

                    <h1 className="login-hero-title">댓글 반응을 빠르게 매출 전환으로 연결하세요</h1>
                    <p className="login-hero-copy">
                        팔로워 구분, CTA 트리거, 캠페인 로그까지 한 화면에서 관리하는 BLANKER BOT 운영 콘솔입니다.
                    </p>

                    <div className="login-feature-list">
                        <div className="login-feature-item">
                            <span>⚡</span>
                            <p>실시간 댓글 감지와 DM 자동 발송</p>
                        </div>
                        <div className="login-feature-item">
                            <span>🎯</span>
                            <p>팔로워/비팔로워 분기 메시지와 CTA 관리</p>
                        </div>
                        <div className="login-feature-item">
                            <span>📈</span>
                            <p>성과 로그 기반 캠페인 최적화</p>
                        </div>
                    </div>
                </section>

                <section className="login-card">
                    <div className="login-card-header">
                        <h2>관리자 로그인</h2>
                        <p>BLANKER BOT 대시보드에 접근하려면 계정 정보를 입력하세요.</p>
                    </div>

                    {error && <div className="login-error">{error}</div>}

                    <form onSubmit={handleLogin} className="login-form">
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">아이디</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="form-input login-input"
                                placeholder="admin"
                                required
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">비밀번호</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                                className="form-input login-input"
                            placeholder="••••••"
                            required
                        />
                        </div>

                        <button type="submit" className="btn btn-primary login-submit-btn">
                            로그인
                        </button>
                    </form>
                </section>
                    </div>
        </div>
    );
}
