param(
    [string]$Message = ""
)

$ErrorActionPreference = "Stop"

Write-Host "=== Checking git status ===" -ForegroundColor Cyan
git status --short

# Check if there are changes to commit
$changes = git status --porcelain
if ($changes) {
    if (-not $Message) {
        $Message = Read-Host "Commit message"
        if (-not $Message) {
            Write-Host "ERROR: Commit message required" -ForegroundColor Red
            exit 1
        }
    }

    Write-Host "`n=== Staging changes ===" -ForegroundColor Cyan
    git add -A

    Write-Host "=== Committing ===" -ForegroundColor Cyan
    git commit -m $Message
} else {
    Write-Host "Nothing to commit - working tree clean" -ForegroundColor Yellow
}

Write-Host "`n=== Pushing to remote ===" -ForegroundColor Cyan
git push

Write-Host "`n=== Deploying to Lambda ===" -ForegroundColor Cyan
serverless deploy

Write-Host "`n=== Done ===" -ForegroundColor Green
git log --oneline -3
