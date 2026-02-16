'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function Sidebar() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);

    // Close sidebar on route change
    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    // Close sidebar on escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const navItems = [
        { href: '/', label: '대시보드', icon: '📊' },
        { href: '/campaigns', label: '캠페인', icon: '🚀' },
        { href: '/logs', label: 'DM 로그', icon: '📨' },
        { href: '/settings', label: '설정', icon: '⚙️' },
    ];

    return (
        <>
            {/* Mobile hamburger button */}
            <button
                className="mobile-menu-btn"
                onClick={() => setIsOpen(!isOpen)}
                aria-label="메뉴"
            >
                {isOpen ? '✕' : '☰'}
            </button>

            {/* Overlay */}
            <div
                className={`sidebar-overlay ${isOpen ? 'open' : ''}`}
                onClick={() => setIsOpen(false)}
            />

            {/* Sidebar */}
            <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
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
        </>
    );
}
