@echo off
REM 🚀 GitHub Setup Script for WebSocket Server (Windows)
REM This script helps you push your code to GitHub

echo 🚀 mahSpeccy WebSocket Bridge - GitHub Setup
echo ==============================================
echo.

REM Check if git is installed
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Git is not installed!
    echo Please install Git from: https://git-scm.com/
    pause
    exit /b 1
)

echo ✅ Git is installed
git --version
echo.

REM Check if already a git repository
if exist .git (
    echo ✅ Git repository already initialized
) else (
    echo 📦 Initializing Git repository...
    git init
    echo ✅ Git initialized
)

echo.

REM Check for .gitignore
if exist .gitignore (
    echo ✅ .gitignore file exists
) else (
    echo ⚠️ .gitignore file missing! Creating one...
    (
        echo .env
        echo .env.local
        echo node_modules/
        echo *.log
        echo logs/
        echo .DS_Store
    ) > .gitignore
    echo ✅ .gitignore created
)

echo.
echo 📋 Current Git Status:
echo ======================
git status --short
echo.

REM Prompt for GitHub repository URL
echo 🔗 GitHub Repository Setup
echo ==========================
echo.
echo First, create a new repository on GitHub:
echo   1. Go to: https://github.com/new
echo   2. Name: mahspeccy-websocket-bridge (or your choice)
echo   3. Private: Recommended ✅
echo   4. DO NOT initialize with README
echo   5. Click 'Create repository'
echo.

set /p REPO_URL="Enter your GitHub repository URL (e.g., https://github.com/username/repo.git): "

if "%REPO_URL%"=="" (
    echo ❌ No repository URL provided. Exiting.
    pause
    exit /b 1
)

REM Check if remote already exists
git remote get-url origin >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️ Remote 'origin' already exists. Updating...
    git remote set-url origin "%REPO_URL%"
) else (
    echo 🔗 Adding remote repository...
    git remote add origin "%REPO_URL%"
)

echo ✅ Remote added: %REPO_URL%
echo.

REM Stage all files
echo 📦 Staging files...
git add .
echo ✅ Files staged
echo.

REM Commit
set /p COMMIT_MSG="Enter commit message (default: 'Initial commit: WebSocket Bridge'): "
if "%COMMIT_MSG%"=="" set COMMIT_MSG=Initial commit: WebSocket Bridge for mahSpeccy

echo 💾 Creating commit...
git commit -m "%COMMIT_MSG%"
echo ✅ Commit created
echo.

REM Set main branch
echo 🌿 Setting branch to 'main'...
git branch -M main
echo ✅ Branch set to main
echo.

REM Push to GitHub
echo 🚀 Pushing to GitHub...
echo.
echo ⚠️ IMPORTANT: If prompted for password, use a Personal Access Token!
echo    Get token from: https://github.com/settings/tokens
echo    Scopes needed: 'repo' (full control)
echo.
pause

git push -u origin main
if %errorlevel% equ 0 (
    echo.
    echo ✅ SUCCESS! Your code is now on GitHub!
    echo.
    echo 📝 Next Steps:
    echo ==============
    echo 1. Verify files at: %REPO_URL:.git=%
    echo 2. Your repository name for Railway deployment:
    echo.
    echo    📋 Copy this for Railway Deploy tab
    echo.
    echo 3. Go to mahSpeccy app → Railway Deploy tab
    echo 4. Enter the repository name in 'GitHub Repository' field
    echo 5. Branch: main
    echo 6. Click 'Deploy to Railway'
    echo.
) else (
    echo.
    echo ❌ Push failed!
    echo.
    echo Common issues:
    echo 1. Authentication failed:
    echo    - Get Personal Access Token: https://github.com/settings/tokens
    echo    - Use token as password when prompted
    echo.
    echo 2. Repository doesn't exist:
    echo    - Make sure you created the repo on GitHub first
    echo.
    echo 3. Permission denied:
    echo    - Check you have write access to the repository
    echo.
    echo Try again with: git push -u origin main
)

pause
