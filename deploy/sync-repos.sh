#!/usr/bin/env bash
# Push frontend/ and php-backend/ to the GitHub repos Hostinger deploys from,
# and build a backend ZIP for upload. See DEPLOYMENT.md.
#
#   deploy/sync-repos.sh              sync and push both
#   deploy/sync-repos.sh --dry-run    show what would change, push nothing
#   deploy/sync-repos.sh frontend     only one of them (frontend | php-backend)
set -euo pipefail

ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
WORK=${DEPLOY_WORKDIR:-$HOME/.cache/skillforge-deploy-repos}
ZIPDIR=${DEPLOY_ZIPDIR:-$HOME/skillforge-deploy}
declare -A REPO=(
  [frontend]=git@github.com:basu021/ai-learning-front.git
  [php-backend]=git@github.com:basu021/ai-learn-backend.git
)

DRY=0; ONLY=()
for a in "$@"; do
  case $a in
    --dry-run) DRY=1 ;;
    frontend|php-backend) ONLY+=("$a") ;;
    *) echo "unknown argument: $a" >&2; exit 2 ;;
  esac
done
[ ${#ONLY[@]} -gt 0 ] || ONLY=(frontend php-backend)

cd "$ROOT"
if [ -n "$(git status --porcelain -- "${ONLY[@]}")" ]; then
  echo "Uncommitted changes in ${ONLY[*]}. Commit them first; only committed code is deployed." >&2
  git status --short -- "${ONLY[@]}" >&2
  exit 1
fi

SHA=$(git rev-parse --short HEAD)
SUBJECT=$(git log -1 --format=%s)
AUTHOR_NAME=$(git log -1 --format=%an)
AUTHOR_EMAIL=$(git log -1 --format=%ae)
TRAILERS=$(git log -1 --format='%(trailers)')
mkdir -p "$WORK"

for dir in "${ONLY[@]}"; do
  url=${REPO[$dir]}; clone=$WORK/$dir
  echo "== $dir → $url"
  if [ -d "$clone/.git" ]; then
    git -C "$clone" fetch -q origin main
    git -C "$clone" checkout -q -B main origin/main
  else
    git clone -q "$url" "$clone"
  fi
  # Mirror the folder exactly: drop everything, then unpack the committed tree.
  git -C "$clone" rm -rq --ignore-unmatch .
  git -C "$clone" clean -fdxq
  git archive HEAD:"$dir" | tar -x -C "$clone"
  git -C "$clone" add -A

  if git -C "$clone" ls-files | grep -qE '(^|/)\.env$'; then
    echo "Refusing: a .env file would be pushed to $url" >&2; exit 1
  fi
  if git -C "$clone" diff --cached --quiet; then
    echo "   no changes, already at the latest code"
  else
    git -C "$clone" diff --cached --stat | tail -1
    if [ $DRY = 1 ]; then
      echo "   (dry run, not pushed)"
      git -C "$clone" reset -q --hard
    else
      msg=$(printf '%s\n\nSynced from ai-learning-platform %s (%s/).\n' "$SUBJECT" "$SHA" "$dir")
      [ -n "$TRAILERS" ] && msg=$(printf '%s\n\n%s' "$msg" "$TRAILERS")
      git -C "$clone" -c user.name="$AUTHOR_NAME" -c user.email="$AUTHOR_EMAIL" commit -q -m "$msg"
      git -C "$clone" push -q origin main
      echo "   pushed main @ $(git -C "$clone" rev-parse --short HEAD)"
    fi
  fi

  if [ "$dir" = php-backend ] && [ $DRY = 0 ]; then
    mkdir -p "$ZIPDIR"
    zip=$ZIPDIR/learnbackend-php-$SHA.zip
    git archive --format=zip -o "$zip" HEAD:php-backend
    echo "   upload ZIP (no .env inside): $zip"
  fi
done

[ $DRY = 1 ] && exit 0
cat <<EOF

Done. Next, on Hostinger (hPanel):
  Frontend  learn.rbasu.in       Websites → learn.rbasu.in → Redeploy (builds ai-learning-front main)
  Backend   learnbackend.rbasu.in  Git deploy: Pull. Or File Manager: upload the ZIP above to
                                 public_html and extract, overwriting. Keep public_html/.env and uploads/.
  Check     https://learnbackend.rbasu.in/api/health  and log in on https://learn.rbasu.in
EOF
