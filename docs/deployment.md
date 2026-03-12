# Deployment

Deployment platform: Vercel

---

## Build Process

Build command:

```
prisma generate && next build
```

This ensures Prisma client generation before application build.

---

## Environment Variables

Required variables:

```
DATABASE_URL

NEXTAUTH_SECRET
NEXTAUTH_URL

GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET

R2_ENDPOINT
R2_ACCESS_KEY
R2_SECRET_KEY
R2_BUCKET
```

---

## Database Pooling

Current configuration:

- Prisma global singleton
- Neon pooled endpoint

Future improvements:

- pgBouncer
- Prisma Accelerate

---

## Production Checklist

Before deploying to production:

- database migrations applied
- environment variables configured
- upload endpoints secured
- RBAC verified
- rate limiting enabled
- cron jobs configured