# 🚀 Hosting on Render.com (100% Free)

Follow these steps to put your website and bot online:

### 1. Upload to GitHub
1. Create a **Private** repository on GitHub.
2. Upload the entire project folder to that repository.
   - **IMPORTANT**: Do NOT upload `.env` or `node_modules`.

### 2. Create Service on Render
1. Go to [Render.com](https://render.com/) and Log In.
2. Click **New +** and select **Web Service**.
3. Connect your GitHub account and select the **Private Repository** you just made.

### 3. Configure Service
- **Name**: `rear-x-tier` (any name you like)
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Tier**: Select **Free**

### 4. Add Environment Variables (CRITICAL)
Go to the **Environment** tab on Render and add every variable from your `.env` file:
- `DISCORD_TOKEN`: (Your Bot Token)
- `CLIENT_ID`: (Your Bot Client ID)
- `GUILD_ID`: (Your Server ID)
- `PORT`: `10000` (Render uses this port)
- `STAFF_ROLE_ID`: ...
- (Add all other role IDs and channel IDs from your .env)

### 5. Final Setup
1. Click **Deploy Web Service**.
2. Render will give you a link like `https://rear-x-tier.onrender.com`.
3. Open Discord Developer Portal -> Your App -> Bot -> **Privileged Gateway Intents**:
   - Make sure **Presence Intent**, **Server Members Intent**, and **Message Content Intent** are all **ON**.

### ⚠️ HYBRID SETUP (Vercel + Render)
If you want to host the **Frontend on Vercel** and the **Backend/Bot on Render**, do this:

#### 1. Backend (Render)
- Follow the Render steps above to deploy your repository.
- Once live, Render will give you a URL (e.g., `https://rear-x.onrender.com`).

#### 2. Frontend Configuration
- Open `website/public/script.js` in your code.
- At the very top, change `API_BASE` to your Render URL:
  ```javascript
  const API_BASE = 'https://rear-x.onrender.com';
  ```
- Save and push this change to GitHub.

#### 3. Frontend (Vercel)
- Go to [Vercel.com](https://vercel.com/) and click **New Project**.
- Select the same GitHub repository.
- **IMPORTANT**: Set the "Root Directory" to `website/public`.
- Click **Deploy**.

---

### ⚠️ IMPORTANT NOTE ON DATABASE
Because Render Free Tier is "Ephemeral", your SQLite database will reset if the server restarts. 
To keep your data permanently on Render for free:
1. Go to your Render Dashboard.
2. Click **Add Disk** to your Web Service.
3. Path: `/opt/render/project/src/database`
4. This will give you 1GB of permanent storage for your rankings!

