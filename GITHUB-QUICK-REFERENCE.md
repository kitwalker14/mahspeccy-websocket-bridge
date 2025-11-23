# 🚀 GitHub Setup - Quick Reference Card

## ⚡ Super Quick (Copy & Paste)

### 1️⃣ Create GitHub Repo
Go to: **https://github.com/new**
- Name: `mahspeccy-websocket-bridge`
- Private: ✅
- Do NOT initialize

### 2️⃣ Run These Commands

```bash
# Navigate to folder
cd websocket-server

# Initialize git
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: WebSocket Bridge"

# Add your GitHub repo (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/mahspeccy-websocket-bridge.git

# Push
git branch -M main
git push -u origin main
```

### 3️⃣ Authentication
When prompted for password, use **Personal Access Token** from:
https://github.com/settings/tokens

### 4️⃣ Your Repository Name
For Railway deployment, use:
```
YOUR_USERNAME/mahspeccy-websocket-bridge
```

---

## 📋 Full Command Sequence (Copy-Paste Ready)

Replace `YOUR_USERNAME` with your actual GitHub username:

```bash
#!/bin/bash
# Complete GitHub setup in one script

# Navigate to websocket-server folder
cd websocket-server

# Initialize git if not already done
if [ ! -d .git ]; then
  git init
fi

# Create .gitignore if missing
if [ ! -f .gitignore ]; then
  cat > .gitignore << 'EOF'
.env
.env.local
node_modules/
*.log
logs/
.DS_Store
EOF
fi

# Stage all files
git add .

# Commit
git commit -m "Initial commit: WebSocket Bridge for mahSpeccy"

# Add remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/mahspeccy-websocket-bridge.git

# Set branch to main
git branch -M main

# Push to GitHub
git push -u origin main

# Done!
echo "✅ Code pushed to GitHub!"
echo "Repository name for Railway: YOUR_USERNAME/mahspeccy-websocket-bridge"
```

---

## 🔑 Get Personal Access Token

1. Go to: https://github.com/settings/tokens
2. Click: **"Generate new token (classic)"**
3. Name: `mahspeccy-deployment`
4. Scope: ☑️ **repo**
5. Click: **"Generate token"**
6. **COPY TOKEN** (you won't see it again!)
7. Use as password when pushing

---

## 📱 One-Line Checks

```bash
# Check git is installed
git --version

# Check current status
git status

# Check remote URL
git remote -v

# Check commits
git log --oneline

# Check branch
git branch
```

---

## 🆘 Quick Fixes

### Already have a remote?
```bash
git remote set-url origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
```

### Need to remove a remote?
```bash
git remote remove origin
```

### Committed wrong files?
```bash
# Undo last commit (keep changes)
git reset --soft HEAD~1

# Remove specific file from staging
git reset HEAD filename

# Update .gitignore and recommit
```

### Push failed?
```bash
# Try with force (be careful!)
git push -u origin main --force

# Or pull first then push
git pull origin main --rebase
git push -u origin main
```

---

## 📊 What You Need for Railway

After GitHub setup, you need:

```
✅ Railway API Token          (you already have this!)
✅ GitHub Repository Name      YOUR_USERNAME/mahspeccy-websocket-bridge
✅ Branch Name                 main
✅ Supabase Service Role Key   (from Supabase dashboard)
✅ cTrader Client ID           (from cTrader)
✅ cTrader Client Secret       (from cTrader)
```

---

## 🎯 Next: Railway Deployment

Once code is on GitHub:

1. **mahSpeccy App** → **Railway Deploy** tab
2. **Setup:** Enter Railway token → Validate
3. **Deploy:** 
   - Repository: `YOUR_USERNAME/mahspeccy-websocket-bridge`
   - Branch: `main`
   - Fill environment variables
4. **Click:** "Deploy to Railway"
5. **Monitor:** Status & Logs tabs

---

## ✅ Verification Checklist

```bash
# Should all return success
git status          # No errors
git remote -v       # Shows GitHub URL
git log             # Shows commits
git branch          # Shows * main

# On GitHub website
# - Repository exists
# - Files are visible
# - No .env files visible
# - No node_modules visible
```

---

## 🔗 Useful Links

- **Create repo:** https://github.com/new
- **Personal tokens:** https://github.com/settings/tokens
- **Git docs:** https://git-scm.com/doc
- **GitHub docs:** https://docs.github.com/

---

## 💡 Pro Tips

1. **Always use .gitignore** - Never commit secrets!
2. **Use private repos** - Keep your code secure
3. **Commit often** - Small commits are better
4. **Use Personal Access Tokens** - Never use password
5. **Check before pushing** - Review `git status`

---

**Ready to deploy? Your repository name is:**
```
YOUR_USERNAME/mahspeccy-websocket-bridge
```

**Use this in Railway Deploy tab!** 🚀
