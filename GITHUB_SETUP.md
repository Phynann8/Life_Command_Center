# GitHub Setup Guide - Life Command Center

## 📋 Steps to Push to GitHub

### 1. Create a New Repository on GitHub

1. Go to [GitHub](https://github.com) and log in
2. Click the **"+"** icon in the top-right corner
3. Select **"New repository"**
4. Fill in the details:
   - **Repository name**: `Life_Command_Center`
   - **Description**: "Comprehensive productivity system with task management, time blocking, projects, and goals"
   - **Visibility**: Choose Public or Private
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
5. Click **"Create repository"**

### 2. Connect Local Repository to GitHub

Copy the repository URL from GitHub (it will look like `https://github.com/YOUR_USERNAME/Life_Command_Center.git`)

Then run these commands in your terminal:

```powershell
# Navigate to the project directory (if not already there)
cd e:\Website_Development\Life_Command_Center

# Add GitHub as remote origin
git remote add origin https://github.com/YOUR_USERNAME/Life_Command_Center.git

# Rename branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

### 3. Verify Upload

1. Refresh your GitHub repository page
2. You should see all files uploaded:
   - `index.html`
   - `styles.css`
   - `script.js`
   - `README.md`
   - `.gitignore`

---

## 🔑 Authentication Options

### Option 1: HTTPS with Personal Access Token (Recommended)

When prompted for credentials:
- **Username**: Your GitHub username
- **Password**: Use a Personal Access Token (NOT your GitHub password)

**To create a token:**
1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name, select `repo` scope
4. Copy the token and use it as your password

### Option 2: GitHub CLI (If available)

```powershell
# Install GitHub CLI if not installed
winget install --id GitHub.cli

# Authenticate
gh auth login

# Push to GitHub
gh repo create Life_Command_Center --public --source=. --push
```

### Option 3: SSH Keys

If you have SSH keys set up:
```powershell
git remote set-url origin git@github.com:YOUR_USERNAME/Life_Command_Center.git
git push -u origin main
```

---

## ✅ What Has Been Done

- ✅ Git repository initialized
- ✅ `.gitignore` created (excludes temporary files)
- ✅ `README.md` created with full documentation
- ✅ Initial commit made with all project files

## 📝 Next Steps After Push

1. **Add Repository Description** on GitHub
2. **Add Topics/Tags**: productivity, task-management, firebase, javascript
3. **Enable GitHub Pages** (optional) if you want to host it
4. **Add a License** (MIT recommended)

---

## 🆘 Troubleshooting

**Error: "remote origin already exists"**
```powershell
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/Life_Command_Center.git
```

**Error: "Authentication failed"**
- Make sure you're using a Personal Access Token, not your password
- Check that the token has `repo` permissions

**Error: "Updates were rejected"**
```powershell
git pull origin main --rebase
git push -u origin main
```

---

**Ready to push!** Just create the GitHub repository and run the commands above.
