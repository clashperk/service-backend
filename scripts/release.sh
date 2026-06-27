#!/bin/bash

set -e

# Releases one monorepo app by creating a prefixed git tag, which triggers the
# matching deploy workflow:
#   api-*    -> .github/workflows/aws-ecr-publish-api.yml        (deploy-api)
#   worker-* -> .github/workflows/aws-ecr-publish-worker.yml (deploy-worker)

APP="$1"
if [[ "$APP" != "api" && "$APP" != "worker" ]]; then
  echo "Usage: $0 <api|worker> [version]"
  echo "  Creates and pushes an '<app>-v<version>' tag to trigger that app's deploy."
  echo "  version defaults to the \"version\" field in package.json."
  exit 1
fi

# 2nd arg overrides the version; otherwise fall back to package.json.
VERSION="${2:-$(grep -o '"version": "[^"]*' package.json | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')}"

if [[ ! $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: Version number must be in the format x.y.z (got '$VERSION')"
  exit 1
fi

TAG="$APP-v$VERSION"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Error: tag '$TAG' already exists."
  exit 1
fi

git tag -a "$TAG" -m "Release $APP version $VERSION"
git push origin "$TAG"

echo "Tag '$TAG' created and pushed — this triggers the deploy-$APP workflow."

REMOTE_URL=$(git config --get remote.origin.url)

if [[ $REMOTE_URL =~ ^git@github.com: ]]; then
  REMOTE_URL=$(echo "$REMOTE_URL" | sed -e 's/^git@github.com:/https:\/\/github.com\//')
fi

REMOTE_URL=$(echo "$REMOTE_URL" | sed 's/\.git$//')

# Previous tag for the SAME app, for a meaningful diff link.
PREV_TAG=$(git describe --tags --abbrev=0 --match "$APP-v*" "$TAG^" 2>/dev/null || true)

echo ""
if [[ -n "$PREV_TAG" ]]; then
  echo "Diff against the previous $APP release ($PREV_TAG):"
  echo "$REMOTE_URL/compare/$PREV_TAG...$TAG"
else
  echo "(First $APP release — no previous tag to diff against.)"
fi
