#!/usr/bin/env bash
set -euo pipefail

# The size limits your submission must stay within.
MAX_ZIP_MB=50
MAX_FILE_MB=5

# Make sure you're running this from inside your assignment workspace.
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Run submit from your assessment workspace (the folder the setup command created)." >&2
  exit 1
fi
cd "$(git rev-parse --show-toplevel)"

# Packaging needs the 'zip' tool.
if ! command -v zip >/dev/null 2>&1; then
  echo "zip is required to package your submission - install it (e.g. sudo apt install zip) and run submit again." >&2
  exit 1
fi

# Ignore build output and other files that don't belong in a submission.
EXCLUDES="$(mktemp)"
cat > "$EXCLUDES" <<'PATTERNS'
dist/
build/
out/
target/
bin/
obj/
node_modules/
bower_components/
jspm_packages/
.next/
.nuxt/
.svelte-kit/
.angular/
.turbo/
.parcel-cache/
.vercel/
.netlify/
.expo/
.serverless/
__pycache__/
.venv/
venv/
.tox/
.mypy_cache/
.ruff_cache/
.pytest_cache/
.eggs/
htmlcov/
.hypothesis/
.gradle/
.bundle/
vendor/
Pods/
Carthage/
DerivedData/
.build/
.swiftpm/
xcuserdata/
_deps/
CMakeFiles/
_build/
.elixir_ls/
.stack-work/
dist-newstyle/
.dart_tool/
.pub/
coverage/
.nyc_output/
test-results/
junit-results/
allure-results/
playwright-report/
.cache/
.tmp/
tmp/
cache/
logs/
.git/
.github/
.gitlab/
.svn/
.hg/
.idea/
.vscode/
.vs/
.fleet/
.zed/
.history/
.metadata/
.settings/
.opencode/
.kimchi/
package-lock.json
yarn.lock
pnpm-lock.yaml
bun.lockb
pipfile.lock
poetry.lock
gemfile.lock
cargo.lock
composer.lock
mix.lock
pubspec.lock
gradle.lockfile
Podfile.lock
Cartfile.resolved
Package.resolved
.DS_Store
Thumbs.db
desktop.ini
opencode.db
opencode.db-wal
opencode.db-shm
*.iml
*.suo
*.user
*.userprefs
*.tlog
*.lock
*.swp
*~
PATTERNS

# Collect only the files tracked by git in your workspace - nothing else leaves your machine.
files=()
while IFS= read -r -d '' f; do
  [ -f "$f" ] && files+=("$f")
done < <(git ls-files -z --cached --others --exclude-standard --exclude-from="$EXCLUDES")
rm -f "$EXCLUDES"

