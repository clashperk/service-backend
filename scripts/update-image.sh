#!/bin/bash

if [ -z "$1" ]; then
  sed -i '' "s|clashperk-backend:[a-zA-Z0-9._-]*|clashperk-backend:latest|" docker-compose.yml
  echo "Updated image tag to latest"
  exit 0
fi

SHORT_SHA=$(git rev-parse --short "$1" 2>/dev/null)
if [ $? -ne 0 ]; then
  echo "Error: Invalid commit reference '$1'"
  echo ""
  echo "Recent commits:"
  git log --oneline -5
  exit 1
fi

sed -i '' "s|clashperk-backend:[a-zA-Z0-9._-]*|clashperk-backend:sha-${SHORT_SHA}|" docker-compose.yml

echo "Updated image tag to sha-${SHORT_SHA}"
