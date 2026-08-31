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
docs/        M1 architecture and ER diagram
notion/      Client project-management workspace provisioner
```

## Local setup (Milestone 1)

1. Copy `.env.example` to `.env`.
2. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) if it is missing, then start Postgres:

```bash
npm run db:up
```

3. Install, migrate, and seed the six tools (not the 1,964 questions — that is M3):

```bash
npm install
npm run db:migrate
npm run db:seed
```

4. Run the apps (two terminals):

```bash
npm run dev:api
npm run dev:web
```

- API health: http://localhost:4000/health
- Web: http://localhost:5173 (sign in as `admin@pvi.local` / `ChangeMe_admin1` after seed)

Architecture, ER diagram, and M2 APIs:

- [docs/architecture.md](docs/architecture.md)
- [docs/er-diagram.md](docs/er-diagram.md)
- [docs/installation.md](docs/installation.md)
- [docs/api-m2.md](docs/api-m2.md)

## Project management

Weekly status, milestones, and the client portal live in Notion. See
[notion/README.md](notion/README.md).

## What comes next

| Milestone | Work |
|---|---|
| M3 | Import PVI’s 1,964 indicators |
| M4 | Respondent assessment UI (next invoice) |
| M5 | Admin dashboard |
| M6 | Audit, backups, email templates |
| M7 | Tests and UAT |
| M8 | Production deploy and handover |
