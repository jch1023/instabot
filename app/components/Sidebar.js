'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
    const pathname = usePathname();

    const navItems = [
        { href: '/', label: '대시보드', icon: '📊' },
        { href: '/campaigns', label: '캠페인', icon: '🚀' },
        { href: '/logs', label: 'DM 로그', icon: '📨' },
        { href: '/settings', label: '설정', icon: '⚙️' },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="sidebar-logo-icon">📸</div>
                <div className="sidebar-logo-text">
                    <h1>InstaBot</h1>
                    <span>DM Automation</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                {navItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={pathname === item.href ? 'active' : ''}
                    >
                        <span className="nav-icon">{item.icon}</span>
                        <span>{item.label}</span>
                    </Link>
                ))}
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
