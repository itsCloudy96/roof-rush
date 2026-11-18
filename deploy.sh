#!/usr/bin/env bash
# Publish to GitHub Pages (gh-pages branch). Requires `gh auth login` as the Cloudy account.
set -euo pipefail
cd "$(dirname "$0")"
REPO=roof-rush
gh auth status >/dev/null 2>&1 || { echo "Not logged in: run gh auth login"; exit 1; }
gh auth setup-git >/dev/null
LOGIN=$(gh api user -q .login); UID_=$(gh api user -q .id)
EMAIL="${UID_}+${LOGIN}@users.noreply.github.com"
export GIT_AUTHOR_NAME=Cloudy GIT_COMMITTER_NAME=Cloudy GIT_AUTHOR_EMAIL=$EMAIL GIT_COMMITTER_EMAIL=$EMAIL
SITE_URL="https://${LOGIN,,}.github.io/${REPO}"
gh repo view "$LOGIN/$REPO" >/dev/null 2>&1 || gh repo create "$LOGIN/$REPO" --public --description "Roof Rush: a free mobile roofing game by Cloudy. Beat the storm!" --homepage "$SITE_URL/"
[ -d .git ] || { git init -q -b main; }
git config user.name Cloudy; git config user.email "$EMAIL"
git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$LOGIN/$REPO.git"
git add -A; git diff --cached --quiet || git commit -q -m "${1:-Update Cloudy Game Dev Kits}"
git push -q -u origin main
TMP=$(mktemp -d); mkdir -p "$TMP"; cp index.html style.css engine.js game.js README.md LICENSE "$TMP"/; ls screenshot.png >/dev/null 2>&1 && cp screenshot.png "$TMP"/
( cd "$TMP" && git init -q -b gh-pages && git config user.name Cloudy && git config user.email "$EMAIL" && git add -A && git commit -q -m "Deploy $(date -u +%FT%TZ)" && git push -q -f "https://github.com/$LOGIN/$REPO.git" gh-pages )
rm -rf "$TMP"
if ! gh api "repos/$LOGIN/$REPO/pages" >/dev/null 2>&1; then
  gh api -X POST "repos/$LOGIN/$REPO/pages" -f "source[branch]=gh-pages" -f "source[path]=/" >/dev/null 2>&1 || true
fi
gh repo edit "$LOGIN/$REPO" --homepage "$SITE_URL/" >/dev/null 2>&1 || true
echo "REPO=https://github.com/$LOGIN/$REPO"
echo "SITE=$SITE_URL/"
for i in $(seq 1 40); do c=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL/"); echo "try $i: $c"; [ "$c" = 200 ] && break; sleep 15; done
