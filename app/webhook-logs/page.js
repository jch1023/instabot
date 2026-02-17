
'use client';
import { useState, useEffect, useRef } from 'react';

export default function WebhookLogsPage() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [error, setError] = useState(null);
    const intervalRef = useRef(null);

    const fetchLogs = async () => {
        try {
            const res = await fetch('/api/webhook/logs');
            if (!res.ok) throw new Error('Failed to fetch logs');
            const data = await res.json();
            setLogs(data);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        if (autoRefresh) {
            intervalRef.current = setInterval(fetchLogs, 3000); // 3초마다 자동 갱신
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [autoRefresh]);

    const formatTime = (ts) => {
        if (!ts) return '-';
        const d = new Date(ts);
        return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    };

    const getEventColor = (type) => {
        switch (type) {
            case 'comments': return '#4ade80';
            case 'messages': return '#60a5fa';
            case 'verify': return '#facc15';
            case 'error': return '#f87171';
            default: return '#a78bfa';
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'monospace', padding: '20px' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>
                        📡 Webhook 실시간 로그
                    </h1>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{
                            display: 'inline-block',
                            width: '10px', height: '10px',
                            borderRadius: '50%',
                            background: autoRefresh ? '#4ade80' : '#6b7280',
                            animation: autoRefresh ? 'pulse 2s infinite' : 'none',
                        }}></span>
                        <label style={{ cursor: 'pointer', fontSize: '14px' }}>
                            <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                                style={{ marginRight: '6px' }}
                            />
                            자동 갱신 (3초)
                        </label>
                        <button
                            onClick={fetchLogs}
                            style={{
                                background: '#334155',
                                color: '#e2e8f0',
                                border: '1px solid #475569',
                                padding: '6px 14px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '13px',
                            }}
                        >
                            🔄 새로고침
                        </button>
                        <a href="/" style={{ color: '#60a5fa', textDecoration: 'none', fontSize: '13px' }}>
                            ← 대시보드
                        </a>
                    </div>
                </div>

                {/* Status */}
                {error && (
                    <div style={{ background: '#7f1d1d', padding: '10px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
                        ❌ {error}
                    </div>
                )}

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
                        로딩 중...
                    </div>
                ) : logs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', background: '#1e293b', borderRadius: '12px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
                        <p style={{ fontSize: '16px' }}>아직 Webhook 이벤트가 없습니다</p>
                        <p style={{ fontSize: '13px', marginTop: '8px', color: '#64748b' }}>
                            Meta 개발자 콘솔에서 Webhook URL을 등록한 후, 인스타 댓글을 달아보세요!
                        </p>
                    </div>
                ) : (
                    <>
                        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
                            총 {logs.length}건
                        </div>

                        {/* Log Entries */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {logs.map((log) => (
                                <div
                                    key={log.id}
                                    style={{
                                        background: '#1e293b',
                                        border: '1px solid #334155',
                                        borderRadius: '8px',
                                        padding: '14px 18px',
                                        borderLeft: `4px solid ${getEventColor(log.event_type)}`,
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                            <span style={{
                                                background: getEventColor(log.event_type) + '22',
                                                color: getEventColor(log.event_type),
                                                padding: '2px 10px',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                                textTransform: 'uppercase',
                                            }}>
                                                {log.event_type}
                                            </span>
                                            <span style={{
                                                background: log.processed ? '#16a34a33' : '#dc262633',
                                                color: log.processed ? '#4ade80' : '#f87171',
                                                padding: '2px 10px',
                                                borderRadius: '12px',
                                                fontSize: '11px',
                                            }}>
                                                {log.processed ? '✅ 처리됨' : '⏳ 미처리'}
                                            </span>
                                        </div>
                                        <span style={{ color: '#64748b', fontSize: '12px' }}>
                                            #{log.id} · {formatTime(log.created_at)}
                                        </span>
                                    </div>

                                    {/* Payload */}
                                    <details style={{ marginTop: '6px' }}>
                                        <summary style={{ cursor: 'pointer', color: '#94a3b8', fontSize: '13px' }}>
                                            📦 Payload 보기
                                        </summary>
                                        <pre style={{
                                            background: '#0f172a',
                                            padding: '10px',
                                            borderRadius: '6px',
                                            marginTop: '6px',
                                            fontSize: '12px',
                                            overflow: 'auto',
                                            maxHeight: '200px',
                                            color: '#cbd5e1',
                                        }}>
                                            {(() => {
                                                try { return JSON.stringify(JSON.parse(log.payload), null, 2); } catch { return log.payload; }
                                            })()}
                                        </pre>
                                    </details>

                                    {/* Result */}
                                    {log.result && (
                                        <details style={{ marginTop: '4px' }}>
                                            <summary style={{ cursor: 'pointer', color: '#94a3b8', fontSize: '13px' }}>
                                                📋 처리 결과
                                            </summary>
                                            <pre style={{
                                                background: '#0f172a',
                                                padding: '10px',
                                                borderRadius: '6px',
                                                marginTop: '6px',
                                                fontSize: '12px',
                                                overflow: 'auto',
                                                maxHeight: '200px',
                                                color: '#a7f3d0',
                                            }}>
                                                {(() => {
                                                    try { return JSON.stringify(JSON.parse(log.result), null, 2); } catch { return log.result; }
                                                })()}
                                            </pre>
                                        </details>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
        </div>
    );
}
