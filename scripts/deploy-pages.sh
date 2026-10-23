#!/usr/bin/env bash
# 빌드 결과(dist)를 gh-pages 브랜치로 올려 GitHub Pages에 배포한다.
# 사용법: scripts/deploy-pages.sh            (origin 저장소로)
#         scripts/deploy-pages.sh <remote-url>
set -euo pipefail

cd "$(dirname "$0")/.."
REMOTE="${1:-$(git remote get-url origin)}"

pnpm build
touch dist/.nojekyll

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -R dist/. "$TMP/"
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name="${GIT_AUTHOR_NAME:-pace-deploy}" -c user.email="${GIT_AUTHOR_EMAIL:-pace-deploy@users.noreply.github.com}" \
  commit -q -m "deploy: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git push -f -q "$REMOTE" gh-pages
echo "배포 완료: gh-pages 브랜치를 갱신했어요."
