# Kigalifinders

Premium Real Estate Management Platform for Kigali, Rwanda.

Built from the original HTML design prototype into a full-stack production application.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, Shadcn/UI, Framer Motion, TanStack Query |
| Backend | FastAPI, Python 3.13, SQLAlchemy 2.0, Alembic, Pydantic v2 |
| Database | PostgreSQL (Supabase compatible) |
| Cache/Queue | Redis, Celery |
| Auth | JWT + Refresh Tokens, OAuth ready |
| Storage | Cloudinary / AWS S3 |
| Email | Resend |
| SMS | Twilio |
| Payments | Stripe |

## Project Structure

```
Kigalifinders/
├── frontend/          # Next.js 15 application
├── backend/           # FastAPI application
├── docker-compose.yml
├── .env.example
└── Index.html         # Original design prototype (reference only)
```

## Quick Start

### 1. Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 2. Docker (Recommended)

```bash
docker-compose up -d
docker-compose exec backend python seed.py
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api/v1/docs
- Admin: http://localhost:3000/admin/login

### 3. Manual Setup

**Backend:**

```bash
cd backend
pip install -r requirements.txt
# Start PostgreSQL and Redis first
python seed.py
uvicorn app.main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

## Default Admin Credentials

- Email: `admin@kigalifinders.com`
- Password: `Admin@123456`

## API Documentation

Swagger UI: `http://localhost:8000/api/v1/docs`

Key endpoints:
- `GET /api/v1/homepage` — Dynamic homepage data
- `GET /api/v1/properties` — Search & filter properties
- `GET /api/v1/properties/{slug}` — Property details
- `POST /api/v1/auth/login` — Authentication
- `GET /api/v1/admin/dashboard` — Admin statistics

## Features

### Public Website
- Dynamic homepage (hero, stats, featured properties, plots, testimonials, areas, blog, FAQ)
- Advanced property search with filters
- Property detail pages with SEO & Schema.org
- Blog, FAQ, About, Contact pages
- Newsletter subscription
- WhatsApp & call floating CTAs
- Dark mode support
- Mobile-first responsive design

### Admin Dashboard
- Statistics overview
- Property management
- User & agent management
- Appointments & messages
- CMS settings (via Settings table)
- Activity logs

### Database Schema
30+ tables including Users, Roles, Permissions, Properties, Agents, Blog, FAQs, Analytics, SEO, and more.

## Deployment

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for full Vercel + Render + Supabase setup.

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Vercel (root: `frontend/`) | `https://your-app.vercel.app` |
| Backend API | Render (`render.yaml`) | `https://kigalifinders-api.onrender.com` |
| Database | Supabase PostgreSQL | Already configured |

### Quick Deploy

1. **Render** → New Blueprint → connect repo → set env vars from `backend/.env.example`
2. **Vercel** → Import repo → set Root Directory to `frontend` → set env vars from `frontend/.env.example`


## Testing

```bash
cd backend
pytest
```

## License

Proprietary — Kigalifinders © 2025
