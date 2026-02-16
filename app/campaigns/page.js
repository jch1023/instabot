'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CampaignsPage() {
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/campaigns')
            .then(r => r.json())
            .then(data => { setCampaigns(Array.isArray(data) ? data : []); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const gradients = [
        'linear-gradient(135deg, #833AB4, #E1306C)',
        'linear-gradient(135deg, #E1306C, #F77737)',
        'linear-gradient(135deg, #405DE6, #833AB4)',
        'linear-gradient(135deg, #F77737, #FCAF45)',
        'linear-gradient(135deg, #7C3AED, #E1306C)',
    ];

    const emojis = ['🚀', '📸', '💬', '🎯', '✨', '🔥', '💝', '🔑'];

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2>캠페인</h2>
                    <p>댓글 트리거 기반 자동 DM 캠페인을 관리하세요</p>
                </div>
                <Link href="/campaigns/new" className="btn btn-primary">
                    ＋ 새 캠페인
                </Link>
            </div>

            {loading ? (
                <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '24px', animation: 'pulse 1.5s infinite' }}>⏳</div>
                </div>
            ) : campaigns.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon">🚀</div>
                        <h3>아직 캠페인이 없습니다</h3>
                        <p>첫 번째 자동 DM 캠페인을 만들어보세요</p>
                        <Link href="/campaigns/new" className="btn btn-primary">
                            ＋ 새 캠페인 만들기
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="campaigns-grid">
                    {campaigns.map((c, idx) => (
                        <Link href={`/campaigns/${c.id}`} key={c.id}>
                            <div className="campaign-card">
                                <div className="campaign-card-media" style={{
                                    background: gradients[idx % gradients.length],
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '48px',
                                }}>
                                    {emojis[idx % emojis.length]}
                                    <span className={`campaign-card-badge ${c.is_active ? 'active' : 'paused'}`}>
                                        {c.is_active ? '🟢 활성' : '⏸ 일시정지'}
                                    </span>
                                </div>
                                <div className="campaign-card-body">
                                    <div className="campaign-card-name">{c.name}</div>
                                    <div className="campaign-card-meta">
                                        <span className="campaign-card-meta-item">📨 DM {c.sent_dms || 0}</span>
                                        <span className="campaign-card-meta-item">📅 {c.created_at?.split('T')[0] || c.created_at}</span>
                                    </div>
                                    <div className="campaign-card-tags">
                                        {c.trigger_type === 'keyword' && (
                                            <span className="tag tag-keyword">🔤 키워드: {(c.keywords || []).join(', ')}</span>
                                        )}
                                        {c.trigger_type === 'all' && (
                                            <span className="tag tag-keyword">💬 모든 댓글</span>
                                        )}
                                        {c.check_follower ? (
                                            <span className="tag tag-follower">👥 팔로우 체크</span>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
