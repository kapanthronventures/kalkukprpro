#!/usr/bin/env bash
# migrate-to-findingmainera.sh
#
# Copies the Finding Mainera gallery files out of kalkukprpro into a new
# sibling directory `../findingmainera/`, initialises a fresh git history,
# and pushes to the empty GitHub repo you've already created.
#
# Prerequisites:
#   1. You are CWD'd inside kalkukprpro on the gallery branch.
#   2. The empty repo `kapanthron/findingmainera` exists on GitHub.
#   3. `git` and `gh` are installed and authenticated.
#
# Usage:
#   bash scripts/migrate-to-findingmainera.sh
#
# Idempotent — safe to re-run (it will refuse to clobber a non-empty
# destination unless you pass --force).

set -euo pipefail

GITHUB_USER="kapanthron"
NEW_NAME="findingmainera"
SRC_DIR="$(pwd)"
DEST_DIR="$(cd .. && pwd)/${NEW_NAME}"
FORCE=0

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    -h|--help)
      sed -n '2,18p' "$0"; exit 0 ;;
  esac
done

# --- sanity --------------------------------------------------------------

if [[ ! -f "${SRC_DIR}/index.html" || ! -f "${SRC_DIR}/wrangler.jsonc" ]]; then
  echo "✘ Run this from the root of the kalkukprpro checkout."
  exit 1
fi

if [[ -d "${DEST_DIR}" && "${FORCE}" -eq 0 ]]; then
  if [[ -n "$(ls -A "${DEST_DIR}" 2>/dev/null)" ]]; then
    echo "✘ ${DEST_DIR} already exists and is not empty."
    echo "  Re-run with --force to overwrite, or remove it first."
    exit 1
  fi
fi

echo "→ Source:      ${SRC_DIR}"
echo "→ Destination: ${DEST_DIR}"
echo

mkdir -p "${DEST_DIR}"

# --- copy ---------------------------------------------------------------

# Files that ship to the new repo. NOTE: kpr.html and any kalkukprpro-only
# artefacts are deliberately excluded.
ITEMS=(
  "index.html"
  "gallery.html"
  "artist.html"
  "exhibitions.html"
  "auth.html"
  "collector.html"
  "admin.html"
  "404.html"
  "sitemap.xml"
  "robots.txt"
  "manifest.json"
  "llms.txt"
  "wrangler.jsonc"
  ".assetsignore"
  "ARCHITECTURE.md"
  "DEPLOY.md"
  "README.md"
  "artwork"
  "css"
  "js"
  "scripts"
)

for item in "${ITEMS[@]}"; do
  if [[ -e "${SRC_DIR}/${item}" ]]; then
    cp -R "${SRC_DIR}/${item}" "${DEST_DIR}/"
    printf "  ✓ %s\n" "${item}"
  else
    printf "  · %s (missing — skipped)\n" "${item}"
  fi
done

# --- gitignore for the new repo -----------------------------------------

cat > "${DEST_DIR}/.gitignore" <<'EOF'
# OS / editor
.DS_Store
Thumbs.db
.idea/
.vscode/

# Node (for future Worker/Next.js builds)
node_modules/
.pnpm-store/
dist/
.next/
.turbo/

# Wrangler local state
.wrangler/
.dev.vars
.env
.env.*
!.env.example

# Logs
*.log
npm-debug.log*
EOF
printf "  ✓ .gitignore\n"

# --- init git -----------------------------------------------------------

cd "${DEST_DIR}"

if [[ -d .git ]]; then
  echo "→ Existing .git found, leaving it in place."
else
  git init -q -b main
  echo "→ Initialised fresh git history on 'main'."
fi

git add -A
if git diff --cached --quiet; then
  echo "→ No staged changes. Nothing to commit."
else
  git commit -q -m "Initial commit — Finding Mainera virtual gallery

A virtual gallery representing a curated roster of emerging contemporary
painters. Works uploaded directly by the artists; auctions run from the
studio. Static prototype + ARCHITECTURE.md production spec.

Migrated from kapanthron/kalkukprpro@claude/virtual-art-gallery-Eemwv."
  echo "→ Created initial commit."
fi

# --- remote -------------------------------------------------------------

REMOTE_URL="git@github.com:${GITHUB_USER}/${NEW_NAME}.git"
if git remote | grep -q "^origin$"; then
  git remote set-url origin "${REMOTE_URL}"
else
  git remote add origin "${REMOTE_URL}"
fi
echo "→ Remote 'origin' = ${REMOTE_URL}"

echo
echo "─────────────────────────────────────────────────────────────"
echo "Local migration complete. Next steps:"
echo
echo "  1) Confirm the GitHub repo exists (empty):"
echo "       gh repo view ${GITHUB_USER}/${NEW_NAME}"
echo
echo "  2) Push:"
echo "       cd ${DEST_DIR}"
echo "       git push -u origin main"
echo
echo "  3) Deploy Cloudflare Worker:"
echo "       npx wrangler deploy"
echo
echo "  4) Set the admin password hash (NEVER the plaintext):"
echo "       npx wrangler secret put SUPER_ADMIN_PASSWORD_HASH"
echo
echo "See DEPLOY.md for the full guide."
echo "─────────────────────────────────────────────────────────────"
