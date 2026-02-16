'use client';
import { useState, useEffect } from 'react';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/stats').then(r => r.json()).catch(() => null),
      fetch('/api/campaigns').then(r => r.json()).catch(() => []),
      fetch('/api/logs?limit=5').then(r => r.json()).catch(() => []),
    ]).then(([s, c, l]) => {
      setStats(s);
      setCampaigns(Array.isArray(c) ? c : []);
      setLogs(Array.isArray(l) ? l : []);
      setLoading(false);
    });
  }, []);

  // Fallback stats for visual display when DB is empty
  const displayStats = {
    todayDms: stats?.todayDms ?? 0,
    todayComments: stats?.todayComments ?? 0,
    activeCampaigns: stats?.activeCampaigns ?? 0,
    totalCampaigns: stats?.totalCampaigns ?? 0,
    successRate: stats?.successRate ?? 0,
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h2>대시보드</h2>
        <p>인스타그램 DM 자동화 현황을 한눈에 확인하세요</p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card purple">
          <div className="stat-card-header">
            <span className="stat-card-label">오늘 DM 발송</span>
            <span className="stat-card-icon">📨</span>
          </div>
          <div className="stat-card-value">{displayStats.todayDms}</div>
          <div className="stat-card-change" style={{ color: 'var(--text-secondary)' }}>발송된 DM 수</div>
        </div>

        <div className="stat-card pink">
          <div className="stat-card-header">
            <span className="stat-card-label">처리된 댓글</span>
            <span className="stat-card-icon">💬</span>
          </div>
          <div className="stat-card-value">{displayStats.todayComments}</div>
          <div className="stat-card-change" style={{ color: 'var(--text-secondary)' }}>감지된 댓글 수</div>
        </div>

        <div className="stat-card green">
          <div className="stat-card-header">
            <span className="stat-card-label">활성 캠페인</span>
            <span className="stat-card-icon">🚀</span>
          </div>
          <div className="stat-card-value">{displayStats.activeCampaigns}</div>
          <div className="stat-card-change" style={{ color: 'var(--text-secondary)' }}>총 {displayStats.totalCampaigns}개 캠페인</div>
        </div>

        <div className="stat-card orange">
          <div className="stat-card-header">
            <span className="stat-card-label">DM 성공률</span>
            <span className="stat-card-icon">✅</span>
          </div>
          <div className="stat-card-value">{displayStats.successRate}%</div>
          <div className="stat-card-change" style={{ color: 'var(--text-secondary)' }}>전체 기간</div>
        </div>
      </div>

      {/* Two columns: Recent logs + Active campaigns */}
      <div className="dashboard-grid">
        {/* Recent DM Logs */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>최근 DM 발송</h3>
            <a href="/logs" className="btn btn-ghost btn-sm">전체 보기 →</a>
          </div>
          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
              <div style={{ fontSize: '13px' }}>아직 발송된 DM이 없습니다</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>캠페인을 활성화하면 여기에 로그가 표시됩니다</div>
            </div>
          ) : (
            <div className="log-table-wrapper" style={{ border: 'none' }}>
              <table className="log-table">
                <thead>
                  <tr>
                    <th>사용자</th>
                    <th>댓글</th>
                    <th>팔로워</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id}>
                      <td style={{ fontWeight: 500 }}>@{log.ig_username}</td>
                      <td style={{ color: 'var(--text-secondary)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.comment_text}</td>
                      <td>
                        <span className={`follower-badge ${log.is_follower ? 'yes' : 'no'}`}>
                          {log.is_follower ? '팔로워' : '비팔로워'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${log.status}`}>
                          {log.status === 'sent' ? '발송' : '실패'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Active Campaigns */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>캠페인 목록</h3>
            <a href="/campaigns" className="btn btn-ghost btn-sm">전체 보기 →</a>
          </div>
          {campaigns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🚀</div>
              <div style={{ fontSize: '13px' }}>아직 캠페인이 없습니다</div>
              <a href="/campaigns/new" className="btn btn-primary btn-sm" style={{ marginTop: '12px' }}>
                ＋ 첫 캠페인 만들기
              </a>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {campaigns.slice(0, 5).map(c => (
                <a href={`/campaigns/${c.id}`} key={c.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)', transition: 'var(--transition-fast)',
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{c.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      📨 {c.sent_dms || 0} DM 발송
                    </div>
                  </div>
                  <span className={`campaign-card-badge ${c.is_active ? 'active' : 'paused'}`} style={{ position: 'static' }}>
                    {c.is_active ? '활성' : '일시정지'}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
