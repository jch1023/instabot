'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function CampaignEditorPage() {
    const params = useParams();
    const router = useRouter();
    const isNew = params.id === 'new';

    const [campaign, setCampaign] = useState({
        name: '',
        triggerType: 'all',
        keywords: '',
        checkFollower: false,
        isActive: true,
        dmDefault: '',
        dmFollower: '',
        dmNonFollower: '',
    });

    const [activeTab, setActiveTab] = useState('default');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isNew) {
            fetch(`/api/campaigns/${params.id}`)
                .then(r => r.json())
                .then(data => {
                    if (data && !data.error) {
                        setCampaign({
                            name: data.name || '',
                            triggerType: data.trigger_type || 'all',
                            keywords: (data.keywords || []).join(', '),
                            checkFollower: !!data.check_follower,
                            isActive: !!data.is_active,
                            dmDefault: data.dm_default || '',
                            dmFollower: data.dm_follower || '',
                            dmNonFollower: data.dm_non_follower || '',
                        });
                        if (data.check_follower) setActiveTab('follower');
                    }
                })
                .catch(console.error);
        }
    }, [isNew, params.id]);

    const updateField = (field, value) => {
        setCampaign(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        if (!campaign.name.trim()) {
            alert('캠페인 이름을 입력하세요');
            return;
        }
        setSaving(true);

        const payload = {
            name: campaign.name,
            trigger_type: campaign.triggerType,
            keywords: campaign.keywords.split(',').map(k => k.trim()).filter(Boolean),
            check_follower: campaign.checkFollower,
            dm_default: campaign.dmDefault,
            dm_follower: campaign.dmFollower,
            dm_non_follower: campaign.dmNonFollower,
            is_active: campaign.isActive,
        };

        try {
            const url = isNew ? '/api/campaigns' : `/api/campaigns/${params.id}`;
            const method = isNew ? 'POST' : 'PUT';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                router.push('/campaigns');
            } else {
                const err = await res.json();
                alert('저장 실패: ' + (err.error || '알 수 없는 오류'));
            }
        } catch (error) {
            alert('저장 실패: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('이 캠페인을 삭제하시겠습니까?')) return;
        try {
            await fetch(`/api/campaigns/${params.id}`, { method: 'DELETE' });
            router.push('/campaigns');
        } catch (error) {
            alert('삭제 실패: ' + error.message);
        }
    };

    const dmTabs = campaign.checkFollower
        ? [
            { key: 'follower', label: '👥 팔로워용 DM' },
            { key: 'non_follower', label: '👤 비팔로워용 DM' },
        ]
        : [
            { key: 'default', label: '📨 기본 DM' },
        ];

    const getCurrentDmText = () => {
        if (campaign.checkFollower) {
            return activeTab === 'follower' ? campaign.dmFollower : campaign.dmNonFollower;
        }
        return campaign.dmDefault;
    };

    const setCurrentDmText = (text) => {
        if (campaign.checkFollower) {
            if (activeTab === 'follower') updateField('dmFollower', text);
            else updateField('dmNonFollower', text);
        } else {
            updateField('dmDefault', text);
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2>{isNew ? '새 캠페인 만들기' : '캠페인 편집'}</h2>
                    <p>댓글 트리거와 자동 DM 메시지를 설정하세요</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {!isNew && (
                        <button className="btn btn-danger" onClick={handleDelete}>🗑 삭제</button>
                    )}
                    <button className="btn btn-secondary" onClick={() => router.push('/campaigns')}>취소</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? '⏳ 저장 중...' : '💾 저장'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '20px' }}>
                {/* Left: Settings */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Campaign Name */}
                    <div className="card">
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">캠페인 이름</label>
                            <input
                                className="form-input"
                                placeholder="예: 아크릴 키링 프로모션"
                                value={campaign.name}
                                onChange={e => updateField('name', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Trigger Settings */}
                    <div className="card">
                        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            💬 트리거 설정
                        </h3>

                        <div className="form-group">
                            <label className="form-label">게시물 선택</label>
                            <select className="form-select" defaultValue="">
                                <option value="" disabled>게시물을 선택하세요... (Instagram 연결 후 활성화)</option>
                                <option value="all">📋 모든 게시물 (전체 적용)</option>
                            </select>
                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                Instagram 연결 후 게시물 목록이 자동으로 표시됩니다
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">댓글 트리거 방식</label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    className={`btn ${campaign.triggerType === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => updateField('triggerType', 'all')}
                                    style={{ flex: 1 }}
                                >
                                    💬 모든 댓글
                                </button>
                                <button
                                    className={`btn ${campaign.triggerType === 'keyword' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => updateField('triggerType', 'keyword')}
                                    style={{ flex: 1 }}
                                >
                                    🔤 키워드 필터
                                </button>
                            </div>
                        </div>

                        {campaign.triggerType === 'keyword' && (
                            <div className="form-group animate-fade-in" style={{ marginBottom: 0 }}>
                                <label className="form-label">키워드 (쉼표로 구분)</label>
                                <input
                                    className="form-input"
                                    placeholder="예: 가격, 주문, 구매, 할인"
                                    value={campaign.keywords}
                                    onChange={e => updateField('keywords', e.target.value)}
                                />
                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                                    댓글에 위 키워드가 포함되면 자동으로 DM을 발송합니다
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Follower Check Toggle */}
                    <div className="card">
                        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            👥 팔로우 체크
                        </h3>

                        <div className="toggle-wrapper">
                            <div className="toggle-info">
                                <div className="toggle-title">팔로워 여부 확인</div>
                                <div className="toggle-desc">ON: 팔로워/비팔로워에게 다른 DM을 보냅니다</div>
                            </div>
                            <label className="toggle">
                                <input
                                    type="checkbox"
                                    checked={campaign.checkFollower}
                                    onChange={e => {
                                        updateField('checkFollower', e.target.checked);
                                        setActiveTab(e.target.checked ? 'follower' : 'default');
                                    }}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>

                        {campaign.checkFollower && (
                            <div className="animate-fade-in" style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                💡 <strong>팔로우 체크 방식:</strong> Instagram Followers Edge API를 사용하여 팔로워 목록을 주기적으로 동기화합니다. 팔로워에게는 특별 혜택 메시지, 비팔로워에게는 팔로우 유도 메시지를 보낼 수 있습니다.
                            </div>
                        )}
                    </div>

                    {/* DM Editor */}
                    <div className="card">
                        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            📨 DM 메시지 설정
                        </h3>

                        <div className="dm-editor-tabs">
                            {dmTabs.map(tab => (
                                <button
                                    key={tab.key}
                                    className={`dm-editor-tab ${activeTab === tab.key ? 'active' : ''}`}
                                    onClick={() => setActiveTab(tab.key)}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <textarea
                                className="form-textarea"
                                placeholder={campaign.checkFollower
                                    ? (activeTab === 'follower'
                                        ? '팔로워에게 보낼 메시지를 입력하세요...\n\n예: 안녕하세요! 늘 팔로우해주셔서 감사해요 💜\n팔로워 전용 10% 할인 코드를 보내드릴게요!'
                                        : '비팔로워에게 보낼 메시지를 입력하세요...\n\n예: 안녕하세요! 저희를 팔로우하시면 특별 혜택을 받으실 수 있어요!')
                                    : '자동으로 전송될 DM 메시지를 입력하세요...\n\n예: 안녕하세요! 블랭커팩토리입니다 😊\n문의해주셔서 감사합니다.'}
                                value={getCurrentDmText()}
                                onChange={e => setCurrentDmText(e.target.value)}
                                rows={6}
                            />
                            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                                사용 가능한 변수: {'{username}'} = 댓글 작성자 ID, {'{comment}'} = 댓글 내용
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Preview */}
                <div style={{ position: 'sticky', top: '32px', height: 'fit-content' }}>
                    <div className="card">
                        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
                            📱 DM 미리보기
                        </h3>

                        <div className="dm-preview">
                            <div className="dm-preview-header">
                                <div className="dm-preview-avatar"></div>
                                <div>
                                    <div className="dm-preview-name">blankerfactory</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>비즈니스 계정</div>
                                </div>
                            </div>
                            <div className="dm-bubble">
                                {getCurrentDmText() || '메시지를 입력하면 여기에 미리보기가 표시됩니다'}
                            </div>
                        </div>

                        <div style={{ marginTop: '16px', padding: '14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>📋 캠페인 요약</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                                <div>• 트리거: {campaign.triggerType === 'all' ? '모든 댓글' : `키워드 (${campaign.keywords || '미설정'})`}</div>
                                <div>• 팔로우 체크: {campaign.checkFollower ? '✅ ON' : '❌ OFF'}</div>
                                {campaign.checkFollower ? (
                                    <>
                                        <div>• 팔로워 DM: {campaign.dmFollower ? '✅ 설정됨' : '⚠️ 미설정'}</div>
                                        <div>• 비팔로워 DM: {campaign.dmNonFollower ? '✅ 설정됨' : '⚠️ 미설정'}</div>
                                    </>
                                ) : (
                                    <div>• 기본 DM: {campaign.dmDefault ? '✅ 설정됨' : '⚠️ 미설정'}</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Campaign Status */}
                    {!isNew && (
                        <div className="card" style={{ marginTop: '16px' }}>
                            <div className="toggle-wrapper" style={{ background: 'transparent', border: 'none', padding: 0 }}>
                                <div className="toggle-info">
                                    <div className="toggle-title">캠페인 활성화</div>
                                    <div className="toggle-desc">{campaign.isActive ? '현재 댓글을 감지하고 있습니다' : '일시 중지 상태입니다'}</div>
                                </div>
                                <label className="toggle">
                                    <input
                                        type="checkbox"
                                        checked={campaign.isActive}
                                        onChange={e => updateField('isActive', e.target.checked)}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
