# Deployment Guide - Live Streaming Platform

This guide will help you deploy your live streaming platform to free hosting services.

## 🚀 Free Hosting Options

### Option 1: Render.com (Recommended - Easiest)

**Pros:**
- Free tier available
- Automatic HTTPS
- Easy deployment from GitHub
- WebSocket support
- 750 hours/month free

**Steps:**

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/live-streaming-platform.git
   git push -u origin main
   ```

2. **Deploy on Render:**
   - Go to [render.com](https://render.com) and sign up
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Settings:
     - **Name:** live-streaming-platform
     - **Environment:** Node
     - **Build Command:** `npm install`
     - **Start Command:** `npm start`
     - **Plan:** Free
   - Add Environment Variable:
     - `NODE_ENV` = `production`
   - Click "Create Web Service"
   - Wait for deployment (5-10 minutes)
   - Your app will be live at: `https://your-app-name.onrender.com`

**Note:** Free tier spins down after 15 minutes of inactivity. First request may take 30-60 seconds.

---

### Option 2: Railway.app

**Pros:**
- Free tier with $5 credit/month
- Fast deployment
- Automatic HTTPS
- Good WebSocket support

**Steps:**

1. **Push to GitHub** (same as above)

2. **Deploy on Railway:**
   - Go to [railway.app](https://railway.app) and sign up
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Railway auto-detects Node.js
   - Add Environment Variable:
     - `NODE_ENV` = `production`
   - Click "Deploy"
   - Your app will be live at: `https://your-app-name.up.railway.app`

---

### Option 3: Fly.io

**Pros:**
- Free tier available
- Global edge network
- Good performance

**Steps:**

1. **Install Fly CLI:**
   ```bash
   # Windows (PowerShell)
   powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
   ```

2. **Login and Deploy:**
   ```bash
   fly auth login
   fly launch
   ```
   - Follow the prompts
   - Your app will be live at: `https://your-app-name.fly.dev`

---

### Option 4: Replit

**Pros:**
- Free tier available
- In-browser IDE
- Easy to use

**Steps:**

1. Go to [replit.com](https://replit.com) and sign up
2. Click "Create Repl" → "Import from GitHub"
3. Paste your repository URL
4. Click "Import"
5. Click "Run" button
6. Your app will be live (check the URL in the output)

---

### Option 5: Glitch

**Pros:**
- Free tier
- Easy deployment
- Live code editing

**Steps:**

1. Go to [glitch.com](https://glitch.com) and sign up
2. Click "New Project" → "Import from GitHub"
3. Paste your repository URL
4. Click "Import"
5. Your app will be live at: `https://your-project-name.glitch.me`

---

## 📝 Pre-Deployment Checklist

Before deploying, make sure:

- [ ] All code is committed to GitHub
- [ ] `.env` file is in `.gitignore` (don't commit secrets)
- [ ] `NODE_ENV=production` is set in hosting platform
- [ ] Port is set via `PORT` environment variable (hosting platforms provide this)

## 🔧 Environment Variables

Set these in your hosting platform:

- `NODE_ENV` = `production`
- `PORT` = (usually auto-set by hosting platform)

## 🌐 After Deployment

1. **Test your deployment:**
   - Visit your live URL
   - Try starting a stream
   - Test from another device/browser

2. **Share with users:**
   - Send them your live URL
   - They can access it from anywhere (not just local network)
   - HTTPS is automatically provided (required for camera access)

## ⚠️ Important Notes

1. **Free Tier Limitations:**
   - Render: Spins down after 15 min inactivity
   - Railway: $5 credit/month (usually enough for 2-3 users)
   - Fly.io: Limited resources on free tier

2. **WebRTC Considerations:**
   - WebRTC works best on same network
   - For users on different networks, you may need TURN servers
   - For 2-3 users, STUN servers (already included) should work

3. **HTTPS:**
   - All hosting platforms provide HTTPS automatically
   - This is required for camera/microphone access in Chrome/Edge

## 🐛 Troubleshooting

**App won't start:**
- Check build logs in hosting platform
- Ensure `npm start` command is correct
- Check environment variables

**WebSocket errors:**
- Ensure hosting platform supports WebSockets
- Check CORS settings (already configured)

**Camera not working:**
- Ensure you're using HTTPS (automatic on all platforms)
- Check browser permissions
- Try different browser

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [Fly.io Documentation](https://fly.io/docs)

---

**Recommended for 2-3 users:** Render.com or Railway.app (both have good free tiers and easy setup)

