# Allensay_s

Enterprise-grade membership publishing platform built with **Next.js App Router**.

Allensay_s is designed as a scalable creator-community platform supporting publishing, interaction, and future creator monetization.

---

# Project Status

Stage: Active Development  
Architecture Level: SaaS-Ready  

---

# Tech Stack

| Layer | Technology |
|------|-------------|
Frontend | Next.js 16 App Router |
Language | TypeScript |
Styling | TailwindCSS |
Auth | NextAuth |
ORM | Prisma |
Database | PostgreSQL (Neon) |
Storage | Cloudflare R2 |
Deployment | Vercel |

---

# Documentation

Full technical documentation is located in `/docs`.

| Document | Description |
|---|---|
Architecture | /docs/architecture.md |
Database Schema | /docs/database.md |
Security Model | /docs/security.md |
Deployment Guide | /docs/deployment.md |

---

# Development Setup

Clone repository

```
git clone <repo>
```

Install dependencies

```
npm install
```

Generate Prisma client

```
npx prisma generate
```

Run development server

```
npm run dev
```

---

# License

MIT License