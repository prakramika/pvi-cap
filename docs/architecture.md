# PVI-CAP Phase 1 — System Architecture

**Document:** Architecture overview for client review (Milestone 1)  
**Project:** PVI-CAP Digital Career Assessment Platform — Phase 1  
**Stack:** contracted in Annexure A.4 of the Software Development Agreement  
**Status:** Draft for M1 review

This document describes how Phase 1 will be built. It does not add scoring, in-app reports, mobile apps, or integrations beyond email.

## 1. Objective

Digitise PVI’s six proprietary assessment tools (~1,964 indicators) into a secure, role-based web application so that:

- a **respondent** can log in, complete assigned assessments (section by section, with auto-save and progress), and submit
- an **admin / expert** can manage users, review submissions, and filter by the ten agreed fields
- PVI receives source code, schema, APIs, and a live HTTPS deployment at handover

Scoring, interpretation, and report writing remain **manual** in Phase 1.

## 2. Users and roles

| Role | Who | What they can do |
|---|---|---|
| Respondent | Parent / caregiver / learner operator | One learner profile; take assessments; see own progress |
| Expert | PVI practitioner | Review submitted assessments; notes; post-review email |
| Admin | PVI operator | Users, account status, stage override, all expert capabilities, audit visibility |

One learner per respondent account (Annexure B).

## 3. Components

```
┌─────────────┐     HTTPS      ┌──────────────────┐
│  React web  │───────────────▶│  Express API     │
│  (Vite)     │     JWT        │  REST + OpenAPI  │
└─────────────┘                └────────┬─────────┘
                                        │ Prisma
                               ┌────────▼─────────┐
                               │  PostgreSQL      │
                               └────────┬─────────┘
                                        │
┌─────────────┐                ┌────────▼─────────┐
│  Email      │◀───────────────│  Notification    │
│  SES / SG   │   Nodemailer   │  worker (in-API) │
└─────────────┘                └──────────────────┘
```

| Component | Technology | Module mapping |
|---|---|---|
| Web app | React + TypeScript, Tailwind, shadcn/ui | Respondent UI, Admin dashboard |
| API | Node.js, Express, TypeScript | Auth, users, assessments, reviews, notifications |
| Database | PostgreSQL + Prisma | Database design, content, responses, audit |
| Auth | JWT + bcrypt; email OTP | Authentication & access control |
| Email | Nodemailer + SendGrid or AWS SES | Notification system |
| Runtime | Docker on AWS or DigitalOcean | Deployment & infrastructure |
| CI | GitHub Actions | Test and image build |
| Docs | Swagger / OpenAPI + Postman | APIs deliverable |

## 4. Application modules (Phase 1)

### 4.1 Authentication and access control

Implemented in Milestone 2.

- Email + password (bcrypt). JWT access token (15 minutes); refresh token stored hashed (7 days, rotated).
- Email OTP for password reset (10 minutes). Codes are hashed at rest.
- Role middleware: `ADMIN`, `EXPERT`, `RESPONDENT`. Inactive/suspended accounts cannot authenticate.
- Login, role change, and stage override are written to the audit log.

See [docs/api-m2.md](api-m2.md).

### 4.2 User and learner management

Implemented in Milestone 2.

- Admin creates users. A respondent account always has exactly one `Learner`.
- Admin may override the age-derived assessment stage (audited).
- Expert may list and view users; only admin may create or change them.

### 4.3 Assessment configuration

Six tools, seeded by code (not invented content):

| Code | Tool | Indicators | Stage logic |
|---|---|---|---|
| HDMA | Holistic Development & Milestone Assessment | 792 | No — all questions |
| III | Interest Identification Inventory | 477 | Yes — 5 stages; free-text items |
| CALP | Cognitive Ability & Learning Profile | 330 | Yes — 5 stages |
| FSIC | Functional Skills & Independence Checklist | 100 | Yes — 5 stages |
| BWRS | Behavioural & Workplace Readiness Scale | 80 | Yes — 5 stages |
| VLAP | Vocational Learning & Aptitude Profile | 185 | No — all questions |

Stage bands (admin-overridable): 0–5 Early Childhood, 6–10 Pre-Skill, 11–15 Basic, 16–20 Intermediate, 21–25 Advanced.

Question bank import is Milestone 3 and **requires PVI’s structured file**. Scoring notes may be stored for later phases; they are **not executed** in Phase 1.

### 4.4 Respondent assessment interface

- Start or resume one **active** instance per learner per tool (no version history).
- Section-wise navigation, per-question auto-save, progress percent, submit.
- Stage-based tools only present questions mapped to the learner’s stage.

### 4.5 Admin / expert dashboard

- Counts: users, in-progress, submitted, pending review.
- Search and the ten Annexure B filters only.
- Assessment detail (read responses; add review notes).
- User management (role, account status, stage override).

### 4.6 Notifications

Email only. Templates include: invite / OTP, assessment submitted, review completed (no automatic report release).

### 4.7 Security and audit

- HTTPS, helmet, rate limits on auth.
- Passwords hashed; tokens hashed at rest.
- Learner data encrypted in transit; backups encrypted (Milestone 6).
- Audit log: login, role change, stage override, submit, review, export.

### 4.8 APIs

Versioned REST under `/api/v1`. OpenAPI generated from the same route contracts. Postman collection exported from that spec.

## 5. What Phase 1 will not contain

Automated scoring or AI recommendations; in-app report generation; native mobile apps; institutional (NGO/school/trainer) portals; ERP/CRM/LMS; research analytics; offline mode; multimedia items; SMS/WhatsApp; multi-version history; extra admin filters.

Those require a written change request (Clauses 3.4, 9.4, Annexure B).

## 6. Environments

| Environment | Purpose |
|---|---|
| Local | Docker Postgres + `apps/api` + `apps/web` |
| Staging | Client UAT (Milestone 7) |
| Production | Live HTTPS (Milestone 8) |

PVI supplies domain DNS and the cloud account before deployment. Third-party invoices (hosting, domain, email) are PVI’s cost.

## 7. Delivery sequence

M1 this document + schema + repo → M2 APIs → M3 content import → M4 respondent UI (invoice) → M5 admin UI → M6 security/notifications (invoice) → M7 tests/UAT → M8 go-live and handover (invoice).
