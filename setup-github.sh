#!/bin/bash

# 🚀 GitHub Setup Script for WebSocket Server
# This script helps you push your code to GitHub

echo "🚀 mahSpeccy WebSocket Bridge - GitHub Setup"
echo "=============================================="
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed!"
    echo "Please install Git:"
    echo "  - Mac: brew install git"
    echo "  - Windows: https://git-scm.com/"
    echo "  - Linux: sudo apt-get install git"
    exit 1
fi

echo "✅ Git is installed ($(git --version))"
echo ""

# Check if already a git repository
if [ -d .git ]; then
    echo "✅ Git repository already initialized"
else
    echo "📦 Initializing Git repository..."
    git init
    echo "✅ Git initialized"
fi

echo ""

# Check for .gitignore
if [ -f .gitignore ]; then
    echo "✅ .gitignore file exists"
else
    echo "⚠️  .gitignore file missing! Creating one..."
    cat > .gitignore << 'EOF'
.env
.env.local
node_modules/
*.log
logs/
.DS_Store
EOF
    echo "✅ .gitignore created"
fi

echo ""
echo "📋 Current Git Status:"
echo "======================"
git status --short
echo ""

# Prompt for GitHub repository URL
echo "🔗 GitHub Repository Setup"
echo "=========================="
echo ""
echo "First, create a new repository on GitHub:"
echo "  1. Go to: https://github.com/new"
echo "  2. Name: mahspeccy-websocket-bridge (or your choice)"
echo "  3. Private: Recommended ✅"
echo "  4. DO NOT initialize with README"
echo "  5. Click 'Create repository'"
echo ""

read -p "Enter your GitHub repository URL (e.g., https://github.com/username/repo.git): " REPO_URL

if [ -z "$REPO_URL" ]; then
    echo "❌ No repository URL provided. Exiting."
    exit 1
fi

# Check if remote already exists
if git remote get-url origin &> /dev/null; then
    echo "⚠️  Remote 'origin' already exists. Updating..."
    git remote set-url origin "$REPO_URL"
else
    echo "🔗 Adding remote repository..."
    git remote add origin "$REPO_URL"
fi

echo "✅ Remote added: $REPO_URL"
echo ""

# Stage all files
echo "📦 Staging files..."
git add .
echo "✅ Files staged"
echo ""

# Commit
read -p "Enter commit message (default: 'Initial commit: WebSocket Bridge'): " COMMIT_MSG
COMMIT_MSG=${COMMIT_MSG:-"Initial commit: WebSocket Bridge for mahSpeccy"}

echo "💾 Creating commit..."
git commit -m "$COMMIT_MSG"
echo "✅ Commit created"
echo ""

# Set main branch
echo "🌿 Setting branch to 'main'..."
git branch -M main
echo "✅ Branch set to main"
echo ""

# Push to GitHub
echo "🚀 Pushing to GitHub..."
echo ""
echo "⚠️  IMPORTANT: If prompted for password, use a Personal Access Token!"
echo "   Get token from: https://github.com/settings/tokens"
echo "   Scopes needed: 'repo' (full control)"
echo ""

read -p "Press Enter to push to GitHub..."

if git push -u origin main; then
    echo ""
    echo "✅ SUCCESS! Your code is now on GitHub!"
    echo ""
    echo "📝 Next Steps:"
    echo "=============="
    echo "1. Verify files at: ${REPO_URL%.git}"
    echo "2. Your repository name for Railway deployment:"
    echo ""
    REPO_NAME=$(echo "$REPO_URL" | sed -E 's/.*github\.com[:/]([^/]+\/[^.]+)(\.git)?/\1/')
    echo "   📋 ${REPO_NAME}"
    echo ""
    echo "3. Go to mahSpeccy app → Railway Deploy tab"
    echo "4. Enter the repository name above in 'GitHub Repository' field"
    echo "5. Branch: main"
    echo "6. Click 'Deploy to Railway'"
    echo ""
else
    echo ""
    echo "❌ Push failed!"
    echo ""
    echo "Common issues:"
    echo "1. Authentication failed:"
    echo "   - Get Personal Access Token: https://github.com/settings/tokens"
    echo "   - Use token as password when prompted"
    echo ""
    echo "2. Repository doesn't exist:"
    echo "   - Make sure you created the repo on GitHub first"
    echo ""
    echo "3. Permission denied:"
    echo "   - Check you have write access to the repository"
    echo ""
    echo "Try again with: git push -u origin main"
    exit 1
fi
