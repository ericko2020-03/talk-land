# Security Model

Allensay_s uses a layered security approach combining authentication, authorization, and server validation.

---

## RBAC Matrix

| Role | View Public | View Login | Admin Panel |
|---|---|---|---|
Guest | ✔ | ✖ | ✖ |
User | ✔ | ✔ | ✖ |
Admin | ✔ | ✔ | ✔ |

RBAC must always be enforced server-side.

---

## Attack Surfaces

Potential attack surfaces include:

- Admin API endpoints
- Upload endpoints
- Visibility filtering
- Direct ID enumeration

---

## Threat Types

Possible threats:

- Privilege escalation
- Media abuse
- MIME spoofing
- ADMIN_ONLY data leakage
- Serverless DB exhaustion

---

## Mitigation

Security protections include:

- RBAC middleware
- server-side validation
- rate limiting
- database pooling
- strict visibility filtering

---

## Critical Invariants

The following rules must never break:

- ADMIN_ONLY content must never appear on frontend
- PUBLIC posts must not be empty
- visibility must remain separate from rendering
- client RBAC cannot be trusted
- backend preview must remain isolated