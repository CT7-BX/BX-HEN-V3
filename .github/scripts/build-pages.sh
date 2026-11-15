#!/usr/bin/env bash
set -euo pipefail

# Github Pages is only a static player UI. Do not copy the Node relay, PS4
# sources, build toolchains, workflow definitions, or local test artifacts.
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
dest="${1:-$root/_site}"

if [[ "$dest" != /* ]]; then
  dest="$root/$dest"
fi
case "$dest" in
  "$root"|"$root/"|"/") echo "Refusing unsafe deployment output directory" >&2; exit 2;;
esac
if [[ -d "$dest" && -n "$(ls -A "$dest")" ]]; then
  echo "Refusing nonempty output directory: $dest" >&2
  exit 3
fi
mkdir -p "$dest/remote"
cp "$root/index.html" "$dest/index.html"

# Explicit allowlist prevents accidental publication of future server files.
assets=(
  index.html
  controller-core.js
  game-core.js
  game.js
  pair-client.js
  first-tests.js
  touch-layout.css
  relay-lab.html
  ps4-probe.txt
  icon.svg
  manifest.webmanifest
)
for item in "${assets[@]}"; do
  test -s "$root/remote/$item" || { echo "Missing public asset $item" >&2; exit 1; }
  cp "$root/remote/$item" "$dest/remote/$item"
done
touch "$dest/.nojekyll"
echo "BX-REMOTE-PLAY: published ${#assets[@]} remote UI assets + root redirect"
