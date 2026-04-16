#!/bin/bash
# Deploy script - commits, pushes, then deploys to Lambda
# Usage: ./deploy.sh "commit message"   (optional message)
#        ./deploy.sh                    (prompts for message)

set -e  # Exit on any error

STAGE=${STAGE:-dev}
COMMIT_MSG=${1:-""}

echo "=== Checking git status ==="
git status --short

# Check if there are any changes to commit
if [ -n "$(git status --porcelain)" ]; then
  if [ -z "$COMMIT_MSG" ]; then
    read -p "Commit message: " COMMIT_MSG
    if [ -z "$COMMIT_MSG" ]; then
      echo "ERROR: Commit message required"
      exit 1
    fi
  fi

  echo ""
  echo "=== Staging changes ==="
  git add -A

  echo "=== Committing ==="
  git commit -m "$COMMIT_MSG"
else
  echo "Nothing to commit - working tree clean"
fi

echo ""
echo "=== Pushing to remote ==="
git push

echo ""
echo "=== Deploying to Lambda (stage: $STAGE) ==="
serverless deploy --stage $STAGE

echo ""
echo "=== Done ==="
git log --oneline -3
