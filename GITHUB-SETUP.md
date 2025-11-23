# 🚀 GitHub Setup Guide for WebSocket Server

## Step 1: Create GitHub Repository

### Option A: Via GitHub Website (Easiest)
1. Go to https://github.com/new
2. Fill in:
   - **Repository name:** `mahspeccy-websocket-bridge` (or your preferred name)
   - **Description:** `cTrader WebSocket Bridge for mahSpeccy Trading Bot`
   - **Visibility:** 
     - ✅ **Private** (recommended for security)
     - ⚠️ Public (only if you want it public)
   - **Initialize:** ❌ **DO NOT** check "Add README" or any other files
3. Click **"Create repository"**
4. **Copy the repository URL** (should look like: `https://github.com/YOUR_USERNAME/mahspeccy-websocket-bridge.git`)

### Option B: Via GitHub CLI (If you have it installed)
```bash
gh repo create mahspeccy-websocket-bridge --private --description "cTrader WebSocket Bridge for mahSpeccy"
```

---

## Step 2: Prepare Your Local Files

### A. Check if Git is initialized
Open terminal in the `websocket-server` folder and run:
```bash
# Check if git is already initialized
ls -la | grep .git
```

### B. Initialize Git (if not already done)
```bash
# Initialize git repository
git init

# Check git status
git status
```

---

## Step 3: Create .gitignore File

**IMPORTANT:** You need a `.gitignore` file to avoid committing secrets!

I've created a `.gitignore` file for you (see below). Make sure it exists in your `websocket-server` folder.

---

## Step 4: Commit Your Code

```bash
# Add all files (respecting .gitignore)
git add .

# Create first commit
git commit -m "Initial commit: WebSocket Bridge for mahSpeccy"

# Check that commit was created
git log
```

---

## Step 5: Connect to GitHub

Replace `YOUR_USERNAME` and `YOUR_REPO` with your actual values:

```bash
# Add remote repository
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Verify remote was added
git remote -v
```

---

## Step 6: Push to GitHub

```bash
# Push to main branch
git branch -M main
git push -u origin main
```

### If you get authentication error:
You need a **GitHub Personal Access Token** (not your password):

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Name: `mahspeccy-deployment`
4. Expiration: Your choice (90 days recommended)
5. Scopes: Check **`repo`** (full control of private repositories)
6. Click **"Generate token"**
7. **COPY THE TOKEN** (you won't see it again!)
8. When prompted for password, paste the token instead

---

## Step 7: Verify Upload

1. Go to your GitHub repository URL
2. You should see all your files listed
3. Check that `.env`, `node_modules`, and other sensitive files are NOT visible

---

## Step 8: Get Repository Name for Deployment

Your repository name for Railway deployment should be in format:
```
YOUR_GITHUB_USERNAME/YOUR_REPO_NAME
```

Example: `johnsmith/mahspeccy-websocket-bridge`

**Write this down - you'll need it in the Railway Deploy tab!**

---

## 🆘 Troubleshooting

### "Git not found"
Install Git:
- **Mac:** `brew install git` or download from https://git-scm.com/
- **Windows:** Download from https://git-scm.com/
- **Linux:** `sudo apt-get install git`

### "Permission denied"
You need to authenticate with GitHub:
- Use Personal Access Token (see Step 6)
- Or set up SSH keys: https://docs.github.com/en/authentication/connecting-to-github-with-ssh

### "Repository already exists"
If you already have a repo:
```bash
# Just add the remote and push
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Files are too large
If you get "file too large" error:
```bash
# Check for large files
find . -type f -size +50M

# Remove them from git (but keep locally)
git rm --cached path/to/large-file
echo "path/to/large-file" >> .gitignore
git commit -m "Remove large file"
```

---

## ✅ Success Checklist

- [ ] GitHub repository created
- [ ] Git initialized locally
- [ ] .gitignore file in place
- [ ] Code committed locally
- [ ] Remote added
- [ ] Code pushed to GitHub
- [ ] Verified files are visible on GitHub
- [ ] No sensitive data (.env files) visible
- [ ] Repository name written down for Railway deployment

---

## 📝 Next Steps

Once your code is on GitHub:

1. Go to mahSpeccy app → **"Railway Deploy"** tab
2. **Setup Tab:** Enter your Railway API token
3. **Deploy Tab:** 
   - GitHub Repository: `YOUR_USERNAME/YOUR_REPO`
   - Branch: `main`
   - Fill in environment variables
4. Click **"Deploy to Railway"**

The app will handle everything else automatically! 🚀
