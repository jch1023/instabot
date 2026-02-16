'use client';
import { useState, useEffect } from 'react';

export default function SettingsPage() {
    const [connected, setConnected] = useState(false);
    const [settings, setSettings] = useState({
        meta_app_id: '',
        meta_app_secret: '',
        webhook_verify_token: '',
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch('/api/settings')
            .then(r => r.json())
            .then(data => {
                if (data && !data.error) setSettings(data);
            })
            .catch(console.error);
    }, []);

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';
    const webhookUrl = `${baseUrl}/api/webhook`;

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
            if (res.ok) {
                alert('설정이 저장되었습니다! ✅');
            } else {
                alert('저장 실패');
            }
        } catch (error) {
            alert('저장 실패: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert('클립보드에 복사되었습니다! 📋');
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <h2>설정</h2>
                <p>Instagram 연결 및 서비스 설정을 관리하세요</p>
            </div>

            {/* Instagram Account Connection */}
            <div className="settings-section">
                <div className="settings-section-title">📸 Instagram 계정 연결</div>
                <div className="card">
                    {connected ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <div style={{
                                    width: '52px', height: '52px', borderRadius: '50%',
                                    background: 'linear-gradient(135deg, var(--ig-purple), var(--ig-pink), var(--ig-orange))',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '22px', fontWeight: 700, color: 'white'
                                }}>B</div>
                                <div>
                                    <div style={{ fontSize: '16px', fontWeight: 600 }}>@blankerfactory</div>
                                    <div style={{ fontSize: '13px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }}></span>
                                        연결됨 · Business 계정
                                    </div>
                                </div>
                            </div>
                            <button className="btn btn-danger btn-sm" onClick={() => setConnected(false)}>연결 해제</button>
                        </div>
                    ) : (
                        <div className="empty-state" style={{ padding: '30px' }}>
                            <div className="empty-state-icon">📸</div>
                            <h3>Instagram 계정을 연결하세요</h3>
                            <p>Meta OAuth를 통해 비즈니스 계정을 연결합니다.<br />먼저 아래 Meta App 설정을 완료해주세요.</p>
                            <button className="btn btn-primary" onClick={() => {
                                if (!settings.meta_app_id) {
                                    alert('먼저 Meta App ID를 입력해주세요');
                                    return;
                                }
                                // OAuth flow would start here
                                setConnected(true);
                            }}>
                                Instagram 연결하기
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Webhook Settings */}
            <div className="settings-section">
                <div className="settings-section-title">🔗 Webhook 설정</div>
                <div className="card">
                    <div style={{ marginBottom: '14px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        <a href="https://developers.facebook.com" target="_blank" rel="noopener" style={{ color: 'var(--primary-light)', textDecoration: 'underline' }}>Meta 개발자 대시보드</a>에서 아래 정보를 Webhook 설정에 등록하세요.
                    </div>

                    <div className="form-group">
                        <label className="form-label">Callback URL</label>
                        <div className="webhook-url-box">
                            <code>{webhookUrl}</code>
                            <button className="btn btn-secondary btn-sm" onClick={() => copyToClipboard(webhookUrl)}>📋 복사</button>
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Verify Token</label>
                        <div className="webhook-url-box">
                            <code>{settings.webhook_verify_token}</code>
                            <button className="btn btn-secondary btn-sm" onClick={() => copyToClipboard(settings.webhook_verify_token)}>📋 복사</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* API Settings */}
            <div className="settings-section">
                <div className="settings-section-title">🔑 Meta App 설정</div>
                <div className="card">
                    <div className="form-group">
                        <label className="form-label">App ID</label>
                        <input
                            className="form-input"
                            placeholder="Meta App ID를 입력하세요"
                            value={settings.meta_app_id}
                            onChange={e => setSettings(prev => ({ ...prev, meta_app_id: e.target.value }))}
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">App Secret</label>
                        <input
                            className="form-input"
                            placeholder="Meta App Secret을 입력하세요"
                            value={settings.meta_app_secret}
                            onChange={e => setSettings(prev => ({ ...prev, meta_app_secret: e.target.value }))}
                            type="password"
                        />
                    </div>
                </div>
            </div>

            {/* Rate Limits Info */}
            <div className="settings-section">
                <div className="settings-section-title">⚠️ Instagram API 제한사항</div>
                <div className="card">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={{ padding: '14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>DM 발송 제한</div>
                            <div style={{ fontSize: '20px', fontWeight: 700 }}>200 <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-secondary)' }}>/ 시간</span></div>
                        </div>
                        <div style={{ padding: '14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Private Reply 유효기간</div>
                            <div style={{ fontSize: '20px', fontWeight: 700 }}>7일 <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-secondary)' }}>/ 댓글</span></div>
                        </div>
                        <div style={{ padding: '14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>메시징 윈도우</div>
                            <div style={{ fontSize: '20px', fontWeight: 700 }}>24시간 <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-secondary)' }}>/ 대화</span></div>
                        </div>
                        <div style={{ padding: '14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>필요 권한</div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary-light)' }}>instagram_business_manage_messages<br />instagram_manage_comments</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Save */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? '⏳ 저장 중...' : '💾 설정 저장'}
                </button>
            </div>
        </div>
    );
}
