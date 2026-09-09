#!/bin/sh
# Page dates (created and last updated) are derived from git history at
# build time. Cloudflare's build clones the repository shallowly, which
# would make every date wrong, so src/utils/page-dates.ts hides git-derived
# dates in a shallow clone. Fetch the full history first when we can.
# Never fails the build: without history the site still builds, only the
# dates are hidden, and the build log says so.
if [ "$(git rev-parse --is-shallow-repository 2>/dev/null)" = "true" ]; then
  if git fetch --unshallow --quiet 2>/dev/null; then
    echo "page dates: shallow clone unshallowed, $(git rev-list --count HEAD) commits available"
  else
    echo "page dates: shallow clone and 'git fetch --unshallow' failed; git-derived dates stay hidden"
  fi
else
  echo "page dates: full history present, $(git rev-list --count HEAD) commits"
fi
exit 0
