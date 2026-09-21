# PVI-CAP

Digital Career Assessment Platform for Prakramika Vocational Institute.

Phase 1 digitises six proprietary tools (~1,964 indicators) into a secure web
app: login, one learner per respondent, assessment completion with auto-save,
and an admin/expert review dashboard. Scoring, AI recommendations, and in-app
reports are **out of scope**.

| Layer | Contracted stack |
|---|---|
| Web | React + TypeScript, Tailwind CSS, shadcn/ui |
| API | Node.js / Express, TypeScript |
| Database | PostgreSQL + Prisma |
| Auth | JWT + bcrypt, email OTP |
| Email | Nodemailer + SendGrid or AWS SES |
| Deploy | Docker on AWS or DigitalOcean |

## Repository layout

```
apps/api     Express API + Prisma schema
apps/web     React app
docs/        Architecture, APIs, local test procedure
scripts/     Local Postgres bootstrap SQL
notion/      Client project-management workspace provisioner
```

## Local setup

Exact click-through for this Windows laptop: **[docs/local-test.md](docs/local-test.md)**.

This machine uses native PostgreSQL 18 (Docker Desktop is not installed; C: is too
full). Create the `pvi` role and `pvi_cap` database once (SQL in
`scripts/bootstrap-local-pg.sql`). In each terminal, point temp at D: first
(`$env:TEMP="D:\pvi\tmp"`; see [docs/local-test.md](docs/local-test.md)), then:

```powershell
npm install
npm run db:migrate
npm run db:seed
npm run dev:api
```

Second terminal: `npm run dev:web`

- API health: http://localhost:4000/health
- Web: http://localhost:5173

Demo accounts:

- Family (Aarav, Basic): `respondent@pvi.local` / `Respondent1`
- Family (Anaya, Early Childhood): `early@pvi.local` / `Respondent1`
- Admin: `admin@gmail.com` / `Admin12345a`

Architecture, ER diagram, APIs, and the family click-through:

- [docs/admin.md](docs/admin.md) — send form, children/answers, question bank
- [docs/user-journey.md](docs/user-journey.md) — parent / teacher / caregiver / child (source of truth for the user side)
- [docs/mailpit.md](docs/mailpit.md) — local fake inbox
- [docs/aws.md](docs/aws.md) — AWS (RDS, SES, Docker)
- [docs/architecture.md](docs/architecture.md)
- [docs/er-diagram.md](docs/er-diagram.md)
- [docs/installation.md](docs/installation.md)
- [docs/api-m2.md](docs/api-m2.md)
- [docs/local-test.md](docs/local-test.md)

## Project management

Weekly status, milestones, and the client portal live in Notion. See
[notion/README.md](notion/README.md).

## What comes next

| Milestone | Work |
|---|---|
| M3 | Import PVI’s real 1,964 indicators (blocked on their spreadsheet) |
| M4 | Respondent take-flow — live question bank from `data/pvi-cap-questions.csv` |
| M5 | Admin/expert review desk — sample UI is in; polish Annexure B filters |
| M6 | Audit, backups, email templates |
| M7 | Tests and UAT |
| M8 | Production deploy and handover |
