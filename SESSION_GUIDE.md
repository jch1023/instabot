# SESSION GUIDE (BLANKER BOT)

## 1) 현재 상태 요약
- 프로젝트: `instagram-dm-bot`
- 기본 브랜치: `main`
- 최근 배포 완료 커밋: `13c00d5`
- 현재 워크트리: clean (수정 없음)

## 2) 최근 반영된 핵심 변경
- 브랜드명 변경: `BLANKER BOT`
  - 로그인/앱 메타/사이드바 반영
- 로그인 화면 리디자인
  - 파일: `app/login/page.js`, `app/login/layout.js`, `app/login/LoginBodyClass.js`, `app/globals.css`
- 사이드바 메뉴 숨김
  - 숨김: `개별 DM 발송`, `팔로워 목록`
  - 파일: `app/components/Sidebar.js`
- CTA/DM 동작 조정
  - CTA 안내 문구/버튼 텍스트 공란 저장 유지
  - 저장 후 캠페인 편집 화면 유지
  - 팔로우 여부: 실시간 API 확인 우선
  - DM: 1회 전송 + 템플릿 버튼(버블 내부) 방식
  - 파일: `lib/webhook-handler.js`, `lib/db.js`, `app/campaigns/[id]/page.js`

## 3) 현재 동작 기준 (중요)
- `check_follower` 사용 시 댓글 이벤트마다 실시간 팔로우 상태를 조회함.
- CTA 사용 시 DM을 2개로 나누지 않고 1개로 전송함.
- 버튼 위치는 텍스트 버블 안쪽(템플릿 버튼) 기준으로 구현됨.
- URL CTA는 링크 버튼(`web_url`), 일반 텍스트 CTA는 `postback`으로 처리됨.

## 4) 다음 작업 시작 절차
1. 저장소 진입  
   `cd C:\Users\jeong\.gemini\antigravity\scratch\instagram-dm-bot`
2. 상태 확인  
   `git status -sb`
3. 최신 코드 동기화  
   `git pull origin main`
4. 개발 서버 실행(필요 시)  
   `npm run dev`

## 5) 자주 수정하는 파일 맵
- 캠페인 편집 UI: `app/campaigns/[id]/page.js`
- 사이드바/메뉴: `app/components/Sidebar.js`
- 로그인 UI: `app/login/page.js`
- 공통 스타일: `app/globals.css`
- 팔로우 판별/CTA 발송 핵심: `lib/webhook-handler.js`
- 캠페인 저장 로직(DB): `lib/db.js`
- 인스타 API 래퍼: `lib/instagram.js`

## 6) 변경 후 체크리스트
1. eslint 확인  
   `npx eslint "app/**/*.js" "lib/**/*.js"`
2. 핵심 시나리오 수동 확인
   - 팔로워 댓글 → 팔로워 메시지/CTA
   - 비팔로워 댓글 → 비팔로워 메시지/CTA
   - CTA 버튼 노출 위치(버블 내부) 확인
3. 커밋/배포
   - `git add -A`
   - `git commit -m "..."`  
   - `git push origin main`

## 7) 다음 지시 시 바로 쓰기 좋은 문장
- `SESSION_GUIDE.md 기준으로 이어서 작업해줘`
- `CTA 버튼 동작만 다시 점검하고 배포해줘`
- `로그인 화면 카피만 수정하고 바로 배포해줘`
