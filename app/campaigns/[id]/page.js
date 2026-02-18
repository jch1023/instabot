'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function CampaignEditorPage() {
    const params = useParams();
    const router = useRouter();
    const isNew = params.id === 'new';

    const [campaign, setCampaign] = useState({
        name: '',
        igMediaId: '',
        igMediaUrl: '',
        igMediaCaption: '',
        triggerType: 'all',
        keywords: '',
        checkFollower: false,
        isActive: true,
        dmDefault: '',
        dmFollower: '',
        dmNonFollower: '',
        ctaFollowerEnabled: false,
        ctaFollowerButtonText: '팔로워 확인했어요',
        ctaFollowerPayload: 'FOLLOWER_RECHECK',
        ctaFollowerPrompt: '아래 버튼을 눌러 진행해주세요.',
        ctaNonFollowerEnabled: true,
        ctaNonFollowerButtonText: '팔로우 했어요',
        ctaNonFollowerPayload: 'FOLLOW_RECHECK',
        ctaNonFollowerPrompt: '아래 버튼을 눌러 팔로우 상태를 다시 확인해주세요.',
        executionMode: 'polling',
    });

    const [activeTab, setActiveTab] = useState('default');
    const [saving, setSaving] = useState(false);
    const [mediaPosts, setMediaPosts] = useState([]);
    const [loadingMedia, setLoadingMedia] = useState(true);

    // Load campaign data (if editing)
    useEffect(() => {
        if (!isNew) {
            fetch(`/api/campaigns/${params.id}`)
                .then(r => r.json())
                .then(data => {
                    if (data && !data.error) {
                        setCampaign({
                            name: data.name || '',
                            igMediaId: data.ig_media_id || '',
                            igMediaUrl: data.ig_media_url || '',
                            igMediaCaption: data.ig_media_caption || '',
                            triggerType: data.trigger_type || 'all',
                            keywords: (data.keywords || []).join(', '),
                            checkFollower: !!data.check_follower,
                            isActive: !!data.is_active,
                            dmDefault: data.dm_default || '',
                            dmFollower: data.dm_follower || '',
                            dmNonFollower: data.dm_non_follower || '',
                            ctaFollowerEnabled: data.cta_follower_enabled === 1,
                            ctaFollowerButtonText: data.cta_follower_button_text || '팔로워 확인했어요',
                            ctaFollowerPayload: data.cta_follower_payload || 'FOLLOWER_RECHECK',
                            ctaFollowerPrompt: data.cta_follower_prompt || '아래 버튼을 눌러 진행해주세요.',
                            ctaNonFollowerEnabled: data.cta_non_follower_enabled !== 0,
                            ctaNonFollowerButtonText: data.cta_non_follower_button_text || '팔로우 했어요',
                            ctaNonFollowerPayload: data.cta_non_follower_payload || 'FOLLOW_RECHECK',
                            ctaNonFollowerPrompt: data.cta_non_follower_prompt || '아래 버튼을 눌러 팔로우 상태를 다시 확인해주세요.',
                            executionMode: data.execution_mode || 'polling',
                        });
                        if (data.check_follower) setActiveTab('follower');
                    }
                })
                .catch(console.error);
        }
    }, [isNew, params.id]);

    // Load Instagram media posts
    useEffect(() => {
        setLoadingMedia(true);
        fetch('/api/instagram/media')
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setMediaPosts(data);
                }
            })
            .catch(console.error)
            .finally(() => setLoadingMedia(false));
    }, []);

    const updateField = (field, value) => {
        setCampaign(prev => ({ ...prev, [field]: value }));
    };

    const handleMediaSelect = (mediaId) => {
        if (mediaId === 'all') {
            updateField('igMediaId', '');
            updateField('igMediaUrl', '');
            updateField('igMediaCaption', '');
        } else {
            const post = mediaPosts.find(m => m.id === mediaId);
            if (post) {
                updateField('igMediaId', post.id);
                updateField('igMediaUrl', post.media_url || post.thumbnail_url || '');
                updateField('igMediaCaption', (post.caption || '').slice(0, 100));
            }
        }
    };

    const handleSave = async () => {
        if (!campaign.name.trim()) {
            alert('캠페인 이름을 입력하세요');
            return;
        }
        setSaving(true);

        const payload = {
            name: campaign.name,
            ig_media_id: campaign.igMediaId || null,
            ig_media_url: campaign.igMediaUrl || null,
            ig_media_caption: campaign.igMediaCaption || null,
            trigger_type: campaign.triggerType,
            keywords: campaign.keywords.split(',').map(k => k.trim()).filter(Boolean),
            check_follower: campaign.checkFollower,
            dm_default: campaign.dmDefault,
            dm_follower: campaign.dmFollower,
            dm_non_follower: campaign.dmNonFollower,
            cta_follower_enabled: campaign.ctaFollowerEnabled,
            cta_follower_button_text: campaign.ctaFollowerButtonText,
            cta_follower_payload: campaign.ctaFollowerPayload,
            cta_follower_prompt: campaign.ctaFollowerPrompt,
            cta_non_follower_enabled: campaign.ctaNonFollowerEnabled,
            cta_non_follower_button_text: campaign.ctaNonFollowerButtonText,
            cta_non_follower_payload: campaign.ctaNonFollowerPayload,
            cta_non_follower_prompt: campaign.ctaNonFollowerPrompt,
            is_active: campaign.isActive,
            execution_mode: campaign.executionMode,
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

    // Get selected post info for display
    const selectedPost = mediaPosts.find(m => m.id === campaign.igMediaId);

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

            <div className="editor-grid">
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

                        {/* Post Selection */}
                        <div className="form-group">
                            <label className="form-label">게시물 선택</label>
                            {loadingMedia ? (
                                <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                    ⏳ Instagram 게시물 불러오는 중...
                                </div>
                            ) : (
                                <>
                                    <select
                                        className="form-select"
                                        value={campaign.igMediaId || 'all'}
                                        onChange={e => handleMediaSelect(e.target.value)}
                                    >
                                        <option value="all">📋 모든 게시물 (전체 적용)</option>
                                        {mediaPosts.map(post => (
                                            <option key={post.id} value={post.id}>
                                                {post.media_type === 'VIDEO' ? '🎬' : '📸'}{' '}
                                                {(post.caption || '캡션 없음').slice(0, 50)}
                                                {(post.caption || '').length > 50 ? '...' : ''}{' '}
                                                ({new Date(post.timestamp).toLocaleDateString('ko-KR')})
                                            </option>
                                        ))}
                                    </select>

                                    {/* Selected post thumbnail */}
                                    {selectedPost && (
                                        <div className="animate-fade-in" style={{
                                            marginTop: '10px', display: 'flex', gap: '12px', alignItems: 'center',
                                            padding: '10px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
                                            border: '1px solid var(--border)',
                                        }}>
                                            {(selectedPost.media_url || selectedPost.thumbnail_url) && (
                                                <img
                                                    src={selectedPost.thumbnail_url || selectedPost.media_url}
                                                    alt="선택된 게시물"
                                                    style={{
                                                        width: '60px', height: '60px', borderRadius: '8px',
                                                        objectFit: 'cover', flexShrink: 0,
                                                    }}
                                                />
                                            )}
                                            <div style={{ overflow: 'hidden' }}>
                                                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>
                                                    {selectedPost.media_type === 'VIDEO' ? '🎬 릴스/영상' : '📸 이미지'}
                                                </div>
                                                <div style={{
                                                    fontSize: '12px', color: 'var(--text-secondary)',
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                }}>
                                                    {selectedPost.caption || '캡션 없음'}
                                                </div>
                                                <a href={selectedPost.permalink} target="_blank" rel="noopener"
                                                    style={{ fontSize: '11px', color: 'var(--primary-light)' }}>
                                                    Instagram에서 보기 ↗
                                                </a>
                                            </div>
                                        </div>
                                    )}

                                    {mediaPosts.length === 0 && (
                                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                                            ⚠️ 게시물을 불러올 수 없습니다. 설정 페이지에서 Instagram 연결을 확인하세요.
                                        </div>
                                    )}
                                </>
                            )}
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
                                💡 <strong>팔로우 체크 방식:</strong> 댓글 시점에는 비팔로워/미확인 DM(+CTA 버튼)을 보내고, 사용자가 CTA를 누르면 팔로워 여부를 다시 확인해 후속 DM을 전송합니다.
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
                                사용 가능한 변수: {'{username}'} = 댓글 작성자 username, {'{comment}'} = 댓글 내용
                            </div>
                        </div>

                        {campaign.checkFollower && (
                            <div className="animate-fade-in" style={{ marginTop: '14px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>CTA 버튼 설정</div>

                                <div className="toggle-wrapper" style={{ marginBottom: '12px', padding: '10px 12px' }}>
                                    <div className="toggle-info">
                                        <div className="toggle-title">CTA 버튼 첨부</div>
                                        <div className="toggle-desc">
                                            {activeTab === 'follower'
                                                ? '팔로워용 DM에 CTA 트리거 문구를 추가합니다'
                                                : '비팔로워용 DM에 CTA 트리거 문구를 추가합니다'}
                                        </div>
                                    </div>
                                    <label className="toggle">
                                        <input
                                            type="checkbox"
                                            checked={activeTab === 'follower' ? campaign.ctaFollowerEnabled : campaign.ctaNonFollowerEnabled}
                                            onChange={e => {
                                                if (activeTab === 'follower') updateField('ctaFollowerEnabled', e.target.checked);
                                                else updateField('ctaNonFollowerEnabled', e.target.checked);
                                            }}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">버튼 텍스트</label>
                                        <input
                                            className="form-input"
                                            maxLength={20}
                                            value={activeTab === 'follower' ? campaign.ctaFollowerButtonText : campaign.ctaNonFollowerButtonText}
                                            onChange={e => {
                                                if (activeTab === 'follower') updateField('ctaFollowerButtonText', e.target.value);
                                                else updateField('ctaNonFollowerButtonText', e.target.value);
                                            }}
                                            placeholder="팔로우 했어요"
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Payload / URL</label>
                                        <input
                                            className="form-input"
                                            value={activeTab === 'follower' ? campaign.ctaFollowerPayload : campaign.ctaNonFollowerPayload}
                                            onChange={e => {
                                                if (activeTab === 'follower') updateField('ctaFollowerPayload', e.target.value);
                                                else updateField('ctaNonFollowerPayload', e.target.value);
                                            }}
                                            placeholder="FOLLOW_RECHECK 또는 https://..."
                                        />
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginTop: '10px', marginBottom: 0 }}>
                                    <label className="form-label">CTA 안내 문구</label>
                                    <input
                                        className="form-input"
                                        value={activeTab === 'follower' ? campaign.ctaFollowerPrompt : campaign.ctaNonFollowerPrompt}
                                        onChange={e => {
                                            if (activeTab === 'follower') updateField('ctaFollowerPrompt', e.target.value);
                                            else updateField('ctaNonFollowerPrompt', e.target.value);
                                        }}
                                        placeholder="아래 버튼을 눌러 진행해주세요."
                                    />
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
                                    URL을 넣으면 링크 버튼으로 전송되고, 일반 텍스트를 넣으면 DM 재확인용 Payload로 처리됩니다.
                                </div>
                            </div>
                        )}
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
                            {campaign.checkFollower && (
                                ((activeTab === 'follower' && campaign.ctaFollowerEnabled) ||
                                    (activeTab !== 'follower' && campaign.ctaNonFollowerEnabled))
                            ) && (
                                <div style={{
                                    marginTop: '8px',
                                    display: 'inline-block',
                                    fontSize: '12px',
                                    padding: '7px 10px',
                                    borderRadius: '999px',
                                    border: '1px solid var(--primary)',
                                    color: 'var(--primary-light)',
                                    background: 'rgba(59,130,246,0.08)'
                                }}>
                                    {activeTab === 'follower'
                                        ? (campaign.ctaFollowerButtonText || '팔로워 확인했어요')
                                        : (campaign.ctaNonFollowerButtonText || '팔로우 했어요')}
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: '16px', padding: '14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>📋 캠페인 요약</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                                <div>• 게시물: {campaign.igMediaId ? (selectedPost ? `${(selectedPost.caption || '').slice(0, 30)}...` : campaign.igMediaId) : '모든 게시물'}</div>
                                <div>• 트리거: {campaign.triggerType === 'all' ? '모든 댓글' : `키워드 (${campaign.keywords || '미설정'})`}</div>
                                <div>• 팔로우 체크: {campaign.checkFollower ? '✅ ON' : '❌ OFF'}</div>
                                {campaign.checkFollower ? (
                                    <>
                                        <div>• 팔로워 DM: {campaign.dmFollower ? '✅ 설정됨' : '⚠️ 미설정'}</div>
                                        <div>• 비팔로워 DM: {campaign.dmNonFollower ? '✅ 설정됨' : '⚠️ 미설정'}</div>
                                        <div>• 팔로워 CTA: {campaign.ctaFollowerEnabled ? `✅ ${campaign.ctaFollowerButtonText || '팔로워 확인했어요'}` : '❌ 사용 안 함'}</div>
                                        <div>• 비팔로워 CTA: {campaign.ctaNonFollowerEnabled ? `✅ ${campaign.ctaNonFollowerButtonText || '팔로우 했어요'}` : '❌ 사용 안 함'}</div>
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
