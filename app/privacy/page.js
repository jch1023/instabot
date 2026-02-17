export default function PrivacyPage() {
    return (
        <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif', lineHeight: 1.8 }}>
            <h1>개인정보처리방침</h1>
            <p><strong>블랭커팩토리 (blankerfactory)</strong></p>
            <p>최종 수정일: 2026년 2월 17일</p>

            <h2>1. 수집하는 개인정보</h2>
            <p>본 서비스는 Instagram API를 통해 다음 정보를 처리합니다:</p>
            <ul>
                <li>Instagram 사용자명 및 프로필 정보</li>
                <li>게시물 댓글 내용</li>
                <li>다이렉트 메시지 발송 기록</li>
            </ul>

            <h2>2. 개인정보의 이용 목적</h2>
            <p>수집된 정보는 Instagram 게시물 댓글에 대한 자동 다이렉트 메시지 발송 서비스를 제공하기 위해 사용됩니다.</p>

            <h2>3. 개인정보의 보관 및 삭제</h2>
            <p>개인정보는 서비스 이용 기간 동안만 보관되며, 사용자 요청 시 즉시 삭제됩니다.</p>

            <h2>4. 제3자 제공</h2>
            <p>수집된 개인정보는 제3자에게 제공되지 않습니다.</p>

            <h2>5. 문의</h2>
            <p>개인정보 관련 문의: changho.jeong@blanker.co.kr</p>
        </div>
    );
}
