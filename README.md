# Tradelenx — Futures Trading Journal

Private futures trading journal built with React + Vite, deployed on Cloudflare Pages.

## Stack
- **Frontend**: React 18 + Vite + Recharts
- **Auth + DB**: Supabase (free tier)
- **Hosting**: Cloudflare Pages (free tier)
- **AI**: Groq API — llama-3.3-70b (free tier)
- **Data**: Binance Futures API (direct browser connection via WebCrypto)

---

## Deploy to Cloudflare Pages

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial Tradelenx"
git remote add origin https://github.com/YOUR_USERNAME/tradelenx.git
git push -u origin main
```

### 2. Connect to Cloudflare Pages
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Workers & Pages → Create → Pages → Connect to Git
3. Select your repo
4. Build settings:
   - **Build command**: `npm run build`
   - **Output directory**: `dist`
   - **Functions directory**: `functions` (auto-detected)

### 3. Add Environment Variables
In Cloudflare Pages → your project → **Settings → Environment Variables**:

| Variable | Value | Required |
|---|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key | ✅ |
| `GROQ_API_KEY` | Free key from [console.groq.com](https://console.groq.com) | For AI |
| `BINANCE_API_KEY` | Binance API key | Optional |
| `BINANCE_API_SECRET` | Binance secret | Optional |

> **Note**: Binance connects directly from the browser using WebCrypto HMAC signing.  
> Your secret key never leaves your device. The server-side function is a fallback only.

### 4. Supabase Setup
Run this SQL in your Supabase project → SQL Editor:
```sql
-- See src/lib/supabase.js for full SQL
```

---

## Local Development

```bash
# Install
npm install

# Option A: Simple (no server functions)
npm run dev          # → localhost:5173
# Binance connects directly from browser — works fine

# Option B: With Cloudflare Workers (full local simulation)
cp .dev.vars.example .dev.vars
# Fill in .dev.vars with your API keys
npm run build
npx wrangler pages dev dist --port 8788  # → localhost:8788
```

---

## Rename Your Site
Cloudflare Pages → your project → **Custom Domains** → add your domain  
Or: Settings → change project name → `tradelenx.pages.dev`

---

## API Functions
| Path | Description |
|---|---|
| `GET /api/ai` | Debug — checks if GROQ_API_KEY is loaded |
| `POST /api/ai` | AI analysis via Groq llama-3.3-70b |
| `GET /api/binance?mode=ping` | Test Binance credentials |
| `GET /api/binance?mode=futures_trades&symbol=BTCUSDT` | Fetch trades |
