# 시놀로지 NAS 보안 배포 가이드 (Private Repository)

이 가이드는 GitHub 리포지토리를 **비공개(Private)**로 유지하면서, 시놀로지 NAS가 권한을 가지고 안전하게 이미지를 다운로드받는 방법입니다.

---

## 1단계: NAS용 GitHub 토큰 발급 (PC에서 진행)

NAS가 GitHub에 로그인할 때 사용할 **전용 비밀번호(Personal Access Token)**를 만듭니다.

1.  [GitHub 토큰 생성 페이지](https://github.com/settings/tokens/new?scopes=read:packages&description=SynologyNAS) 접속 (로그인 필요)
2.  **Note**에 `SynologyNAS` 입력 (이미 입력되어 있음)
3.  **Select scopes**에서 `read:packages`가 체크되어 있는지 확인 (필수!)
4.  맨 아래 **Generate token** 클릭
5.  **`ghp_`로 시작하는 토큰을 복사**하여 메모장에 저장하세요. (다시 볼 수 없습니다!)

---

## 2단계: 시놀로지 NAS에 토큰 등록

1.  시놀로지 NAS 접속 -> **Container Manager** (또는 Docker) 실행
2.  좌측 메뉴 **레지스트리 (Registry)** 클릭
3.  상단 **설정 (Settings)** -> **추가 (Add)** 클릭
4.  정보 입력:
    *   **레지스트리 이름**: `GitHub` (자유롭게 입력)
    *   **레지스트리 URL**: `https://ghcr.io`
    *   **사용자 이름**: 본인의 GitHub ID (`jch1023`)
    *   **패스워드**: **(1단계에서 복사한 ghp_ 토큰 붙여넣기)**
5.  **확인** -> **적용** 클릭. (상태가 '정상'인지 확인)

---

## 3단계: 배포 실행 (프로젝트 생성)

이제 NAS가 권한을 얻었으므로, 비공개 이미지를 가져올 수 있습니다.

1.  **File Station**을 열고 `docker/instagram-bot` 폴더에 `docker-compose.yml` 파일을 업로드합니다.
2.  **Container Manager** -> **프로젝트 (Project)** -> **생성 (Create)** 클릭
3.  **프로젝트 이름**: `instagram-bot`
4.  **경로**: `docker/instagram-bot` 폴더 선택
5.  **소스**: 기존 docker-compose.yml 사용 선택
6.  **다음** -> **다음** -> **완료**

---

## 4단계: 보안 환경변수 설정 (선택 사항)

더 높은 보안을 원한다면 `docker-compose.yml` 파일 안에 있는 토큰 값을 지우고, 대신 NAS 설정 화면에서 환경변수로 등록할 수 있습니다.

**방법:**
1.  Container Manager -> **컨테이너** -> 해당 컨테이너(`instagram-dm-bot`) 클릭
2.  **중지** 클릭
3.  **설정** -> **고급 설정** -> **환경** 탭
4.  여기서 `WEBHOOK_VERIFY_TOKEN`, `INSTAGRAM_ACCESS_TOKEN` 등을 직접 입력/수정
5.  저장 후 **실행**

---

### ✅ 이제 안전하게 배포되었습니다!
외부에서는 리포지토리에 접근할 수 없으며, 오직 인증된 NAS만 이미지를 가져갈 수 있습니다.