# Stop if there's nothing to hand in.
if [ ${#files[@]} -eq 0 ]; then
  echo "Nothing to submit - the workspace looks empty once build output is excluded." >&2
  exit 1
fi

# Warn about very large files the AI won't read (they're still uploaded).
max_file_bytes=$((MAX_FILE_MB * 1024 * 1024))
oversized=()
for f in "${files[@]}"; do
  [ "$(wc -c < "$f")" -gt "$max_file_bytes" ] && oversized+=("$f")
done
if [ ${#oversized[@]} -gt 0 ]; then
  echo "Heads up - these are larger than ${MAX_FILE_MB} MB, so the AI won't analyse them (still uploaded):"
  printf '  %s\n' "${oversized[@]}"
fi

# Package your files into a single zip.
OUT="$(mktemp -t submission-XXXXXX).zip"
printf '%s\0' "${files[@]}" | xargs -0 zip -q "$OUT"

# If the package is over the limit, show the biggest folders so you know what to trim.
zip_bytes=$(wc -c < "$OUT")
if [ "$zip_bytes" -gt $((MAX_ZIP_MB * 1024 * 1024)) ]; then
  echo
  echo "Your submission is $(awk -v b="$zip_bytes" 'BEGIN { printf "%.1f", b / 1048576 }') MB, over the ${MAX_ZIP_MB} MB limit."
  echo "Largest folders in your submission:"
  for f in "${files[@]}"; do
    printf '%s\t%s\n' "$(wc -c < "$f")" "${f%%/*}"
  done | awk -F'\t' '{ a[$2] += $1 } END { for (k in a) printf "%d\t%s\n", a[k], k }' \
       | sort -rn | head -10 \
       | awk -F'\t' '{ printf "  %6.1f MB  %s\n", $1 / 1048576, $2 }' || true
  echo
  echo "Remove large build output or data folders (or add them to .gitignore), then run submit again."
  rm -f "$OUT"
  exit 1
fi

# Upload your submission to Hello Recruiter.
RESPONSE="$(mktemp)"
code="$(curl -sS -X POST "https://app-apis.hellorecruiter.ai/api/Public/CandidateTakeHome/Submission?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqb2JJZCI6IjEwNDU1IiwiY2FuZGlkYXRlSWQiOiIxMTIyNiIsImludGVydmlld0lkIjoiMTMwMSIsImludGVydmlld1BsYW5JZCI6IjM3NyIsImlzcyI6Imh0dHBzOi8vYXBwLWFwaXMuaGVsbG9yZWNydWl0ZXIuYWkiLCJhdWQiOiJodHRwczovL2pvYnMtYXBpcy5oZWxsb3JlY3J1aXRlci5haSJ9.jpaa-WgicXSCj4TWtCiQ1V_5FJNtTeRWIi29Ry_knmg" -F "zip=@$OUT;type=application/zip" -o "$RESPONSE" -w '%{http_code}')"
rm -f "$OUT"
if [ "$code" -ge 400 ]; then
  message="$(sed -n 's/.*"[Dd]escription"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$RESPONSE")"
  [ -z "$message" ] && message="$(sed -n 's/.*"[Mm]essage"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$RESPONSE")"
  rm -f "$RESPONSE"
  echo "Submission failed: ${message:-the server rejected your submission (HTTP $code). Check the assignment portal.}" >&2
  exit 1
fi
rm -f "$RESPONSE"
echo "Submission uploaded."

# Open your submission page in the browser.
if command -v open >/dev/null 2>&1; then open "https://jobs.hellorecruiter.ai/candidate-takehome?Candidate_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqb2JJZCI6IjEwNDU1IiwiY2FuZGlkYXRlSWQiOiIxMTIyNiIsImludGVydmlld0lkIjoiMTMwMSIsImludGVydmlld1BsYW5JZCI6IjM3NyIsImlzcyI6Imh0dHBzOi8vYXBwLWFwaXMuaGVsbG9yZWNydWl0ZXIuYWkiLCJhdWQiOiJodHRwczovL2pvYnMtYXBpcy5oZWxsb3JlY3J1aXRlci5haSJ9.jpaa-WgicXSCj4TWtCiQ1V_5FJNtTeRWIi29Ry_knmg" || true
elif command -v xdg-open >/dev/null 2>&1; then xdg-open "https://jobs.hellorecruiter.ai/candidate-takehome?Candidate_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqb2JJZCI6IjEwNDU1IiwiY2FuZGlkYXRlSWQiOiIxMTIyNiIsImludGVydmlld0lkIjoiMTMwMSIsImludGVydmlld1BsYW5JZCI6IjM3NyIsImlzcyI6Imh0dHBzOi8vYXBwLWFwaXMuaGVsbG9yZWNydWl0ZXIuYWkiLCJhdWQiOiJodHRwczovL2pvYnMtYXBpcy5oZWxsb3JlY3J1aXRlci5haSJ9.jpaa-WgicXSCj4TWtCiQ1V_5FJNtTeRWIi29Ry_knmg" || true
else echo "Done. View your submission: https://jobs.hellorecruiter.ai/candidate-takehome?Candidate_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqb2JJZCI6IjEwNDU1IiwiY2FuZGlkYXRlSWQiOiIxMTIyNiIsImludGVydmlld0lkIjoiMTMwMSIsImludGVydmlld1BsYW5JZCI6IjM3NyIsImlzcyI6Imh0dHBzOi8vYXBwLWFwaXMuaGVsbG9yZWNydWl0ZXIuYWkiLCJhdWQiOiJodHRwczovL2pvYnMtYXBpcy5oZWxsb3JlY3J1aXRlci5haSJ9.jpaa-WgicXSCj4TWtCiQ1V_5FJNtTeRWIi29Ry_knmg"; fi