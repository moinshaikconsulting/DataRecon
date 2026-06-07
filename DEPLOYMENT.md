# DeconFlow Deployment Guide 🚀
*Made for non-coders: step-by-step instructions to get your app live on the internet!*

This application is built with a **React frontend** and an **Express server backend** backed by **PostgreSQL** for storing audits. If PostgreSQL isn't configured, the app will automatically run in **safe local-file fallback mode**, so it will always work!

Here are the step-by-step instructions to deploy this application for free.

---

## Step 1: Download & Export Your Code 📥
Before deploying, download the code onto your computer:
1. In the top-right or sidebar menu of this editor, click on **Settings** or the **Export** menu.
2. Select **Export as ZIP**.
3. Save the ZIP file to your computer and extract (unzip) it into a folder.

---

## Step 2: Put Your Code on GitHub 🐙
Most free hosts (like Render and Railway) connect to GitHub to get your code.
1. Go to [GitHub](https://github.com) and create a free account if you don't have one.
2. Create a new **private** or **public** repository:
   * Give it a name (e.g. `reconflow-audit`).
   * Choose **Create repository**.
3. Upload your extracted files:
   * On your new repository page, click the link that says **"uploading an existing file"**.
   * Drag & drop **all folder files** from your extracted ZIP into the browser.
   * *Ensure files like `package.json`, `server.ts`, and `render.yaml` are visible in the root list.*
   * Scroll down and click **Commit changes**.

---

## Option A: Deploying on Render (🌟 Easiest Control & Recommended)
Render has a solid free hosting plan. We have already pre-configured a database blueprint (`render.yaml`) for you, so it's a "one-click" automated set up!

1. Create a free account at [Render](https://render.com).
2. Once logged in, click the blue **New** button in the dashboard and select **Blueprint**.
3. Connect your **GitHub** account so Render can see your repositories.
4. Select your repository (`reconflow-audit`).
5. Render will automatically read the `render.yaml` file we created and show you a review screen:
   * It will automatically create a **free Web Server**.
   * It will automatically create a **free PostgreSQL Database**.
   * It binds them together automatically!
6. Click **Apply**.
7. Render will spend a few minutes building and compiling your frontend and backend.
8. Once finished, Render will display a public link (e.g., `https://reconflow-app-xxxx.onrender.com`). Move to that URL to enjoy your application!

---

## Option B: Deploying on Railway (🚀 Ultra Fast)
Railway offers $5 of free credit or trial bounds for developers. It is incredibly clean and fast.

1. Create a free account at [Railway.app](https://railway.app).
2. Click **New Project** and select **Deploy from GitHub repo**.
3. Connect your GitHub account and select your repository (`reconflow-audit`).
4. Click **Deploy Now**.
5. Railway will automatically detect that this is a Node.js full-stack app and spin up your web server.
6. **Optional (For PostgreSQL storage):**
   * While inside your Railway project board, click **+ New** (top-right) and select **Database > Add PostgreSQL**.
   * Railway will provision a database instantly and automatically inject the `DATABASE_URL` secret directly into your Node.js application! No configuration files or password typing required.
7. To access the web server, click on your main app container block:
   * Go to the **Settings** tab.
   * Under the **Networking** section, click **Generate Domain** or assign a custom address.
   * Your public URL will look like `https://reconflow-app-production.up.railway.app`.

---

## Environment Variables Configuration 🔐
If you want to configure third-party APIs (like adding a custom Gemini AI analysis trigger in the future):
1. In your **Render** or **Railway** service dashboard, find the **Environment** or **Environment Variables** panel.
2. Add a new key:
   * Key: `GEMINI_API_KEY`
   * Value: `(Your API Key from Google AI Studio)`
3. Save or redeploy the service.

---

### You are all set! 🎉
Your spreadsheet audit ledger is ready to run in the cloud with automatic database cleanup routines!
