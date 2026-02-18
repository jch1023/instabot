
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
        // [중요] 인스타그램 정책상 팔로워 전체 목록 조회는 불가능함.
        // 따라서 이 버튼은 '안내 메시지'를 띄우는 용도로 변경하거나,
        // 정말로 가능한 방법(없음)을 시도하다 에러만 낼 뿐임.
        // 사용자에게 명확히 고지하는 것이 최선.

        alert("⚠️ Instagram 공식 API 제약사항\n\n현재 인스타그램은 '팔로워 전체 목록' 조회 기능을 제공하지 않습니다.\n(과거에는 가능했으나 개인정보 정책 강화로 막힘)\n\n대신, '댓글'이나 'DM' 등 상호작용이 발생하는 순간\n자동으로 이곳에 유저 정보가 등록됩니다.\n\n즉, 활동하는 '진성 팔로워' 위주로 목록이 채워집니다.");
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>팔로워 목록 관리</h2>
                    <p>봇이 감지한 활동 유저(팔로워) 목록입니다.</p>
                </div>
                <button
                    onClick={handleSync}
                    className="btn btn-primary"
                >
                    ℹ️ 동기화 도움말
                </button>
            </div>

            <div className="card">
                <div style={{ overflowX: 'auto' }}>
                    <table className="log-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid var(--border)' }}>ID</th>
                                <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid var(--border)' }}>Username</th>
                                <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid var(--border)' }}>최초 감지일</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="3" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading...</td></tr>
                            ) : followers.length === 0 ? (
                                <tr><td colSpan="3" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>👥</div>
                                    아직 감지된 유저가 없습니다.<br />
                                    댓글 이벤트가 발생하면 자동으로 추가됩니다.
                                </td></tr>
                            ) : (
                                followers.map(f => (
                                    <tr key={f.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{f.ig_user_id}</td>
                                        <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--primary-light)' }}>@{f.ig_username}</td>
                                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                                            {new Date(f.cached_at).toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                    <div>Total: {total}명</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className="btn btn-ghost btn-sm"
                            style={{ opacity: page === 1 ? 0.5 : 1 }}
                        >
                            Previous
                        </button>
                        <span style={{ display: 'flex', alignItems: 'center' }}>Page {page}</span>
                        <button
                            disabled={followers.length < PER_PAGE}
                            onClick={() => setPage(p => p + 1)}
                            className="btn btn-ghost btn-sm"
                            style={{ opacity: followers.length < PER_PAGE ? 0.5 : 1 }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
