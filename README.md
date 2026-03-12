# Allensay_s

Enterprise-grade membership publishing platform built with **Next.js App Router**.

Allensay_s is designed as a scalable creator-community platform supporting publishing, interaction, and future creator monetization.

---

# Project Status

Stage: Active Development  
Architecture Level: SaaS-Ready  
Documentation Level: Enterprise Transfer Document  

---

# Core Goals

Allensay_s aims to become a platform for:

• community publishing  
• creator-audience interaction  
• membership-based content  
• future subscription economy  

---

# System Architecture

```mermaid
flowchart TD

Browser --> NextAppRouter
NextAppRouter --> API
API --> Prisma
Prisma --> PostgreSQL
NextAppRouter --> R2Storage

NextAppRouter --> Auth
Auth --> RBAC