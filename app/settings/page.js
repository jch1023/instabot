'use client';
import { useState, useEffect } from 'react';

export default function SettingsPage() {
    const [igProfile, setIgProfile] = useState(null);
    const [verifying, setVerifying] = useState(true);
    const [settings, setSettings] = useState({
        meta_app_id: '',
        meta_app_secret: '',
        webhook_verify_token: '',
        instagram_access_token: '',
    });
    const [saving, setSaving] = useState(false);
    const [showToken, setShowToken] = useState(false);

    // Load settings
    useEffect(() => {
        fetch('/api/settings')
            .then(r => r.json())
            .then(data => {
                if (data && !data.error) setSettings(prev => ({ ...prev, ...data }));
            })
            .catch(console.error);
    }, []);

    // Verify Instagram connection
    useEffect(() => {
        setVerifying(true);
        fetch('/api/settings/verify')
            .then(r => r.json())
            .then(data => {
                if (data.connected) {
                    setIgProfile(data.profile);
                } else {
                    setIgProfile(null);
                }
            })
            .catch(console.error)
            .finally(() => setVerifying(false));
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
                // Re-verify Instagram connection after saving
                const verify = await fetch('/api/settings/verify').then(r => r.json());
                if (verify.connected) {
                    setIgProfile(verify.profile);
                } else {
                    setIgProfile(null);
                }
            } else {
                alert('저장 실패');
            }
        } catch (error) {
            alert('저장 실패: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('정말 Instagram 연결을 해제하시겠습니까?')) return;
        await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instagram_access_token: '' }),
        });
        setIgProfile(null);
        setSettings(prev => ({ ...prev, instagram_access_token: '' }));
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
                    {verifying ? (
                        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                            ⏳ Instagram 연결 확인 중...
                        </div>
                    ) : igProfile ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                {igProfile.profilePicture ? (
                                    <img
                                        src={igProfile.profilePicture}
                                        alt={igProfile.username}
                                        style={{
                                            width: '52px', height: '52px', borderRadius: '50%',
                                            border: '2px solid var(--ig-pink)',
                                        }}
                                    />
                                ) : (
                                    <div style={{
                                        width: '52px', height: '52px', borderRadius: '50%',
                                        background: 'linear-gradient(135deg, var(--ig-purple), var(--ig-pink), var(--ig-orange))',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '22px', fontWeight: 700, color: 'white'
                                    }}>{igProfile.username?.charAt(0).toUpperCase()}</div>
                                )}
                                <div>
                                    <div style={{ fontSize: '16px', fontWeight: 600 }}>@{igProfile.username}</div>
                                    <div style={{ fontSize: '13px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }}></span>
                                        연결됨 · {igProfile.name}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                        팔로워 {igProfile.followersCount?.toLocaleString()}명 · 게시물 {igProfile.mediaCount}개
                                    </div>
                                </div>
                            </div>
                            <button className="btn btn-danger btn-sm" onClick={handleDisconnect}>연결 해제</button>
                        </div>
                    ) : (
                        <div className="empty-state" style={{ padding: '30px' }}>
                            <div className="empty-state-icon">📸</div>
                            <h3>Instagram 계정을 연결하세요</h3>
                            <p>아래 Access Token 필드에 Instagram 토큰을 입력하고 저장하면 자동 연결됩니다.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Access Token */}
            <div className="settings-section">
                <div className="settings-section-title">🔐 Instagram Access Token</div>
                <div className="card">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Access Token</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                className="form-input"
                                placeholder="Instagram Access Token을 붙여넣으세요"
                                value={settings.instagram_access_token}
                                onChange={e => setSettings(prev => ({ ...prev, instagram_access_token: e.target.value }))}
                                type={showToken ? 'text' : 'password'}
                                style={{ flex: 1 }}
                            />
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowToken(!showToken)}>
                                {showToken ? '🙈 숨기기' : '👁️ 보기'}
                            </button>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                            Meta 개발자 콘솔에서 발급받은 토큰을 입력하세요. 토큰은 60일마다 갱신이 필요합니다.
                        </div>
                    </div>
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
