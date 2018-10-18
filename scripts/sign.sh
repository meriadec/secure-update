#!/bin/bash

set -e

pushd dist >/dev/null

# TODO windows & mac
distFile=$(find . -name '*.AppImage' | sed "s|^\\./||")

sumFile="$distFile.sha512sum"
sigFile="$sumFile.sig"

echo "generating hash & signature"

sha512sum "$distFile" > "$sumFile"
gpg --armor --output "$sigFile" --detach-sig "$sumFile"

echo "file: $distFile"
echo "sumFile: $sumFile"
echo "sigFile: $sigFile"

popd >/dev/null

bash scripts/upload-gh-asset.sh "dist/$sumFile"
bash scripts/upload-gh-asset.sh "dist/$sigFile"
