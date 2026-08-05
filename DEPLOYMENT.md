# Deployment Guide — Vercel + Render + Supabase

## Architecture

```
Vercel (frontend/)  →  Next.js 15
Render (backend/)   →  FastAPI API
Supabase            →  PostgreSQL (already configured)
```

---

## 1. Push to GitHub

Repository: `https://github.com/marcbz/Kigalifinders`

---

## 2. Deploy Backend on Render

1. Go to [render.com](https://render.com) → **New** → **Blueprint**
2. Connect your GitHub repo `marcbz/Kigalifinders`
3. Render will read `render.yaml` and create the `kigalifinders-api` service
4. Set these **environment variables** in Render Dashboard:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `postgresql+asyncpg://postgres.[ref]:[password]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres` |
| `DATABASE_URL_SYNC` | `postgresql://postgres.[ref]:[password]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres` |
| `FRONTEND_URL` | Your Vercel URL (e.g. `https://kigalifinders.vercel.app`) |
| `CORS_ORIGINS` | Same as FRONTEND_URL, comma-separated if multiple |
| `SUPABASE_URL` | `https://hmfdvrdorvdjhbkvprij.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | From Supabase dashboard |
| `SUPABASE_SECRET_KEY` | From Supabase dashboard |
| `CLOUDINARY_CLOUD_NAME` | From [Cloudinary Dashboard](https://cloudinary.com/console) |
| `CLOUDINARY_API_KEY` | From Cloudinary Dashboard |
| `CLOUDINARY_API_SECRET` | From Cloudinary Dashboard |

> **Image uploads** (admin property/blog photos) require Cloudinary. After deploy, verify with  
> `GET /api/v1/admin/upload/status` (while logged in as admin) — should return `{"configured": true, "provider": "cloudinary"}`.

5. Deploy — your API will be at `https://kigalifinders-api.onrender.com`
6. Verify: `https://kigalifinders-api.onrender.com/health`

> **Note:** Free tier sleeps after 15 min inactivity. First request may take ~30s.

---

## 3. Deploy Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import `marcbz/Kigalifinders` from GitHub
3. Set **Root Directory** to `frontend`
4. Framework: **Next.js** (auto-detected)
5. Add **Environment Variables**:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://kigalifinders-api.onrender.com/api/v1` |
| `NEXT_PUBLIC_SITE_URL` | Your Vercel URL |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | `250784806641` |

6. Deploy

---

## 4. Post-Deploy Checklist

- [ ] Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` on Render
- [ ] Test image upload in Admin → Properties or Blog
- [ ] Update `CORS_ORIGINS` on Render with your final Vercel URL
- [ ] Update `FRONTEND_URL` on Render
- [ ] Test homepage loads properties from API
- [ ] Test admin login at `/admin/login`
- [ ] Add custom domain in Vercel (optional)

---

## Local Development

```bash
# Backend
cd backend
pip install -r requirements.txt
python seed.py   # first time only
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install --legacy-peer-deps
npm run dev
```

---

## Admin Credentials (after seeding)

- Email: `admin@kigalifinders.com`
- Password: `Admin@123456`

Change immediately in production.
