
// Usage: node test-real-id.js <ACCESS_TOKEN> <MY_IG_ID> <SHORTCODE>
// Example: node test-real-id.js EAANH... 1784... DN4S6QvlUlQ

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

const args = process.argv.slice(2);
const accessToken = args[0];
const myIgId = args[1];
const targetShortcode = args[2] || 'DN4S6QvlUlQ'; // 기본값

if (!accessToken || !myIgId) {
    console.error('❌ 사용법: node test-real-id.js <ACCESS_TOKEN> <MY_IG_ID> [SHORTCODE]');
    process.exit(1);
}

async function findRealIdAndCheck() {
    try {
        console.log(`🔍 1. 내 게시물(Media)에서 '${targetShortcode}' 찾는 중...`);

        // shortcode 필드도 함께 요청
        const mediaUrl = `${GRAPH_API_BASE}/${myIgId}/media?fields=id,shortcode,caption&limit=50&access_token=${accessToken}`;
        const mediaRes = await fetch(mediaUrl);
        const mediaData = await mediaRes.json();

        if (!mediaData.data || mediaData.data.length === 0) {
            console.error('❌ 게시물이 하나도 없습니다.');
            return;
        }

        // Shortcode로 매칭되는 게시물 찾기
        const targetMedia = mediaData.data.find(m => m.shortcode === targetShortcode);

        if (!targetMedia) {
            console.error(`❌ 찾을 수 없음: Shortcode '${targetShortcode}'에 해당하는 게시물이 최근 50개 중에 없습니다.`);
            console.log('   (참고: 최신 게시물 목록)');
            mediaData.data.slice(0, 3).forEach(m => console.log(`   - [${m.shortcode}] ${m.caption?.substring(0, 20)}...`));
            return;
        }

        console.log(`✅ 게시물 발견! ID: ${targetMedia.id} (내용: ${targetMedia.caption?.substring(0, 20)}...)`);

        // 2. 게시물의 댓글 조회
        console.log(`\n🔍 2. 게시물 댓글 조회 중...`);
        const commentUrl = `${GRAPH_API_BASE}/${targetMedia.id}/comments?fields=id,text,from{id,username}&limit=5&access_token=${accessToken}`;
        const commentRes = await fetch(commentUrl);
        const commentData = await commentRes.json();

        if (!commentData.data || commentData.data.length === 0) {
            console.error('❌ 이 게시물에 댓글이 없습니다. 테스트 불가.');
            return;
        }

        // 3. 첫 번째 댓글 작성자로 테스트
        const targetUser = commentData.data[0].from;
        console.log(`✅ 댓글 발견! 작성자: @${targetUser.username} (ID: ${targetUser.id})`);

        // 4. 드디어 팔로우 여부 체크
        console.log(`\n🔍 3. 팔로우 여부 체크 (최종)`);
        const fieldUrl = `${GRAPH_API_BASE}/${targetUser.id}?fields=name,username,is_user_follow_business,is_business_follow_user&access_token=${accessToken}`;
        const checkRes = await fetch(fieldUrl);
        const checkData = await checkRes.json();

        if (checkData.error) {
            console.error(`❌ 최종 조회 실패:`, JSON.stringify(checkData.error, null, 2));
            if (checkData.error.code === 100) console.error("   -> [원인] ID가 Page-Scoped가 아닙니다. (웹훅 앱 설정 문제일 수 있음)");
            if (checkData.error.code === 230) console.error("   -> [원인] 앱 권한/Live 모드 문제 (User Consent)");
        } else {
            console.log(`🎉 성공! 팔로우 여부 확인됨:`);
            console.log(`   - 사용자: @${checkData.username} (${checkData.name})`);
            console.log(`   - ID: ${checkData.id}`);
            console.log(`   - 내 계정 팔로우 중?: ${checkData.is_user_follow_business ? '⭕ YES (팔로워)' : '❌ NO (비팔로워)'}`);
        }

    } catch (e) {
        console.error('❌ 실행 중 에러:', e.message);
    }
}

findRealIdAndCheck();
