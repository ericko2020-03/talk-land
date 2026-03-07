
# Allensay_s

A membership-based publishing platform built with **Next.js App Router**.

Allensay_s is designed as a community-driven content platform supporting publishing, interaction, and future creator monetization.

---

# Overview

Allensay_s is a modern web platform focused on:

- Content publishing
- Community interaction
- Membership-based access
- Creator economy

The system includes:

- Post publishing
- Comments
- Likes
- Media upload
- Admin backend
- Role-based access control (RBAC)

Future development includes:

- Membership tiers
- Paid content
- Creator subscriptions
- Analytics dashboard

---

# Architecture

The system follows a layered architecture:

Browser → Next.js App Router → API Routes → Prisma ORM → PostgreSQL → Cloudflare R2

Technology stack:

| Layer | Technology |
|------|------------|
Frontend | Next.js 16 App Router |
Language | TypeScript |
Styling | Tailwind CSS |
Authentication | NextAuth |
ORM | Prisma |
Database | PostgreSQL (Neon) |
Storage | Cloudflare R2 |
Deployment | Vercel |

---

# Core Architectural Principles

Allensay_s strictly separates three logical domains:

Access Control  
Publish Validity  
Rendering Strategy  

These domains **must never be mixed**.

## Access Control

Defines **who can access content**

PUBLIC  
LOGIN_ONLY  
ADMIN_ONLY  
ADMIN_DRAFT  

## Publish Validity

Defines **whether a post is valid for publication**

A published post must contain:

text  
OR image  
OR youtube  

## Rendering Strategy

Defines **how content is displayed**

Examples:

- card layout
- mobile layout
- list layout

Rendering must **never determine visibility**.

---

# Repository Structure

/app  
&nbsp;&nbsp;layout.tsx  
&nbsp;&nbsp;page.tsx  

&nbsp;&nbsp;post/  
&nbsp;&nbsp;&nbsp;&nbsp;[id]/  

&nbsp;&nbsp;admin/  
&nbsp;&nbsp;&nbsp;&nbsp;layout.tsx  
&nbsp;&nbsp;&nbsp;&nbsp;posts/  

/api  
&nbsp;&nbsp;posts/  
&nbsp;&nbsp;comments/  
&nbsp;&nbsp;likes/  
&nbsp;&nbsp;upload/  
&nbsp;&nbsp;uploads/r2/presign/  

/lib  
/components  
/prisma  
/public  

---

# Route Map

## Public Routes

/  
/post/[id]  
/login  
/register  

## Admin Routes

/admin  
/admin/posts  
/admin/posts/new  
/admin/posts/[id]  
/admin/posts/[id]/edit  

## API Routes

/api/posts  
/api/comments  
/api/likes  
/api/upload  
/api/uploads/r2/presign  

## Cron Jobs

/api/cron/cleanup-drafts  

Configured in `vercel.json`:

{
  "crons": [
    { "path": "/api/cron/cleanup-drafts", "schedule": "0 2 * * *" }
  ]
}

---

# Database Schema

Primary entities:

User  
Post  
Comment  
Like  
Media  

Relationship overview:

User (1) → (N) Post  
Post (1) → (N) Comment  
Post (1) → (N) Like  
Post (1) → (N) Media  

---

# Visibility Model

| Visibility | Access |
|-----------|--------|
PUBLIC | Everyone |
LOGIN_ONLY | Authenticated users |
ADMIN_ONLY | Admin backend |
ADMIN_DRAFT | Admin backend |

---

# Media Storage

All media files are stored in **Cloudflare R2**.

Bucket structure:

media/  
&nbsp;&nbsp;post/  
&nbsp;&nbsp;avatar/  

---

## Upload Methods

### Server Upload

/api/upload  

Server handles upload.

### Direct Upload

/api/uploads/r2/presign  

Client uploads directly to R2 using a presigned URL.

Future improvement:

Unified upload pipeline

---

# Mobile Curtain Layout

The mobile UI introduces **Header and Footer Curtains**, inspired by Facebook mobile design.

Mobile Header Curtain  
Mobile Footer Curtain  

Both occupy approximately:

1/15 of screen height

## Header Curtain

Left:

Allensay_s 社群

Right:

Search icon  
Admin icon (admin only)

## Footer Curtain

Reserved for future navigation:

Home  
Notifications  
Profile  
Messages  

Phase 0 implementation:

Only show / hide behavior  
No navigation yet

## Curtain Behavior

When the user **scrolls up**:

Header appears  
Footer appears  

When the user **scrolls down**:

Header hides  
Footer hides  

Content then occupies the full screen.

---

# Security Model

## Attack Surfaces

Admin API  
Upload endpoints  
Visibility filtering  
Direct ID enumeration  

## Threat Types

Privilege escalation  
Media abuse  
MIME spoofing  
ADMIN_ONLY data leakage  
Serverless DB exhaustion  

## Mitigation

RBAC middleware  
Server-side validation  
Rate limiting  
Database pooling  

---

# Database Pooling

Current configuration:

Prisma global singleton  
Neon pooled endpoint  

Future improvements:

pgBouncer  
Prisma Accelerate  

---

# Environment Variables

DATABASE_URL  

NEXTAUTH_SECRET  
NEXTAUTH_URL  

R2_ENDPOINT  
R2_ACCESS_KEY  
R2_SECRET_KEY  
R2_BUCKET  

---

# Deployment

Platform:

Vercel

Build command:

prisma generate && next build

---

# Development Setup

git clone <repo>

npm install

npx prisma generate

npm run dev

---

# Enterprise Roadmap

## Phase 0 — UI Stabilization

Layout normalization  
Edit page alignment  
Unsaved change guard  
Mobile header/footer curtains  

## Phase 1 — Infrastructure Hardening

Upload rate limiting  
R2 deletion synchronization  
Monitoring improvements  

## Phase 2 — Feature Expansion

Tag system  
Search  
Scheduled publishing  
Membership tiers  

## Phase 3 — Monetization

Stripe integration  
Analytics dashboard  
Paid content  

---

# Critical Invariants

ADMIN_ONLY content must never appear on frontend  
PUBLIC posts must not be empty  
Visibility must be separated from rendering  
Client-side RBAC must not be trusted  
Backend preview must remain isolated  

---

# Versioning

v1 initial repo  
v2 admin system  
v3 security model  
v4 enterprise README  

---

# Maintainer

Project: Allensay_s

Stack:

Next.js  
Prisma  
PostgreSQL  
Cloudflare R2  

---

# License

MIT License
