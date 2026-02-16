# Clear Start Credit CRM (Local, Ready-to-Run)

This is a local-ready credit repair CRM (Admin + Client Portal + API + Postgres) branded for **Clear Start Credit**.

## Quick start (Docker only)
1) Install Docker Desktop and start it
2) In this folder, run:

```bash
docker compose up --build
```

## URLs
- Admin: http://localhost:3000
- Client Portal: http://localhost:3002
- API: http://localhost:3001
- MailHog inbox (dev email): http://localhost:8025

## Default Admin Login
Set in `.env` (root). Defaults in this project:
- Email: `admin@clearstartcredit.local`
- Password: `Admin123!`

> On first start, the API auto-creates the admin user if it doesn't exist.

## Database migration
The API automatically runs `prisma migrate deploy` on startup (inside the container).

If you want Prisma Studio:
```bash
docker compose exec api sh -lc "cd /app/packages/db && npx prisma studio --port 5555 --hostname 0.0.0.0"
```
Then open http://localhost:5555

## Local file storage
Uploads and generated PDFs are saved to `./storage` on your machine.
They are served by the API at: `http://localhost:3001/files/...`

---

If you want to deploy this later (S3/R2, real SMTP, Stripe), you can extend the same codebase.
