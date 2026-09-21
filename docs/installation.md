# Local installation (developer setup)

This is the working draft of the Installation Guide (Clause 4). It will be
completed at Milestone 8. Use it now to run Phase 1 locally.

## Prerequisites

- Node.js 22+
- PostgreSQL (Docker Desktop **or** native PostgreSQL 18 on this laptop)
- Git

On this Windows laptop, C: is nearly full. Set temp to D: before npm/prisma:

```powershell
$env:TEMP = "D:\pvi\tmp"
$env:TMP = "D:\pvi\tmp"
$env:npm_config_cache = "D:\pvi\npm-cache"
```

Exact click-through: [local-test.md](local-test.md).  
Family / parent journey (letters, roles, six tools): [user-journey.md](user-journey.md).  
AWS production: [aws.md](aws.md).

## Steps

1. Clone the private repository and `cd` into it.
2. Copy `.env.example` to `.env`. Do not commit `.env`.
3. `docker compose up -d postgres` and wait until healthy.
4. `npm install`
5. From `apps/api`: `npx prisma migrate deploy` then `npm run prisma:seed`
6. `npm run dev:api` and `npm run dev:web`

The web dev server proxies `/api` to `http://localhost:4000`.

After seed, follow the click-through script in [local-test.md](local-test.md).
Change the admin password before any shared demo.

If SMTP is unset, enrolment, OTP, and completion letters print in the API console and appear as a demo inbox on screen. Local Mailpit inbox: [mailpit.md](mailpit.md). Family copy: [user-journey.md](user-journey.md).

## What is not installed yet

- SMTP / SendGrid / SES (PVI, before week 2)
- Production domain and cloud account (PVI, before week 9)
- Question bank CSV lives at `data/pvi-cap-questions.csv` and is loaded by seed.
