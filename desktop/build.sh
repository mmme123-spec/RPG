#!/bin/sh
# Builds RPGForge.exe (Windows) from the single-file editor build.
set -e
cd "$(dirname "$0")/.."
npm run build:single
cp dist-single/index.html desktop/index.html
cd desktop
GOOS=windows GOARCH=amd64 go build -ldflags "-s -w" -o RPGForge.exe .
echo "Built desktop/RPGForge.exe"
