
'use client';

import { useState, useEffect } from 'react';

export default function FollowersPage() {
    const [followers, setFollowers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [syncProgress, setSyncProgress] = useState('');
    const PER_PAGE = 50;

    const fetchFollowers = async (currentPage = 1) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/followers?limit=${PER_PAGE}&offset=${(currentPage - 1) * PER_PAGE}`);
            const data = await res.json();
            if (data.success) {
                setFollowers(data.followers);
                setTotal(data.total);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFollowers(page);
    }, [page]);

    const handleSync = async () => {
        if (!confirm('팔로워 목록 동기화를 시작하시겠습니까? (시간이 다소 소요될 수 있습니다.)')) return;

        setSyncing(true);
        setSyncProgress('동기화 시작 중...');
        let nextCursor = null;
        let totalSynced = 0;
        let keepGoing = true;
        let limit = 0;
        const MAX_PAGES = 50; // 안전 장치: 최대 50페이지(약 5000명)까지만

        try {
            while (keepGoing && limit < MAX_PAGES) {
                const res = await fetch('/api/followers/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ after: nextCursor })
                });
                const data = await res.json();

                if (data.success) {
                    totalSynced += data.count;
                    nextCursor = data.next_cursor;
                    setSyncProgress(`${totalSynced}명 저장 완료... (진행 중)`);

                    if (!nextCursor) {
                        keepGoing = false;
                    }
                    limit++;
                } else {
                    alert('동기화 중 오류 발생: ' + data.error);
                    keepGoing = false;
                }
            }

            setSyncProgress(`✅ 동기화 완료! 총 ${totalSynced}명 저장됨.`);
            fetchFollowers(1); // 목록 갱신

        } catch (e) {
            alert('동기화 실패: ' + e.message);
        } finally {
            setSyncing(false);
            setTimeout(() => setSyncProgress(''), 5000);
        }
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">👥 팔로워 목록 관리</h1>
                <button
                    onClick={handleSync}
                    disabled={syncing}
                    className={`px-4 py-2 rounded font-bold transition ${syncing ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'} text-white`}
                >
                    {syncing ? '🔄 동기화 중...' : '🔄 전체 동기화 시작'}
                </button>
            </div>

            {syncProgress && (
                <div className="mb-4 p-3 bg-blue-900/50 border border-blue-500 rounded text-blue-200">
                    INFO: {syncProgress}
                </div>
            )}

            <div className="bg-gray-800 rounded-lg shadow overflow-hidden">
                <table className="w-full text-left text-gray-300">
                    <thead className="bg-gray-700 text-gray-100">
                        <tr>
                            <th className="p-4">ID</th>
                            <th className="p-4">Username</th>
                            <th className="p-4">저장된 시간</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="3" className="p-8 text-center text-gray-400">Loading...</td></tr>
                        ) : followers.length === 0 ? (
                            <tr><td colSpan="3" className="p-8 text-center text-gray-400">데이터가 없습니다. 동기화를 실행해주세요.</td></tr>
                        ) : (
                            followers.map(f => (
                                <tr key={f.id} className="border-t border-gray-700 hover:bg-gray-750">
                                    <td className="p-4 text-gray-400 font-mono text-sm">{f.ig_user_id}</td>
                                    <td className="p-4 font-bold text-blue-400">@{f.ig_username}</td>
                                    <td className="p-4 text-gray-400 text-sm">
                                        {new Date(f.cached_at).toLocaleString()}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex justify-between items-center text-gray-400 text-sm">
                <div>Total: {total}명</div>
                <div className="space-x-2">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 text-white"
                    >
                        Previous
                    </button>
                    <span className="text-gray-300">Page {page}</span>
                    <button
                        disabled={followers.length < PER_PAGE}
                        onClick={() => setPage(p => p + 1)}
                        className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 text-white"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}
