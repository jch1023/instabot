
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
    const pathname = usePathname();

    // 로그인 페이지에서는 사이드바 숨김
    if (pathname === '/login') return null;

    const menuItems = [
        { name: '대시보드', path: '/', icon: <span className="nav-icon">📊</span> },
        { name: '캠페인 관리', path: '/campaigns', icon: <span className="nav-icon">🚀</span> },
        { name: '개별 DM 발송', path: '/manual-dm', icon: <span className="nav-icon">📨</span> },
        { name: '실시간 로그', path: '/webhook-logs', icon: <span className="nav-icon">📡</span> },
        { name: '팔로워 목록', path: '/followers', icon: <span className="nav-icon">👥</span> },
        { name: '설정', path: '/settings', icon: <span className="nav-icon">⚙️</span> },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <Link href="/" className="sidebar-logo">
                    <span style={{ fontSize: '24px', marginRight: '8px' }}>🤖</span>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '18px', lineHeight: 1 }}>BLANKER BOT</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 500 }}>DM Automation</div>
                    </div>
                </Link>
            </div>

            <nav className="sidebar-nav">
                {menuItems.map((item) => {
                    // 정확히 일치하거나 하위 경로일 때 active
                    const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
                    return (
                        <Link
                            key={item.path}
                            href={item.path}
                            className={isActive ? 'active' : ''}
                        >
                            {item.icon}
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            <div className="sidebar-bottom">
                <div className="sidebar-account">
                    <div className="sidebar-avatar">B</div>
                    <div className="sidebar-account-info">
                        <div className="sidebar-account-name">@blankerfactory</div>
                        <div className="sidebar-account-status">연결됨</div>
                    </div>
                </div>
            </div>
        </aside>
    );
}
