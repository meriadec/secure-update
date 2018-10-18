#!/usr/bin/env bash
#
# usage:
#   ./upload-gh-asset filename=./dist/build.zip

set -e

filename=$1
owner=$(grep repository package.json | sed -E 's/.*".*\/(.*)\/.*",/\1/g')
repo=$(grep repository package.json | sed -E 's/.*".*\/.*\/(.*)",/\1/g')

GH_API="https://api.github.com"
GH_REPO="$GH_API/repos/$owner/$repo"
AUTH="Authorization: token $GH_TOKEN"

# Validate token.
curl -o /dev/null -sH "$AUTH" "$GH_REPO" || { echo "Error: Invalid repo, token or network issue!";  exit 1; }

# Get ID of the asset based on given filename.
LATEST_RELEASE_ID=$(
  curl -sH "$AUTH" "$GH_API/repos/$owner/$repo/releases" \
    | grep '"id":' \
    | head -n 1 \
    | sed -E 's/.*: (.*),/\1/'
)
[ "$LATEST_RELEASE_ID" ] || { echo "Error: Failed to get release id"; exit 1; }

# Upload asset
echo "uploading $filename"

# Construct url
GH_ASSET="https://uploads.github.com/repos/$owner/$repo/releases/$LATEST_RELEASE_ID/assets?name=$(basename "$filename")"

curl \
  --data-binary @"$filename" \
  -H "Authorization: token $GH_TOKEN" \
  -H "Content-Type: application/octet-stream" \
  "$GH_ASSET"

echo "uploaded $filename"
