'use client';
import { useState, useEffect } from 'react';

export default function LogsPage() {
    const [logs, setLogs] = useState([]);
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);

    const fetchLogs = (statusFilter) => {
        setLoading(true);
        const url = statusFilter && statusFilter !== 'all'
            ? `/api/logs?status=${statusFilter}`
            : '/api/logs';

        fetch(url)
            .then(r => r.json())
            .then(data => { setLogs(Array.isArray(data) ? data : []); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(() => { fetchLogs(filter); }, [filter]);

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <h2>DM 발송 로그</h2>
                <p>자동 발송된 DM 내역을 확인하세요</p>
            </div>

            {/* Filter buttons */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                {[
                    { key: 'all', label: '전체' },
                    { key: 'sent', label: '✅ 성공' },
                    { key: 'failed', label: '❌ 실패' },
                ].map(f => (
                    <button
                        key={f.key}
                        className={`btn ${filter === f.key ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                        onClick={() => setFilter(f.key)}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '24px', animation: 'pulse 1.5s infinite' }}>⏳</div>
                </div>
            ) : logs.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon">📭</div>
                        <h3>아직 발송 로그가 없습니다</h3>
                        <p>캠페인이 활성화되고 댓글이 달리면 여기에 로그가 표시됩니다</p>
                    </div>
                </div>
            ) : (
                <div className="log-table-wrapper">
                    <table className="log-table">
                        <thead>
                            <tr>
                                <th>시간</th>
                                <th>캠페인</th>
                                <th>사용자</th>
                                <th>댓글 내용</th>
                                <th>팔로워</th>
                                <th>상태</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map(log => (
                                <tr key={log.id}>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                        {log.created_at}
                                    </td>
                                    <td>
                                        <span style={{
                                            padding: '3px 8px', borderRadius: 'var(--radius-full)',
                                            background: 'var(--bg-tertiary)', fontSize: '11px', fontWeight: 500
                                        }}>
                                            {log.campaign_name || '알 수 없음'}
                                        </span>
                                    </td>
                                    <td style={{ fontWeight: 500 }}>@{log.ig_username}</td>
                                    <td style={{ color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {log.comment_text}
                                    </td>
                                    <td>
                                        <span className={`follower-badge ${log.is_follower ? 'yes' : 'no'}`}>
                                            {log.is_follower ? '👥 팔로워' : '👤 비팔로워'}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`status-badge ${log.status}`}>
                                            {log.status === 'sent' ? '발송 완료' : '실패'}
                                        </span>
                                        {log.error_message && (
                                            <div style={{ fontSize: '11px', color: 'var(--error)', marginTop: '2px' }}>{log.error_message}</div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
