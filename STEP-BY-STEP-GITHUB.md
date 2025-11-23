# 📖 Step-by-Step GitHub Setup (Visual Guide)

## 🎯 Goal
Get your `websocket-server` code onto GitHub so Railway can deploy it.

---

## ⚡ Quick Start (Choose One Method)

### Method 1: Automated Script (Easiest) ⭐ RECOMMENDED

#### On Mac/Linux:
```bash
cd websocket-server
chmod +x setup-github.sh
./setup-github.sh
```

#### On Windows:
```cmd
cd websocket-server
setup-github.bat
```

The script will guide you through everything!

---

### Method 2: Manual Setup (Step-by-Step)

---

## 📝 PART 1: Create GitHub Repository

### Step 1: Go to GitHub
Open your browser and go to: **https://github.com/new**

### Step 2: Fill in Repository Details

```
Repository name:     mahspeccy-websocket-bridge
Description:         cTrader WebSocket Bridge for mahSpeccy Trading Bot
Visibility:          ⚫ Private (RECOMMENDED - keeps your code secure)
Initialize:          ⚠️ DO NOT CHECK ANY BOXES
```

**Important:** Leave "Add a README file" UNCHECKED!

### Step 3: Click "Create repository"

### Step 4: Copy Repository URL
You'll see a page with instructions. Copy the URL that looks like:
```
https://github.com/YOUR_USERNAME/mahspeccy-websocket-bridge.git
```

**Write this down!** You'll need it in Step 2.

---

## 💻 PART 2: Push Your Code to GitHub

### Step 1: Open Terminal/Command Prompt

#### Mac:
- Open "Terminal" app
- `cd` to your project directory

#### Windows:
- Open "Command Prompt" or "PowerShell"
- `cd` to your project directory

#### Example:
```bash
cd /path/to/your/websocket-server
```

### Step 2: Check if Git is Installed

```bash
git --version
```

**If you see:** `git version 2.x.x` → ✅ Continue to Step 3

**If you see:** `command not found` → ❌ Install Git:
- **Mac:** `brew install git` or download from https://git-scm.com/
- **Windows:** Download from https://git-scm.com/
- **Linux:** `sudo apt-get install git`

### Step 3: Initialize Git (if not already done)

```bash
# Initialize git repository
git init

# Verify initialization
ls -la | grep .git
```

You should see a `.git` folder (might be hidden).

### Step 4: Verify .gitignore Exists

```bash
# Check if .gitignore exists
ls -la .gitignore
```

**If missing:** I've already created one for you. If it's not there, create it:

```bash
# Create .gitignore
cat > .gitignore << 'EOF'
.env
.env.local
node_modules/
*.log
logs/
.DS_Store
EOF
```

### Step 5: Stage Your Files

```bash
# Add all files (respecting .gitignore)
git add .

# Check what will be committed
git status
```

You should see a list of files in green. **Make sure you DON'T see:**
- `.env` files
- `node_modules/` folder
- Any sensitive data

### Step 6: Create First Commit

```bash
# Commit with a message
git commit -m "Initial commit: WebSocket Bridge for mahSpeccy"

# Verify commit
git log
```

### Step 7: Connect to GitHub

Replace `YOUR_URL` with the URL you copied in Part 1, Step 4:

```bash
# Add remote
git remote add origin YOUR_URL

# Example:
# git remote add origin https://github.com/johnsmith/mahspeccy-websocket-bridge.git

# Verify remote
git remote -v
```

You should see:
```
origin  https://github.com/YOUR_USERNAME/mahspeccy-websocket-bridge.git (fetch)
origin  https://github.com/YOUR_USERNAME/mahspeccy-websocket-bridge.git (push)
```

### Step 8: Push to GitHub

```bash
# Set branch to main
git branch -M main

# Push to GitHub
git push -u origin main
```

---

## 🔐 Authentication (If Prompted)

When you run `git push`, you might be asked for credentials:

### Username:
Enter your GitHub username

### Password:
⚠️ **DON'T USE YOUR GITHUB PASSWORD!**

Instead, use a **Personal Access Token**:

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Settings:
   ```
   Note:        mahspeccy-deployment
   Expiration:  90 days (or your choice)
   Scopes:      ☑️ repo (full control of private repositories)
   ```
