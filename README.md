# godo

나만 쓰는 할 일 앱. TickTick·Todoist를 비롯한 20여 개 앱을 조사해서 가장 쓸모 있는 기능만 골라 만들었어요.
서버와 계정이 없고, 데이터는 **브라우저(IndexedDB) 안에만** 저장돼요. 오프라인에서도 동작하는 PWA예요.

- **사용법**: 앱 안의 `사용 가이드` 화면 또는 [`docs/GUIDE.md`](docs/GUIDE.md) (기능을 하나씩 따라 해 보는 문서)
- **기능 명세와 완료 체크리스트**: [`docs/FEATURES.md`](docs/FEATURES.md)

## 주요 기능
빠른 추가(한국어·영어 자연어) · 시작일/마감일 분리 · 반복(완료일 기준 포함) · 하위 작업 · 필터 쿼리 언어 ·
목록/칸반/캘린더(월·주·일)/타임라인/아이젠하워 매트릭스 · 아침 계획(용량 경고·자동 배치)/미완료 정리/저녁 회고/주간 리뷰 ·
포모도로 · 습관 · 디데이 · 생산성 · 요약 보고서 · 알림 · 템플릿 · 명령 팔레트와 단축키 · 백업/복원 · 라이트/다크

## 개발

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm test         # 단위·컴포넌트 테스트 (vitest)
pnpm e2e          # 프로덕션 빌드를 띄워 Playwright E2E + 접근성(axe) + PWA
pnpm build        # 타입 검사 + 빌드 → dist/
```

기술: Vite · React 19 · TypeScript · Zustand · Dexie(IndexedDB) · react-router(HashRouter) · dnd-kit · zod · vite-plugin-pwa

### 구조
```
src/domain/      순수 로직(자연어 파서, 필터, 반복, 계획, 통계, 백업) — React·DB 의존 없음
src/store/       상태·저장(ChangeSet 한 경로로 모든 쓰기, 실행 취소)
src/features/    화면 기능별 폴더
src/ui/          공용 부품
```

## 배포 (GitHub Pages)

```bash
scripts/deploy-pages.sh      # 빌드해서 gh-pages 브랜치로 올린다
```

저장소 Settings → Pages 에서 `gh-pages` 브랜치 `/ (root)` 를 선택하면 돼요. 빌드는 상대 경로라 하위 주소(`/godo/`)에서도 동작해요.

## 데이터와 백업
모든 데이터는 사용하는 브라우저 안에만 있어요. 설정 → 데이터에서 **JSON 백업**을 주기적으로 받아 두세요.
