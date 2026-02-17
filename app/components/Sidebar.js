
import Link from 'next/link';

export default function Sidebar() {
    return (
        <aside className="w-64 bg-gray-800 text-white min-h-screen p-4">
            <h1 className="text-xl font-bold mb-6 text-center">🤖 Instagram DM Bot</h1>
            <ul className="space-y-2">
                <li><Link href="/dashboard" className="block p-2 hover:bg-gray-700 rounded">📊 대시보드</Link></li>
                <li><Link href="/campaigns" className="block p-2 hover:bg-gray-700 rounded">🚀 캠페인 관리</Link></li>
                <li><Link href="/manual-dm" className="block p-2 hover:bg-gray-700 rounded">📨 개별 DM 발송</Link></li>
                <li><Link href="/webhook-logs" className="block p-2 hover:bg-gray-700 rounded">📡 실시간 로그</Link></li>
                <li><Link href="/followers" className="block p-2 hover:bg-gray-700 rounded">👥 팔로워 목록</Link></li>
                <li><Link href="/settings" className="block p-2 hover:bg-gray-700 rounded">⚙️ 설정</Link></li>
            </ul>
        </aside>
    );
}