4. Click **"Generate token"**
5. **COPY THE TOKEN** (you won't see it again!)
6. Paste this token when prompted for password

### Save Token (Optional)
To avoid entering token every time:

```bash
# Tell git to remember credentials
git config --global credential.helper store
```

Next time you push, git will save your token.

---

## ✅ Verify Success

### Step 1: Check GitHub
1. Go to your repository URL: `https://github.com/YOUR_USERNAME/mahspeccy-websocket-bridge`
2. You should see all your files listed!

### Step 2: Verify No Secrets Leaked
Make sure these are **NOT** visible:
- ❌ `.env` file
- ❌ `node_modules/` folder
- ❌ Any files with passwords/keys

If you see these, **DELETE THE REPOSITORY** and start over with proper `.gitignore`!

### Step 3: Get Your Repository Name
Your repository name for Railway deployment is:
```
YOUR_USERNAME/mahspeccy-websocket-bridge
```

Example: `johnsmith/mahspeccy-websocket-bridge`

**Copy this!** You'll need it in the Railway Deploy tab.

---

## 🚀 Next Steps: Deploy to Railway

Now that your code is on GitHub:

### 1. Open mahSpeccy App
Go to the **"Railway Deploy"** tab

### 2. Setup Tab
- Paste your Railway API token
- Click "Validate"
- You'll see your Railway account info

### 3. Deploy Tab
Fill in:
```
Project Name:        mahspeccy-websocket-bridge
GitHub Repository:   YOUR_USERNAME/mahspeccy-websocket-bridge
Branch:              main

Environment Variables:
  SUPABASE_URL:                  (auto-filled)
  SUPABASE_SERVICE_ROLE_KEY:     (get from Supabase dashboard)
  CTRADER_CLIENT_ID:             (your cTrader OAuth ID)
  CTRADER_CLIENT_SECRET:         (your cTrader OAuth secret)
  NODE_ENV:                      production
```

### 4. Click "Deploy to Railway"
- The app will automatically:
  - ✅ Create Railway project
  - ✅ Deploy from GitHub
  - ✅ Set environment variables
  - ✅ Create public URL
  - ✅ Monitor deployment

### 5. Monitor Progress
- **Status Tab:** See deployment status and health
- **Logs Tab:** View deployment logs

### 6. Get Your WebSocket URL
Once deployed, you'll get a URL like:
```
https://mahspeccy-websocket-bridge.up.railway.app
```

Save this! You'll use it in your WebSocket Bridge settings.

---

## 🆘 Troubleshooting

### "Git not found"
**Solution:** Install Git from https://git-scm.com/

### "Permission denied (publickey)"
**Solution:** Use HTTPS URL (not SSH) or set up SSH keys:
- Guide: https://docs.github.com/en/authentication/connecting-to-github-with-ssh

### "Repository not found"
**Solution:** 
- Make sure you created the repo on GitHub first
- Check the URL is correct
- Make sure you have access to the repository

### "Authentication failed"
**Solution:** 
- Use Personal Access Token (not password)
- Get token from: https://github.com/settings/tokens
- Make sure token has `repo` scope

### "Everything up-to-date" but nothing on GitHub
**Solution:** 
- Check remote URL: `git remote -v`
- Make sure you added the correct remote
- Try: `git remote set-url origin YOUR_CORRECT_URL`

### Files are too large
**Solution:**
```bash
# Find large files
find . -type f -size +50M

# Remove from git (keep locally)
git rm --cached path/to/large-file
echo "path/to/large-file" >> .gitignore
git commit -m "Remove large file"
git push
```

---

## 📞 Need Help?

If you're stuck:

1. **Check git status:** `git status`
2. **Check remotes:** `git remote -v`
3. **Check commits:** `git log --oneline`
4. **Check what's staged:** `git diff --staged`

Still stuck? Let me know the error message and I'll help!

---

## ✅ Success Checklist

- [ ] GitHub repository created
- [ ] Git initialized locally  
- [ ] .gitignore file exists
- [ ] Files staged with `git add .`
- [ ] First commit created
- [ ] Remote added
- [ ] Branch set to `main`
- [ ] Code pushed to GitHub
- [ ] Files visible on GitHub
- [ ] No `.env` or secrets visible
- [ ] Repository name saved for Railway deployment

**Once all checked, you're ready to deploy to Railway!** 🎉
