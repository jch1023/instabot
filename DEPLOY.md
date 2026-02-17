# Instagram DM Bot - NAS Deployment Guide

이 가이드는 GitHub Actions를 통해 Docker 이미지를 자동으로 빌드하고, NAS(Synology/QNAP)에서 실행하는 방법을 안내합니다.

## 1. GitHub 저장소 설정 (로컬 PC)

1.  GitHub에 새 Repository를 생성합니다 (e.g., `instagram-dm-bot`).
2.  로컬 프로젝트 폴더에서 Git 초기화 및 파일 업로드:

    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    git branch -M main
    git remote add origin https://github.com/USERNAME/REPO_NAME.git
    git push -u origin main
    ```

3.  **GitHub Actions 자동 실행**:
    - 코드가 푸시되면 `.github/workflows/deploy.yml`에 의해 자동으로 Docker 이미지가 빌드됩니다.
    - GitHub 저장소의 **Actions** 탭에서 빌드 상태를 확인하세요.
    - 빌드가 완료되면 **Packages** 탭에 이미지가 생성됩니다.

---

## 2. Docker 이미지 주소 확인 (GitHub)

1.  GitHub 저장소 메인 페이지 우측 **Packages** 섹션 클릭
2.  이미지 주소 복사 (예: `ghcr.io/username/repo-name:latest`)

---

## 3. NAS 설정 (Docker 실행)

NAS(Synology/QNAP)에 접속하여 배포합니다.

### A. 파일 준비
NAS의 원하는 폴더(예: `/docker/instagram-bot`)에 `docker-compose.yml` 파일을 업로드합니다.

### B. docker-compose.yml 수정
업로드한 파일을 열어 **이미지 주소**와 **도메인**을 수정합니다.

```yaml
services:
  app:
    # ⚠️ 1. GitHub 이미지 주소로 변경
    image: ghcr.io/USERNAME/REPO_NAME:latest 
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      # ⚠️ 2. 본인의 도메인 주소 입력 (Webhook URL 생성용)
      - NEXT_PUBLIC_BASE_URL=https://nas.mydomain.com
      - WEBHOOK_VERIFY_TOKEN=instabot_verify_2026
```

### C. 컨테이너 실행

**방법 1: SSH 접속 (권장)**
NAS에 SSH로 접속하여 해당 폴더로 이동 후 실행합니다.

```bash
cd /volume1/docker/instagram-bot
docker-compose pull  # 최신 이미지 받기
docker-compose up -d # 백그라운드 실행
```

**방법 2: NAS 웹 매니저 (Synology Container Manager)**
1.  **프로젝트(Project)** 메뉴 -> **생성**
2.  경로: 방금 `docker-compose.yml`을 올린 폴더 선택
3.  소스: `docker-compose.yml` 사용
4.  **다음** -> **완료** (이미지 빌드/실행 자동 진행)

---

## 4. Webhook 설정 (최종 단계)

앱이 실행되면 **Meta 개발자 포털**에서 Webhook URL을 NAS 주소로 변경해야 합니다.

1.  **Meta Developers** -> **Webhooks** -> **Instagram**
2.  **Callback URL**: `https://YOUR-NAS-DOMAIN.com/api/webhook`
3.  **Verify Token**: `instabot_verify_2026`
4.  **필수**: `comments` 필드 구독 확인

---

## 5. (중요) 캠페인 모드 설정

앱 접속 주소: `http://YOUR-NAS-IP:3000`

1.  **새 캠페인 생성** 또는 기존 캠페인 수정
2.  **실행 모드 (Execution Mode)** 선택:
    - **Webhook (실시간)**: 도메인 설정 및 Webhook 구독이 완벽할 때 사용 (리소스 절약).
    - **Polling (주기적 호출)**: Webhook 설정이 어렵거나 불안정할 때 사용 (30초마다 확인, 가장 안정적).
