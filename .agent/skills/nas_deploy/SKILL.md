---
name: nas_deploy
description: Deploy Docker containers to Synology NAS (GitHub -> GHCR -> NAS)
---

# Synology NAS Deployment Guide

이 스킬은 **GitHub Actions**를 통해 빌드된 Docker 이미지를 **Synology NAS**에 배포하는 절차를 안내합니다.

## 🔧 1. NAS Connection Info
*(자주 사용하는 NAS 정보를 여기에 기록해두고 복사해서 쓰세요)*

- **NAS 주소 (Domain)**: `justmobile.synology.me` (외부 접속용)
- **외부 IP**: `118.32.105.92`
- **SSH 접속 명령**: `ssh 사용자ID@justmobile.synology.me -p 22`
- **Docker 데이터 경로**: `/volume1/docker/instagram-bot`

---

## 📦 2. GitHub Configuration
현재 프로젝트의 배포 설정입니다.

- **Repository**: `jch1023/instabot`
- **Image URL**: `ghcr.io/jch1023/instabot:latest`
- **Visibility**: Public (로그인 불필요)

---

## 🚀 3. One-Line Deploy Command (SSH)
NAS에 SSH로 접속한 뒤, 아래 명령어를 한 번에 붙여넣으면 최신 버전으로 재배포됩니다.
(기존 컨테이너 삭제 -> 이미지 풀 -> 재실행)

```bash
# 1. 이동
cd /volume1/docker/instagram-bot

# 2. 최신 이미지 다운로드
sudo docker pull ghcr.io/jch1023/instabot:latest

# 3. 기존 컨테이너 중지 및 삭제
sudo docker stop instagram-dm-bot
sudo docker rm instagram-dm-bot

# 4. 새 컨테이너 실행 (환경변수 포함)
sudo docker run -d \
  --name instagram-dm-bot \
  --restart unless-stopped \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e NODE_ENV=production \
  -e WEBHOOK_VERIFY_TOKEN=instabot_verify_2026 \
  -e NEXT_PUBLIC_BASE_URL=https://내도메인입력 \
  ghcr.io/jch1023/instabot:latest
```

---

## 📝 4. 트러블슈팅
- **권한 오류**: `sudo`를 앞에 붙였는지 확인하세요.
- **포트 충돌**: `3000` 포트가 이미 사용 중이라면 `-p 3001:3000`으로 변경하세요.
