# Local installation (developer setup)

This is the working draft of the Installation Guide (Clause 4). It will be
completed at Milestone 8. Use it now to run Phase 1 locally.

## Prerequisites

- Node.js 22+
- Docker Desktop (for PostgreSQL) — not optional for local M1
- Git

## Steps

1. Clone the private repository and `cd` into it.
2. Copy `.env.example` to `.env`. Do not commit `.env`.
3. `docker compose up -d postgres` and wait until healthy.
4. `npm install`
5. From `apps/api`: `npx prisma migrate dev` then `npm run prisma:seed`
6. `npm run dev:api` and `npm run dev:web`

The web dev server proxies `/api` to `http://localhost:4000`.

After seed, sign in at http://localhost:5173 as `admin@pvi.local` / `ChangeMe_admin1`.
Change that password before any client demo on a shared environment.

If SMTP is unset, password-reset OTP codes print in the API console.

## What is not installed yet

- SMTP / SendGrid / SES (PVI, before week 2)
- Production domain and cloud account (PVI, before week 9)
- Assessment question bank (PVI structured file, before week 3 / Milestone 3)
